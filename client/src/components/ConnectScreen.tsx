import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, MessageCircle, UserPlus, Inbox, Send, Users, WifiOff, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import type { Socket } from 'socket.io-client';
import { API } from '../config';
import { authHeaders } from '../utils/auth';
import { triggerHaptic } from '../utils/nativeBridge';


interface Props {
  currentUser: UserProfile;
  socket: Socket | null;
  /** Opens a 1:1 chat with an accepted friend. The Message button is hidden until wired. */
  onOpenChat?: (friendId: string) => void;
  /** Shows the "Safety Centre" shortcut when provided. */
  onOpenSafetyCenter?: () => void;
  /** @deprecated kept for older call sites; use onOpenChat. */
  onSelectFriend?: (friend: unknown) => void;
}

type Tab = 'received' | 'sent' | 'friends';

interface RequestRow {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: number;
  contextLine?: string;
  contextStation?: string;
  fromProfile?: Partial<UserProfile> | null;
  toProfile?: Partial<UserProfile> | null;
}

interface FriendRow {
  id: string;
  profile: Partial<UserProfile> | null;
}

const displayName = (p: Partial<UserProfile> | null | undefined, fallbackId: string) =>
  p?.pseudonym || p?.username?.replace(/^@/, '') || `Commuter ${fallbackId.slice(-4)}`;

const tagLine = (p: Partial<UserProfile> | null | undefined) =>
  (p?.interestTags || [])
    .map(id => INTEREST_TAXONOMY.find(t => t.id === id)?.label)
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

