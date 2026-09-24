import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwiseIcon, ChatCircleIcon, LockSimpleIcon, WifiSlashIcon } from '@phosphor-icons/react';
import type { Socket } from 'socket.io-client';
import { authHeaders } from '../utils/auth';
import { API } from '../config';
import { Avatar } from './ui/Avatar';
import { EmptyState } from './ui/EmptyState';
import { IconButton } from './ui/IconButton';
import { ListGroup, ListRow } from './ui/ListRow';
import { ScreenHeader } from './ui/ScreenHeader';
import { Skeleton } from './ui/Skeleton';

/** Minimal peer info the app needs to open a thread. */
export interface ChatPeer {
  id: string;
  pseudonym?: string;
  username?: string;
  avatarBg?: string;
  favoriteLineId?: string;
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
  /** Optional: where the empty state sends people ("Find people"). */
  onFindPeople?: () => void;
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
export const ChatsScreen: React.FC<Props> = ({ friends, onSelect, socket = null, onFindPeople }) => {
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
      <ScreenHeader
        title="Chats"
        size="large"
        subtitle={totalUnread > 0 ? <span className="tnum">{totalUnread} unread</span> : undefined}
        actions={!loading ? (
          <IconButton label="Refresh chats" variant="plain" onClick={manualRefresh} disabled={refreshing}>
            <ArrowClockwiseIcon size={22} aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />
          </IconButton>
        ) : undefined}
      />

      {error && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '0 4px 0 16px', borderRadius: 'var(--radius-card)',
            background: 'var(--bg-surface)', boxShadow: 'inset 4px 0 0 var(--status-warn)', overflow: 'hidden'
          }}
        >
          <WifiSlashIcon size={18} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
          <span className="type-meta" style={{ flex: 1, color: 'var(--text-secondary)', padding: '12px 0' }}>{error}</span>
          <button type="button" onClick={manualRefresh} className="link-btn">Retry</button>
        </div>
      )}

      {loading && (
        <div className="list-group" aria-busy="true">
          <span className="sr-only">Loading chats</span>
          {[0, 1, 2, 3].map(i => (
            <div key={i} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 76, borderTop: i ? '1px solid var(--border-subtle)' : undefined }}>
              <Skeleton width={48} height={48} borderRadius="var(--radius-squircle)" delayMs={i * 90} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <Skeleton width="36%" height={14} delayMs={i * 90 + 40} />
                  <Skeleton width={40} height={12} delayMs={i * 90 + 60} />
                </div>
                <Skeleton width="68%" height={12} delayMs={i * 90 + 80} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon={<ChatCircleIcon size={24} />}
          title="No chats yet"
          description="When someone accepts your connection request, your conversation shows up here."
          action={onFindPeople ? { label: 'Find people on your line', onClick: onFindPeople } : undefined}
        />
      )}

      {!loading && rows.length > 0 && (
        <ul className="list-group stagger" style={{ listStyle: 'none', margin: '0 0 24px', padding: 0 }}>
          {rows.map((c, i) => {
            const name = displayName(c.peer);
            const unread = c.unread > 0;
            // 1:1 thread keyed by peer id — anything not from the peer is ours.
            const mine = !!c.lastMessage && c.lastMessage.senderId !== c.id;
            const preview = c.lastMessage
              ? `${mine ? 'You: ' : ''}${c.lastMessage.content}`
              : 'Connected. Say hi';
            const label = [
              `Chat with ${name}`,
              unread ? `${c.unread} unread` : null,
              c.lastMessage ? `last message ${relativeTime(c.lastMessage.timestamp)}: ${preview}` : 'no messages yet'
            ].filter(Boolean).join(', ');
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id, c.peer)}
                  aria-label={label}
                  className="list-row"
                  style={{ minHeight: 76, padding: '0 16px', gap: 12, cursor: 'pointer', alignItems: 'stretch' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Avatar name={name} seed={c.id} bg={c.peer.avatarBg} size={48} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span className="type-label" style={{ fontSize: 16, lineHeight: '22px', fontWeight: unread ? 650 : 560, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </span>
                      {c.lastMessage && (
                        <span className="type-meta tnum" style={{ flexShrink: 0, fontWeight: unread ? 600 : 480, color: unread ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {relativeTime(c.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span
                        className="type-meta"
                        style={{
                          flex: 1, minWidth: 0, fontSize: 14, lineHeight: '19px',
                          color: unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: unread ? 520 : 420,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                      >
                        {preview}
                      </span>
                      {unread && (
                        <span
                          aria-hidden="true"
                          className="tnum"
                          style={{
                            minWidth: 22, height: 22, padding: '0 7px', borderRadius: 'var(--radius-pill)',
                            background: 'var(--signal)', color: 'var(--ink-fixed)',
                            fontSize: 12, fontWeight: 650, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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

      <ListGroup>
        <ListRow
          leading={<LockSimpleIcon size={22} />}
          title="Only your connections can message you"
          subtitle="Report or block anyone from the menu inside a chat."
          wrap
        />
      </ListGroup>
    </div>
  );
};
