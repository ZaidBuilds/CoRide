import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { DirectMessage } from '../types';
import { authHeaders } from '../utils/auth';
import { getQueuedMessages, removeQueuedMessage, enqueueMessage } from '../utils/offlineQueue';
import { API } from '../config';

/** Poll cadence when no socket is delivering new_dm events. */
const POLL_MS = 5000;
/** Safety-net cadence while a live socket is delivering new_dm. */
const POLL_MS_WITH_SOCKET = 15000;
/** Cap for the error back-off. */
const POLL_MS_MAX = 30000;
/** Server-side limit (moderationEngine: "max 500 characters"). */
export const MAX_MESSAGE_LENGTH = 500;

export type OutboxStatus = 'sending' | 'queued' | 'failed';

/** A message the user sent that the server hasn't confirmed yet. */
export interface OutboxMessage {
  clientId: string;
  content: string;
  timestamp: number;
  status: OutboxStatus;
  /** Why it failed — shown under the bubble. */
  error?: string;
  /** Server rejected it (moderation, not friends) — retrying won't help as-is. */
  rejected?: boolean;
}

interface ChatMessagesApi {
  /** Server-confirmed messages, oldest first, unique by id. */
  messages: DirectMessage[];
  /** Local sends not yet confirmed, oldest first. */
  outbox: OutboxMessage[];
  /** True until the first load settles. */
  loading: boolean;
  /** Last load error (null once a poll succeeds). */
  error: string | null;
  /** Optimistically send. Never throws — failures land in `outbox`. */
  send: (content: string) => void;
  /** Re-send a failed/queued outbox message. */
  retry: (clientId: string) => void;
  /** Drop a failed outbox message. */
  discard: (clientId: string) => void;
  /** Force an immediate refetch. */
  refresh: () => void;
}

const newClientId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const msgKey = (m: DirectMessage) => `${m.senderId}|${m.id}`;

class SendError extends Error {
  rejected: boolean;
  constructor(message: string, rejected: boolean) {
    super(message);
    this.rejected = rejected;
  }
}

/**
 * 1:1 chat state: history poll + optional socket push + optimistic outbox.
 *
 * - Poll and socket both merge by message id, so a message delivered twice
 *   (poll + new_dm, or new_dm + POST response) renders once.
 * - When the server's copy of one of *our* sends lands before the POST
 *   resolves (the socket frame often beats the HTTP response), the matching
 *   'sending' outbox entry is dropped in the same update — no flash of two.
 * - Offline sends are held as 'queued' and flushed on the `online` event.
 *   Leaving the chat hands anything still queued to the app-wide offline
 *   queue so it goes out on reconnect.
 * - Polling pauses while the page is hidden and backs off on errors.
 * - The chat is marked read on open, on refocus, and whenever a new message
 *   from the peer arrives while the chat is visible.
 */
