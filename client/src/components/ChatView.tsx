import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Shield, Users, X, Pin } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { ContextRoom, UserProfile } from '../types';
import { ReactionBar } from './engagement/ReactionBar';
import { useKeyboardSafeHeight } from '../hooks/useChatMessages';
import { MessageList, ChatComposer, type ChatListItem } from './MessageList';

interface Props {
  room: ContextRoom;
  currentUser: UserProfile;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  socket?: Socket | null;
  typingUsers?: { userId: string; pseudonym: string }[];
  reactions?: Record<string, { counts: Record<string, number>; users: Record<string, string[]>; total: number }>;
  onReaction?: (targetId: string, emoji: string) => void;
}

/** Server-side limit (moderationEngine: "max 500 characters"). */
const MAX_LEN = 500;
/** No ack/echo within this window → mark the send failed. */
const ACK_TIMEOUT_MS = 10000;

interface Pending {
  clientId: string;
  content: string;
  ts: number;
  status: 'sending' | 'failed';
  error?: string;
}

const PINNED_KEY = 'coride:room-rules-dismissed';

/**
 * Live room chat. Full-screen (covers the bottom nav, like any chat app) so
 * the composer can sit directly above the keyboard.
 *
 * Sends are optimistic: the bubble shows immediately as "sending", clears
 * when the server echoes it (new_message / message_ack), and flips to
 * "failed — Retry" if the socket is down, moderation rejects it, or nothing
 * comes back in time.
 */