async function requestConnections(): Promise<{ incoming: RequestRow[]; outgoing: RequestRow[]; friends: FriendRow[] }> {
  const res = await fetch(`${API}/api/connections`, { headers: authHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  const d = await res.json();
  return { incoming: d.pending?.incoming || [], outgoing: d.pending?.outgoing || [], friends: d.friends || [] };
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * Friends & requests. Reads GET /api/connections (authenticated) and acts via
 * the REST accept/decline routes. Accept/decline are optimistic: the row moves
 * immediately and is put back, with a message, if the server refuses.
 */
export const ConnectScreen: React.FC<Props> = ({ currentUser, socket, onOpenChat, onOpenSafetyCenter }) => {
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<RequestRow[]>([]);
  const [sent, setSent] = useState<RequestRow[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  // Without this, a pending or failed fetch renders the empty state — "no requests"
  // is indistinguishable from "server is down".
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const flash = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // State is only set once the request settles. A failed background refresh
  // keeps the list the user is looking at.
  const load = useCallback((quiet = false) => {
    requestConnections().then(
      d => {
        setReceived(d.incoming);
        setSent(d.outgoing);
        setFriends(d.friends);
        setStatus('ready');
      },
      () => { if (!quiet) setStatus('error'); }
    );
  }, []);

  useEffect(() => { load(); }, [load, currentUser.id]);

  const retry = () => {
    setStatus('loading');
    load();
  };

  // Socket events (new mutual connection, results of socket-sent requests) → quiet refresh.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load(true);
    socket.on('connection_result', refresh);
    socket.on('connection_accepted', refresh);
    return () => { socket.off('connection_result', refresh); socket.off('connection_accepted', refresh); };
  }, [socket, load]);

  const setBusy = (id: string, on: boolean) =>
    setBusyIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const respond = async (req: RequestRow, action: 'accept' | 'decline') => {
    if (busyIds.has(req.id)) return;
    triggerHaptic(action === 'accept' ? 'success' : 'light');
    const name = displayName(req.fromProfile, req.fromUserId);

    // Optimistic: remove from Received, and add to Friends on accept.
    const prevReceived = received;
    const prevFriends = friends;
    setReceived(list => list.filter(r => r.id !== req.id));
    if (action === 'accept') {
      setFriends(list => list.some(f => f.id === req.fromUserId)
        ? list
        : [{ id: req.fromUserId, profile: req.fromProfile || null }, ...list]);
    }
    setBusy(req.id, true);

    try {
      const res = await fetch(`${API}/api/connections/${encodeURIComponent(req.id)}/${action}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `error ${res.status}`);
      }
      flash('ok', action === 'accept' ? `You and ${name} are now Metro friends.` : `Request from ${name} declined. They won’t be notified.`);
    } catch (err) {
      // Roll back to exactly what the user saw before tapping.
      setReceived(prevReceived);
      setFriends(prevFriends);
      flash('error', err instanceof TypeError
        ? 'No connection — nothing changed. Try again when you’re back online.'
        : `Couldn’t ${action} (${err instanceof Error ? err.message : 'unknown error'}).`);
    } finally {
      setBusy(req.id, false);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'received', label: 'Requests', count: received.length },
    { id: 'sent', label: 'Sent', count: sent.length },
    { id: 'friends', label: 'Friends', count: friends.length }
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>

      <div
        role="tablist"
        aria-label="Connections"
        style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', marginBottom: 16 }}
      >
        {tabs.map(t => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`connect-tab-${t.id}`}
              aria-selected={selected}
              aria-controls="connect-panel"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, minHeight: 44, borderRadius: 'var(--radius-full)', border: 'none',
                background: selected ? 'var(--accent)' : 'transparent',
                color: selected ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
              }}
            >
              {t.label}
              {status === 'ready' && t.count > 0 && (
                <span
                  aria-label={`${t.count}`}
                  style={{
                    minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
                    background: selected ? 'rgba(255,255,255,0.25)' : t.id === 'received' ? 'var(--status-danger)' : 'var(--bg-surface-raised)',
                    color: selected || t.id === 'received' ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          style={{
            marginBottom: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: '18px',
            background: 'var(--bg-card)', border: '1px solid var(--border-card)',
            borderLeft: `4px solid ${notice.kind === 'error' ? 'var(--status-danger)' : 'var(--status-success)'}`,
            color: 'var(--text-primary)'
          }}
        >
          {notice.text}
        </div>
      )}

      <div id="connect-panel" role="tabpanel" aria-labelledby={`connect-tab-${tab}`}>
        {status === 'loading' && (
          <div aria-busy="true" aria-label="Loading connections" className="list-group">
            {[0, 1, 2].map(i => (
              <div key={i} className="list-row" style={{ minHeight: 72 }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '45%', height: 12 }} />
                  <div className="skeleton" style={{ width: '70%', height: 10, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="empty-state-card">
            <WifiOff size={28} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Couldn’t load your connections</h2>
            <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0, maxWidth: 280 }}>
              The CoRide server didn’t respond. Check your internet and try again.
            </p>
            <button type="button" onClick={retry} className="pill-button primary">Try again</button>
          </div>
        )}

        {status === 'ready' && tab === 'received' && (
          received.length === 0 ? (
            <Empty icon={<Inbox size={32} />} title="No requests right now" body="When someone on your line sends you a request, it shows up here." />
          ) : (
            <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
              {received.map(req => {
                const p = req.fromProfile;
                const name = displayName(p, req.fromUserId);
                const tags = tagLine(p);
                const busy = busyIds.has(req.id);
                return (
                  <li key={req.id} className="list-row" style={{ minHeight: 72 }}>
                    <Avatar name={name} bg={p?.avatarBg} />
                    <span className="row-text">
                      <span className="row-title">{name}</span>
                      {p?.bio ? <span className="row-sub">{p.bio}</span> : tags && <span className="row-sub">{tags}</span>}
                      <span className="row-sub">
                        {[req.contextStation, timeAgo(req.createdAt)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => respond(req, 'decline')}
                        disabled={busy}
                        aria-label={`Decline request from ${name}`}
                      >
                        <X size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => respond(req, 'accept')}
                        disabled={busy}
                        aria-label={`Accept request from ${name}`}
                        style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--text-on-accent)' }}
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {status === 'ready' && tab === 'sent' && (
          sent.length === 0 ? (
            <Empty icon={<Send size={32} />} title="No pending requests" body="Tap someone in a station room and choose Send request. It stays here until they respond." />
          ) : (
            <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
              {sent.map(req => {
                const p = req.toProfile;
                const name = displayName(p, req.toUserId);
                return (
                  <li key={req.id} className="list-row" style={{ minHeight: 72 }}>
                    <Avatar name={name} bg={p?.avatarBg} />
                    <span className="row-text">
                      <span className="row-title">{name}</span>
                      <span className="row-sub">Sent {timeAgo(req.createdAt)}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning)', flexShrink: 0 }}>Waiting</span>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {status === 'ready' && tab === 'friends' && (
          friends.length === 0 ? (
            <Empty icon={<Users size={32} />} title="No Metro friends yet" body="Accept a request, or send one to someone in your station room. Friends can chat after your ride." />
          ) : (
            <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
              {friends.map(f => {
                const name = displayName(f.profile, f.id);
                const tags = tagLine(f.profile);
                return (
                  <li key={f.id} className="list-row" style={{ minHeight: 72 }}>
                    <Avatar name={name} bg={f.profile?.avatarBg} />
                    <span className="row-text">
                      <span className="row-title">{name}</span>
                      {tags && <span className="row-sub">{tags}</span>}
                    </span>
                    {onOpenChat && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => { triggerHaptic('light'); onOpenChat(f.id); }}
                        aria-label={`Message ${name}`}
                      >
                        <MessageCircle size={18} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>

      {/* How connecting works — explains the consent model */}
      <section aria-labelledby="connect-how" style={{ marginTop: 8 }}>
        <h2 id="connect-how" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple-text)', margin: '0 4px 8px' }}>
          How connecting works
        </h2>
        <ol className="list-group" style={{ listStyle: 'none', padding: 0 }}>
          <li className="list-row" style={{ cursor: 'default' }}>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><UserPlus size={20} /></span>
            <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)' }}>Send a request to someone in your station room.</span>
          </li>
          <li className="list-row" style={{ cursor: 'default' }}>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Check size={20} /></span>
            <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)' }}>If they accept, you’re Metro friends. Declines are silent.</span>
          </li>
          <li className="list-row" style={{ cursor: 'default' }}>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><MessageCircle size={20} /></span>
            <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)' }}>Only friends can message each other — strangers can’t.</span>
          </li>
          {onOpenSafetyCenter && (
            <li style={{ listStyle: 'none' }}>
              <button type="button" className="list-row navigable" onClick={() => { triggerHaptic('light'); onOpenSafetyCenter(); }} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><ShieldCheck size={20} /></span>
                <span className="row-text">
                  <span className="row-title">Safety Centre</span>
                  <span className="row-sub">Report, block and helplines</span>
                </span>
              </button>
            </li>
          )}
        </ol>
      </section>
    </div>
  );
};

function Avatar({ name, bg }: { name: string; bg?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 48, height: 48, flexShrink: 0, borderRadius: '50%', background: bg || 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: 18
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="empty-state-card" style={{ marginBottom: 20 }}>
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0, maxWidth: 300 }}>{body}</p>
    </div>
  );
}
