import { useCallback, useEffect, useRef, useState } from 'react';
import type { DirectMessage } from '../types';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

const POLL_MS = 5000;

interface ChatMessagesApi {
  messages: DirectMessage[];
  loading: boolean;
  error: string | null;
  /** POST a message. Resolves on 201; throws the server's error otherwise. */
  send: (content: string) => Promise<void>;
  /** Force an immediate refetch (e.g. on window focus). */
  refresh: () => void;
}

/**
 * 1:1 chat message state with a 5s poll. No sockets.
 *
 * The poll and send both merge by message id, so an optimistic send is not
 * duplicated when the next poll returns the persisted copy. Merges also keep
 * order stable by timestamp.
 */
export function useChatMessages(currentUserId: string | undefined, peerId: string | undefined): ChatMessagesApi {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest-only guard: a slow response must not clobber a newer one.
  const reqSeq = useRef(0);

  const merge = useCallback((incoming: DirectMessage[]) => {
    setMessages(prev => {
      const byId = new Map(prev.map(m => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const fetchMessages = useCallback(async (silent: boolean) => {
    if (!currentUserId || !peerId) return;
    const seq = ++reqSeq.current;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/messages`, {
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load messages (${res.status})`);
      }
      const json = await res.json();
      if (seq === reqSeq.current) {
        merge(json.messages || []);
        setError(null);
      }
    } catch (err) {
      if (seq === reqSeq.current) {
        setError(err instanceof Error ? err.message : 'Could not load messages.');
      }
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [currentUserId, peerId, merge]);

  // Mark this chat read for the caller. Fire-and-forget — a failed read-receipt
  // must not disrupt the conversation; the next open retries it.
  const markRead = useCallback(() => {
    if (!currentUserId || !peerId) return;
    fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/read`, {
      method: 'POST',
      headers: { ...authHeaders() }
    }).catch(() => {});
  }, [currentUserId, peerId]);

  // Initial load + 5s poll, reset when the peer changes.
  useEffect(() => {
    if (!currentUserId || !peerId) return;
    setMessages([]);
    setLoading(true);
    // Opening the chat = reading it.
    fetchMessages(false).then(markRead);
    // Poll only while the tab is visible — a backgrounded chat shouldn't keep
    // hammering the server every 5s. (Read is marked on open/refocus, not each
    // poll, to avoid a /read POST every tick.)
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMessages(true);
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchMessages(true).then(markRead);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [currentUserId, peerId, fetchMessages, markRead]);

  const send = useCallback(async (content: string) => {
    const body = content.trim();
    if (!body || !currentUserId || !peerId) return;
    const res = await fetch(`${API}/api/chats/${encodeURIComponent(peerId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content: body })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Could not send (${res.status})`);
    }
    const json = await res.json();
    if (json.message) merge([json.message]);
  }, [currentUserId, peerId, merge]);

  const refresh = useCallback(() => fetchMessages(true), [fetchMessages]);

  return { messages, loading, error, send, refresh };
}