export function useChatMessages(
  currentUserId: string | undefined,
  peerId: string | undefined,
  socket?: Socket | null
): ChatMessagesApi {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest-only guard: a slow response must not clobber a newer one.
  const reqSeq = useRef(0);
  const knownKeys = useRef<Set<string>>(new Set());
  const outboxRef = useRef<OutboxMessage[]>([]);
  const failures = useRef(0);
  const socketLive = !!socket?.connected;

  const updateOutbox = useCallback((fn: (prev: OutboxMessage[]) => OutboxMessage[]) => {
    setOutbox(prev => {
      const next = fn(prev);
      outboxRef.current = next;
      return next;
    });
  }, []);

  const markRead = useCallback(() => {
    if (!currentUserId || !peerId) return;
    // Fire-and-forget — a failed read marker must not disrupt the chat.
    fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/read`, {
      method: 'POST',
      headers: { ...authHeaders() }
    }).catch(() => {});
  }, [currentUserId, peerId]);

  /** Merge server messages; returns true if any *incoming* message was new. */
  const merge = useCallback((incoming: DirectMessage[]): boolean => {
    const fresh = incoming.filter(m => m && m.id && !knownKeys.current.has(msgKey(m)));
    if (fresh.length === 0) return false;
    for (const m of fresh) knownKeys.current.add(msgKey(m));
    setMessages(prev => [...prev, ...fresh].sort((a, b) => a.timestamp - b.timestamp));
    // Our own confirmed copies retire their optimistic 'sending' twins.
    const mine = fresh.filter(m => m.senderId === currentUserId);
    if (mine.length) {
      updateOutbox(prev => {
        let next = prev;
        for (const m of mine) {
          const idx = next.findIndex(o => o.status === 'sending' && o.content === m.content);
          if (idx !== -1) next = [...next.slice(0, idx), ...next.slice(idx + 1)];
        }
        return next;
      });
    }
    return fresh.some(m => m.senderId !== currentUserId);
  }, [currentUserId, updateOutbox]);

  const fetchMessages = useCallback(async (silent: boolean): Promise<boolean> => {
    if (!currentUserId || !peerId) return false;
    const seq = ++reqSeq.current;
    try {
      const res = await fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/messages`, {
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          res.status === 403 ? 'You can only chat with accepted connections.'
            : body.error || `Couldn't load messages (${res.status}).`
        );
      }
      const json = await res.json();
      if (seq !== reqSeq.current) return false;
      failures.current = 0;
      setError(null);
      return merge(json.messages || []);
    } catch (err) {
      if (seq === reqSeq.current) {
        failures.current += 1;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setError(offline
          ? "You're offline. Messages will load when you reconnect."
          : err instanceof Error && !/Failed to fetch|NetworkError|Load failed/i.test(err.message)
            ? err.message
            : "Couldn't reach CoRide. Retrying…");
      }
      return false;
    } finally {
      if (seq === reqSeq.current && !silent) setLoading(false);
    }
  }, [currentUserId, peerId, merge]);

  // POST one outbox entry. Resolves regardless of outcome.
  const deliver = useCallback(async (item: OutboxMessage) => {
    if (!currentUserId || !peerId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      updateOutbox(prev => prev.map(o => o.clientId === item.clientId ? { ...o, status: 'queued', error: undefined } : o));
      return;
    }
    updateOutbox(prev => prev.map(o => o.clientId === item.clientId ? { ...o, status: 'sending', error: undefined, rejected: false } : o));
    try {
      const res = await fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content: item.content })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 4xx = the server looked at it and said no (moderation, rate limit,
        // not friends). 5xx = transient.
        throw new SendError(body.error || `Couldn't send (${res.status}).`, res.status >= 400 && res.status < 500);
      }
      const json = await res.json();
      updateOutbox(prev => prev.filter(o => o.clientId !== item.clientId));
      if (json.message) merge([json.message]);
    } catch (err) {
      const rejected = err instanceof SendError && err.rejected;
      const message = err instanceof SendError ? err.message : 'Not sent — check your connection.';
      updateOutbox(prev => prev.map(o => o.clientId === item.clientId ? { ...o, status: 'failed', error: message, rejected } : o));
    }
  }, [currentUserId, peerId, merge, updateOutbox]);

  const send = useCallback((content: string) => {
    const body = content.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!body || !currentUserId || !peerId) return;
    const item: OutboxMessage = { clientId: newClientId(), content: body, timestamp: Date.now(), status: 'sending' };
    updateOutbox(prev => [...prev, item]);
    void deliver(item);
  }, [currentUserId, peerId, deliver, updateOutbox]);

  const retry = useCallback((clientId: string) => {
    const item = outboxRef.current.find(o => o.clientId === clientId);
    if (item) void deliver(item);
  }, [deliver]);

  const discard = useCallback((clientId: string) => {
    updateOutbox(prev => prev.filter(o => o.clientId !== clientId));
  }, [updateOutbox]);

  // Conversation switched (same hook instance, new peer): reset during render
  // rather than in an effect, so the old thread never paints under the new
  // header.
  const convKey = `${currentUserId ?? ''}|${peerId ?? ''}`;
  const [loadedKey, setLoadedKey] = useState(convKey);
  if (loadedKey !== convKey) {
    setLoadedKey(convKey);
    setMessages([]);
    setOutbox([]);
    setError(null);
    setLoading(true);
  }

  // Initial load per conversation. Messages this peer had sitting in the
  // app-wide offline queue are adopted into the outbox so they show (and
  // send) here instead of being flushed blind later.
  useEffect(() => {
    if (!currentUserId || !peerId) return;
    knownKeys.current = new Set();
    failures.current = 0;
    outboxRef.current = [];
    const adopted: OutboxMessage[] = getQueuedMessages()
      .filter(q => q.type === 'direct' && q.targetId === peerId && q.senderId === currentUserId)
      .map(q => {
        removeQueuedMessage(q.id);
        return { clientId: q.id, content: q.content, timestamp: q.timestamp, status: 'queued' as const };
      });
    let cancelled = false;
    let adoptedApplied = false;
    // fetchMessages only sets state after its request resolves.
    void Promise.resolve().then(() => (cancelled ? false : fetchMessages(false))).then(() => {
      if (cancelled) return;
      markRead();
      adoptedApplied = true;
      if (adopted.length) {
        updateOutbox(prev => [...adopted, ...prev]);
        for (const q of adopted) void deliver(q);
      }
    });
    return () => {
      cancelled = true;
      // Hand still-queued (never attempted) and network-failed messages to the
      // app-wide queue; it flushes them when the connection comes back.
      const leftovers = adoptedApplied ? outboxRef.current : [...outboxRef.current, ...adopted];
      for (const o of leftovers) {
        if (o.status === 'queued' || (o.status === 'failed' && !o.rejected)) {
          enqueueMessage({ id: o.clientId, type: 'direct', targetId: peerId, senderId: currentUserId, content: o.content, timestamp: o.timestamp });
        }
      }
    };
    // deliver/fetchMessages/markRead/updateOutbox are stable for a given (user, peer).
  }, [currentUserId, peerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll loop — setTimeout chain so the delay can adapt: slower when a live
  // socket is pushing, exponential back-off on failures, paused while hidden.
  useEffect(() => {
    if (!currentUserId || !peerId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const base = socketLive ? POLL_MS_WITH_SOCKET : POLL_MS;
    const schedule = () => {
      if (cancelled) return;
      const delay = Math.min(POLL_MS_MAX, base * Math.pow(2, Math.min(failures.current, 3)));
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const gotNew = await fetchMessages(true);
        if (gotNew) markRead();
      }
      schedule();
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fetchMessages(true).then(() => markRead());
    };
    const onOnline = () => {
      failures.current = 0;
      fetchMessages(true);
      for (const o of outboxRef.current) {
        if (o.status === 'queued' || (o.status === 'failed' && !o.rejected)) void deliver(o);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [currentUserId, peerId, socketLive, fetchMessages, markRead, deliver]);

  // Live push: the server mirrors every DM to both participants as new_dm.
  useEffect(() => {
    if (!socket || !currentUserId || !peerId) return;
    const onDm = (dm: DirectMessage) => {
      if (!dm) return;
      const inThread =
        (dm.senderId === peerId && dm.receiverId === currentUserId) ||
        (dm.senderId === currentUserId && dm.receiverId === peerId);
      if (!inThread) return;
      const gotNew = merge([dm]);
      if (gotNew && document.visibilityState === 'visible') markRead();
    };
    socket.on('new_dm', onDm);
    return () => { socket.off('new_dm', onDm); };
  }, [socket, currentUserId, peerId, merge, markRead]);

  const refresh = useCallback(() => {
    failures.current = 0;
    void fetchMessages(true);
  }, [fetchMessages]);

  return { messages, outbox, loading, error, send, retry, discard, refresh };
}

/**
 * Height of the area above the on-screen keyboard, or null when the layout
 * viewport already excludes it. With Android `adjustResize` the WebView
 * itself shrinks (null here, plain 100% layout works). Browsers that overlay
 * the keyboard (Chrome's default `resizes-visual`) only shrink the visual
 * viewport — sizing the chat to it keeps the composer above the keyboard.
 */
export function useKeyboardSafeHeight(): number | null {
  const measure = (): number | null => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return null;
    return window.innerHeight - vv.height > 80 ? Math.round(vv.height) : null;
  };
  const [h, setH] = useState<number | null>(measure);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const next = measure();
      setH(next);
      if (next !== null) window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);
  return h;
}