export const ChatView: React.FC<Props> = ({ room, currentUser, onSendMessage, onBack, socket, typingUsers, reactions, onReaction }) => {
  const [input, setInput] = useState('');
  const [showPinned, setShowPinned] = useState(() => {
    try { return sessionStorage.getItem(PINNED_KEY) !== '1'; } catch { return true; }
  });
  const [pending, setPending] = useState<Pending[]>([]);
  // Message whose reaction picker row is revealed (tap a bubble to toggle).
  const [reactKey, setReactKey] = useState<string | null>(null);
  // The outside-tap that closes a picker is also the bubble's click — don't
  // let that same tap reopen it.
  const lastDismiss = useRef<{ key: string; at: number } | null>(null);
  const pendingRef = useRef<Pending[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingStartRef = useRef<number | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const hasTypedRef = useRef(false);
  const seenIds = useRef<Set<string>>(new Set(room.messages.map(m => m.id)));
  const keyboardHeight = useKeyboardSafeHeight();

  const updatePending = useCallback((fn: (prev: Pending[]) => Pending[]) => {
    setPending(prev => {
      const next = fn(prev);
      pendingRef.current = next;
      return next;
    });
  }, []);

  const clearTimer = (clientId: string) => {
    const t = timers.current.get(clientId);
    if (t) { clearTimeout(t); timers.current.delete(clientId); }
  };

  /** Resolve the oldest in-flight send with this content (server confirmed it). */
  const confirm = useCallback((content: string) => {
    const hit = pendingRef.current.find(p => p.status === 'sending' && p.content === content);
    if (!hit) return;
    clearTimer(hit.clientId);
    updatePending(prev => prev.filter(p => p.clientId !== hit.clientId));
  }, [updatePending]);

  /** Fail the oldest in-flight send (moderation / server error). */
  const failOldest = useCallback((error: string) => {
    const hit = pendingRef.current.find(p => p.status === 'sending');
    if (!hit) return false;
    clearTimer(hit.clientId);
    updatePending(prev => prev.map(p => p.clientId === hit.clientId ? { ...p, status: 'failed', error } : p));
    return true;
  }, [updatePending]);

  const dispatch = useCallback((item: Pending) => {
    if (!socket || !socket.connected) {
      updatePending(prev => prev.map(p => p.clientId === item.clientId
        ? { ...p, status: 'failed', error: "You're offline." } : p));
      return;
    }
    updatePending(prev => prev.map(p => p.clientId === item.clientId ? { ...p, status: 'sending', error: undefined } : p));
    onSendMessage(item.content);
    clearTimer(item.clientId);
    timers.current.set(item.clientId, setTimeout(() => {
      timers.current.delete(item.clientId);
      updatePending(prev => prev.map(p => p.clientId === item.clientId && p.status === 'sending'
        ? { ...p, status: 'failed', error: 'No response from the room.' } : p));
    }, ACK_TIMEOUT_MS));
  }, [socket, onSendMessage, updatePending]);

  // Server's copy of our message arrived in the room → retire its twin.
  useEffect(() => {
    for (const m of room.messages) {
      if (seenIds.current.has(m.id)) continue;
      seenIds.current.add(m.id);
      if (!m.isSystem && m.senderId === currentUser.id) confirm(m.content);
    }
  }, [room.messages, currentUser.id, confirm]);

  // Ack + rejection paths from the socket.
  useEffect(() => {
    if (!socket) return;
    const onAck = (msg: { content?: string }) => { if (msg?.content) confirm(msg.content); };
    const onModeration = (p: { type?: string; message?: string }) => {
      if (p?.type === 'message_blocked' || p?.type === 'rate_limited') failOldest(p.message || 'Message blocked.');
    };
    const onError = (p: { error?: string }) => { failOldest(p?.error || 'Could not send.'); };
    socket.on('message_ack', onAck);
    socket.on('moderation_action', onModeration);
    socket.on('error_message', onError);
    return () => {
      socket.off('message_ack', onAck);
      socket.off('moderation_action', onModeration);
      socket.off('error_message', onError);
    };
  }, [socket, confirm, failOldest]);

  // Clear every timer on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(t => clearTimeout(t));
      map.clear();
      if (typingStartRef.current) window.clearTimeout(typingStartRef.current);
      if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    };
  }, []);

  // Typing indicator: 1s debounce before announcing, 3s of silence before
  // the stop — flickers once on a fast typist's first keystroke, not per key.
  const stopTyping = useCallback(() => {
    const wasTyping = hasTypedRef.current;
    hasTypedRef.current = false;
    if (typingStartRef.current) { window.clearTimeout(typingStartRef.current); typingStartRef.current = null; }
    if (typingStopRef.current) { window.clearTimeout(typingStopRef.current); typingStopRef.current = null; }
    if (wasTyping) socket?.emit('typing_stop', { roomId: room.id, userId: currentUser.id });
  }, [socket, room.id, currentUser.id]);

  const handleTyping = useCallback((val: string) => {
    if (!socket) return;
    if (val.trim().length > 1 && !hasTypedRef.current) {
      hasTypedRef.current = true;
      typingStartRef.current = window.setTimeout(() => {
        socket.emit('typing_start', { roomId: room.id, user: currentUser });
      }, 1000);
    }
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(stopTyping, 3000);
  }, [socket, room.id, currentUser, stopTyping]);

  const handleSend = (content: string) => {
    stopTyping();
    const item: Pending = {
      clientId: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      ts: Date.now(),
      status: 'sending'
    };
    updatePending(prev => [...prev, item]);
    dispatch(item);
    setInput('');
  };

  const retry = (clientId: string) => {
    const item = pendingRef.current.find(p => p.clientId === clientId);
    if (item) dispatch(item);
  };
  const discard = (clientId: string) => {
    clearTimer(clientId);
    updatePending(prev => prev.filter(p => p.clientId !== clientId));
  };

  const items: ChatListItem[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ChatListItem[] = [];
    for (const m of room.messages) {
      if (seen.has(m.id)) continue; // socket re-delivery
      seen.add(m.id);
      out.push({
        key: m.id,
        senderId: m.senderId,
        senderName: m.senderPseudonym,
        senderAvatarBg: m.senderAvatarBg,
        content: m.content,
        timestamp: m.timestamp,
        system: !!m.isSystem,
        accent: m.type === 'game_alert',
        status: !m.isSystem && m.senderId === currentUser.id ? 'sent' : undefined
      });
    }
    for (const p of pending) {
      out.push({
        key: p.clientId,
        senderId: currentUser.id,
        senderName: currentUser.pseudonym,
        content: p.content,
        timestamp: p.ts,
        status: p.status,
        error: p.error
      });
    }
    return out;
  }, [room.messages, pending, currentUser.id, currentUser.pseudonym]);

  const otherTyping = (typingUsers || []).filter(u => u.userId !== currentUser.id);
  const online = room.userCount || room.users.length;
  const title = room.lineName || room.stationName;
  const subtitle = [room.stationName !== title ? room.stationName : null, room.direction].filter(Boolean).join(' · ');

  const typingNames = otherTyping.map(u => u.pseudonym);
  const typingText = typingNames.length === 0 ? ''
    : typingNames.length === 1 ? `${typingNames[0]} is typing…`
    : typingNames.length === 2 ? `${typingNames[0]} and ${typingNames[1]} are typing…`
    : `${typingNames.length} people are typing…`;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        ...(keyboardHeight ? { height: keyboardHeight } : { bottom: 0 }),
        maxWidth: 520,
        margin: '0 auto',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-canvas)'
      }}
    >
      {/* Header — who's in this conversation */}
      <div
        className="glass"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '8px 12px 8px 4px',
          paddingTop: 'calc(8px + var(--safe-top))',
          borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
          borderBottom: '1px solid var(--border-card)'
        }}
      >
        <button onClick={onBack} aria-label="Leave chat" className="icon-btn" style={{ background: 'transparent', border: 'none' }}>
          <ArrowLeft size={22} />
        </button>
        <span
          aria-hidden="true"
          style={{ width: 10, height: 10, borderRadius: '50%', background: room.lineColor || 'var(--accent-purple)', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </div>
          )}
        </div>
        <span
          aria-label={`${online} ${online === 1 ? 'person' : 'people'} in this room`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)'
          }}
        >
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: online > 0 ? 'var(--presence-active)' : 'var(--presence-other)' }} />
          <Users size={14} aria-hidden="true" /> {online}
        </span>
      </div>

      {/* Pinned room rules */}
      {showPinned && (
        <div
          style={{
            margin: '8px 12px 0', padding: '4px 4px 4px 12px', flexShrink: 0,
            borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)',
            border: '1px solid var(--border-purple)', display: 'flex', gap: 8, alignItems: 'center'
          }}
        >
          <Pin size={16} aria-hidden="true" style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, padding: '6px 0' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Room rules:</strong> be kind, no spam, and don't share personal info.
          </div>
          <button
            onClick={() => { setShowPinned(false); try { sessionStorage.setItem(PINNED_KEY, '1'); } catch { /* private mode */ } }}
            aria-label="Dismiss room rules"
            className="tap-target"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      <MessageList
        items={items}
        currentUserId={currentUser.id}
        showSenders
        ariaLabel={`${title} room messages`}
        onRetry={retry}
        onDiscard={discard}
        empty={
          <div style={{ textAlign: 'center', maxWidth: 260 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>It's quiet in here</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
              {online > 1 ? `${online - 1} other ${online - 1 === 1 ? 'person is' : 'people are'} in this room. Say hi!` : 'Be the first to say hi.'}
            </p>
          </div>
        }
        onBubbleTap={onReaction ? (item) => {
          const d = lastDismiss.current;
          if (d && d.key === item.key && Date.now() - d.at < 400) return;
          setReactKey(k => k === item.key ? null : item.key);
        } : undefined}
        renderAfter={onReaction ? (item) => {
          if (item.system || (item.status && item.status !== 'sent')) return null;
          const r = reactions?.[item.key];
          const hasAny = !!r && Object.values(r.counts || {}).some(c => c > 0);
          // Like chat apps: reactions show when there are some; the add
          // button appears after tapping the bubble.
          if (!hasAny && reactKey !== item.key) return null;
          return (
            <ReactionBar
              key={`${item.key}:${reactKey === item.key ? 'open' : 'closed'}`}
              targetId={item.key}
              targetType="message"
              roomId={room.id}
              compact
              alignEnd={item.senderId === currentUser.id}
              counts={r?.counts || {}}
              myReactions={Object.entries(r?.users || {}).filter(([, ids]) => ids.includes(currentUser.id)).map(([e]) => e)}
              defaultOpen={reactKey === item.key}
              onDismiss={() => {
                lastDismiss.current = { key: item.key, at: Date.now() };
                setReactKey(k => (k === item.key ? null : k));
              }}
              onToggle={(emoji) => { onReaction(item.key, emoji); setReactKey(null); }}
            />
          );
        } : undefined}
        footer={typingText ? (
          <div
            aria-live="polite"
            style={{
              display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'flex-start', marginTop: 10,
              padding: '8px 12px', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)'
            }}
          >
            <span aria-hidden="true" style={{ display: 'flex', gap: 3 }}>
              {[0, 0.2, 0.4].map(d => (
                <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `pulseGlow 1s infinite ${d}s` }} />
              ))}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{typingText}</span>
          </div>
        ) : null}
      />

      <ChatComposer
        id="room-composer"
        value={input}
        onChange={v => { setInput(v); handleTyping(v); }}
        onSend={handleSend}
        ariaLabel={`Message ${title} room`}
        maxLength={MAX_LEN}
        safeAreaBottom={false}
      />

      <div
        style={{
          padding: '2px 0 4px', paddingBottom: keyboardHeight ? 4 : 'calc(4px + var(--safe-bottom))',
          textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0
        }}
      >
        <Shield size={11} aria-hidden="true" /> Ephemeral · clears after your commute
      </div>
    </div>
  );
};
