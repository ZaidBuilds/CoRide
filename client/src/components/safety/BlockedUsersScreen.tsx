import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, WifiOff } from 'lucide-react';
import { authHeaders } from '../../utils/auth';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';
import { ConfirmDialog } from './ConfirmDialog';

interface BlockedUser {
  id: string;
  pseudonym?: string;
  username?: string;
  avatarBg?: string;
}

interface BlockedUsersScreenProps {
  onBack: () => void;
  onUnblocked?: (userId: string) => void;
}

type Status = 'loading' | 'ready' | 'error';

async function requestBlocks(): Promise<BlockedUser[]> {
  const res = await fetch(`${API}/api/blocks`, { headers: authHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  const d = await res.json();
  return Array.isArray(d.blockedUsers) ? d.blockedUsers : [];
}

const nameOf = (u: BlockedUser) => u.pseudonym || u.username?.replace(/^@/, '') || 'Commuter';

export const BlockedUsersScreen: React.FC<BlockedUsersScreenProps> = ({ onBack, onUnblocked }) => {
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [confirmUser, setConfirmUser] = useState<BlockedUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);

  // An error must never look like "you've blocked nobody", hence the explicit status.
  const apply = useCallback((p: Promise<BlockedUser[]>) => {
    p.then(
      list => { setBlockedList(list); setStatus('ready'); },
      () => setStatus('error')
    );
  }, []);

  useEffect(() => { apply(requestBlocks()); }, [apply]);

  const retry = () => {
    setStatus('loading');
    apply(requestBlocks());
  };

  const handleUnblock = async () => {
    const target = confirmUser;
    if (!target) return;
    triggerHaptic('medium');
    setUnblocking(true);
    setUnblockError(null);
    try {
      const res = await fetch(`${API}/api/blocks/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      // 404 = the server already has no block on record; the list is just stale.
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setBlockedList(prev => prev.filter(u => u.id !== target.id));
      setConfirmUser(null);
      onUnblocked?.(target.id);
    } catch (err) {
      setUnblockError(
        err instanceof TypeError
          ? 'No connection. They’re still blocked — try again when you’re back online.'
          : `Couldn’t unblock (${err instanceof Error ? err.message : 'unknown error'}). They’re still blocked.`
      );
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); onBack(); }}
          className="icon-btn"
          aria-label="Back to profile"
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 className="display" style={{ fontSize: 24, lineHeight: '30px', color: 'var(--text-primary)', margin: 0 }}>
            Blocked people
          </h1>
          {status === 'ready' && blockedList.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {blockedList.length} {blockedList.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </div>
      </header>

      <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: '0 4px 16px' }}>
        People you block can’t see you in rooms, message you or send you requests. They aren’t told.
      </p>

      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading blocked people" className="list-group">
          {[0, 1, 2].map(i => (
            <div key={i} className="list-row">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '50%', height: 12 }} />
                <div className="skeleton" style={{ width: '30%', height: 10, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="empty-state-card">
          <WifiOff size={28} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Couldn’t load your block list</h2>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0, maxWidth: 280 }}>
            Your blocks are still in place. Check your connection and try again.
          </p>
          <button type="button" className="pill-button primary" onClick={retry}>Try again</button>
        </div>
      )}

      {status === 'ready' && blockedList.length === 0 && (
        <div className="empty-state-card">
          <ShieldCheck size={32} aria-hidden="true" style={{ color: 'var(--status-success)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>You haven’t blocked anyone</h2>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0, maxWidth: 300 }}>
            To block someone, open their profile and choose Block from the menu.
          </p>
        </div>
      )}

      {status === 'ready' && blockedList.length > 0 && (
        <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
          {blockedList.map(u => {
            const name = nameOf(u);
            return (
              <li key={u.id} className="list-row">
                <div
                  aria-hidden="true"
                  style={{
                    width: 40, height: 40, flexShrink: 0, borderRadius: '50%',
                    background: u.avatarBg || 'var(--bg-surface-raised)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFFFFF', fontWeight: 800, fontSize: 16
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="row-text">
                  <span className="row-title">{name}</span>
                  {u.username && <span className="row-sub">@{u.username.replace(/^@/, '')}</span>}
                </span>
                <button
                  type="button"
                  className="pill-button secondary"
                  onClick={() => { setUnblockError(null); setConfirmUser(u); }}
                  aria-label={`Unblock ${name}`}
                  style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}
                >
                  Unblock
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmUser !== null}
        title={`Unblock ${confirmUser ? nameOf(confirmUser) : ''}?`}
        confirmLabel="Unblock"
        busyLabel="Unblocking…"
        busy={unblocking}
        error={unblockError}
        onCancel={() => { if (!unblocking) setConfirmUser(null); }}
        onConfirm={handleUnblock}
      >
        They’ll be able to see you in rooms and send you a request again. You won’t be friends again unless you both reconnect.
      </ConfirmDialog>
    </div>
  );
};
