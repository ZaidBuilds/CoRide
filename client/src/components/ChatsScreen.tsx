import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, MessageCircle, RefreshCw, WifiOff } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

/** Minimal peer info the app needs to open a thread. */
export interface ChatPeer {
  id: string;
  pseudonym?: string;
  username?: string;
  avatarBg?: string;
}

interface ChatSummary {
  id: string;
  peer: ChatPeer;
  lastMessage: { content: string; timestamp: number; senderId: string } | null;
  unread: number;
}

/** Shape of App's friends list (MetroFriend) — only what we read from it. */
interface FriendLike {
  id?: string;
  friendId?: string;
  friendProfile?: ChatPeer;
  profile?: ChatPeer;
}

interface Props {
  friends: FriendLike[];
  /** Called with the peer id; `peer` lets the caller open a thread for a
   *  friend its own list hasn't loaded yet. */
  onSelect: (id: string, peer?: ChatPeer) => void;
  /** Optional — when given, a new_dm refreshes previews/unread instantly. */
  socket?: Socket | null;
}

const REFRESH_MS = 20000;

function displayName(p: ChatPeer | null | undefined): string {
  return p?.pseudonym || p?.username?.replace(/^@/, '') || 'Friend';
}

function relativeTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const ageDays = (now.getTime() - ms) / 86_400_000;
  if (ageDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Friends-list fallback, used only if /api/chats can't be reached. */
function fromFriends(friends: FriendLike[]): ChatSummary[] {
  return friends.map(f => {
    const p = f.friendProfile || f.profile || null;
    const id = f.friendId || f.id || p?.id || '';
    return { id, peer: { ...(p || {}), id }, lastMessage: null, unread: 0 };
  }).filter(c => c.id);
}

/**
 * Chat list — one row per accepted connection, straight from /api/chats
 * (last message, real unread count from the server's read markers), newest
 * activity first. Nothing here is fabricated.
 */
export const ChatsScreen: React.FC<Props> = ({ friends, onSelect, socket = null }) => {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const res = await fetch(`${API}/api/chats`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      if (mySeq !== seq.current) return;
      const list: ChatSummary[] = (json.chats || []).map((c: ChatSummary) => ({
        id: c.id,
        peer: { ...(c.peer || {}), id: c.id },
        lastMessage: c.lastMessage || null,
        unread: Number(c.unread) || 0
      }));
      setChats(list);
      setError(null);
    } catch {
      if (mySeq !== seq.current) return;
      setError(navigator.onLine === false
        ? "You're offline. Showing your connections."
        : "Couldn't refresh chats.");
    } finally {
      if (mySeq === seq.current) setRefreshing(false);
    }
  }, []);

  const manualRefresh = () => {
    setRefreshing(true);
    void load();
  };

  // Load on mount, refresh while visible, and whenever the page comes back.
  useEffect(() => {
    // All state updates in load() happen after its fetch resolves.
    void Promise.resolve().then(load);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
    };
  }, [load]);

  // A live DM bumps the list immediately (debounced for bursts).
  useEffect(() => {
    if (!socket) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onDm = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => load(), 300);
    };
    socket.on('new_dm', onDm);
    return () => { socket.off('new_dm', onDm); if (t) clearTimeout(t); };
  }, [socket, load]);

  // If the server list isn't available yet/at all, fall back to the friends
  // we already know about so the screen is never falsely empty.
  // The server's peer profile can be missing for someone who isn't in a
  // room right now — fill name/colour from the app's friends list.
  const known = new Map(fromFriends(friends).map(f => [f.id, f.peer]));
  const rows: ChatSummary[] = (chats ?? (error ? fromFriends(friends) : [])).map(c => {
    const k = known.get(c.id);
    if (!k || (c.peer.pseudonym && c.peer.avatarBg)) return c;
    return { ...c, peer: { ...k, ...Object.fromEntries(Object.entries(c.peer).filter(([, v]) => v)), id: c.id } };
  });
  const loading = chats === null && !error;
  const totalUnread = rows.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, minHeight: 48 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
          Chats
          {totalUnread > 0 && <span className="sr-only">, {totalUnread} unread</span>}
        </h1>
        {!loading && (
          <button
            onClick={manualRefresh}
            className="icon-btn"
            aria-label="Refresh chats"
            disabled={refreshing}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {error && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 13,
            color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)'
          }}
        >
          <WifiOff size={15} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={manualRefresh} className="press" style={{ minHeight: 40, padding: '0 10px', background: 'none', border: 'none', color: 'var(--accent-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="list-group" aria-busy="true">
          <span className="sr-only">Loading chats</span>
          {[0, 1, 2].map(i => (
            <div key={i} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 72 }}>
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 14, width: '38%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div
          style={{
            textAlign: 'center', padding: '32px 20px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)', border: '1px solid var(--border-card)'
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
              background: 'var(--bg-surface-raised)', color: 'var(--accent-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <MessageCircle size={26} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>No chats yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            When someone accepts your connection request, you can message them here.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="list-group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((c, i) => {
            const name = displayName(c.peer);
            const unread = c.unread > 0;
            // 1:1 thread keyed by peer id — anything not from the peer is ours.
            const mine = !!c.lastMessage && c.lastMessage.senderId !== c.id;
            const preview = c.lastMessage
              ? `${mine ? 'You: ' : ''}${c.lastMessage.content}`
              : 'Connected — say hi';
            const label = [
              `Chat with ${name}`,
              unread ? `${c.unread} unread` : null,
              c.lastMessage ? `last message ${relativeTime(c.lastMessage.timestamp)}: ${preview}` : 'no messages yet'
            ].filter(Boolean).join(', ');
            return (
              <li key={c.id} style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : undefined}>
                <button
                  onClick={() => onSelect(c.id, c.peer)}
                  aria-label={label}
                  className="press"
                  style={{
                    width: '100%', minHeight: 72, display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left',
                    cursor: 'pointer', color: 'inherit'
                  }}
                >
                  <div
                    className="avatar"
                    aria-hidden="true"
                    style={{ width: 48, height: 48, fontSize: 16, boxShadow: 'none', background: c.peer.avatarBg || 'var(--accent-purple)' }}
                  >
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: unread ? 800 : 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </span>
                      {c.lastMessage && (
                        <span style={{ fontSize: 12, flexShrink: 0, fontWeight: unread ? 700 : 500, color: unread ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                          {relativeTime(c.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span
                        style={{
                          flex: 1, minWidth: 0, fontSize: 14,
                          color: unread ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: unread ? 600 : 400,
                          fontStyle: c.lastMessage ? 'normal' : 'italic',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                      >
                        {preview}
                      </span>
                      {unread && (
                        <span
                          aria-hidden="true"
                          style={{
                            minWidth: 22, height: 22, padding: '0 7px', borderRadius: 'var(--radius-full)',
                            background: 'var(--accent-purple)', color: 'var(--text-on-accent, #fff)',
                            fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: 14, background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)', flexShrink: 0 }}>
          <Lock size={16} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Only your connections can message you</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Report or block anyone from the ⋮ menu inside a chat.</div>
        </div>
      </div>
    </div>
  );
};
