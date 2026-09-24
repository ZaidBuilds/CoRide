import { useCallback, useEffect, useState } from 'react';
import { ShieldCheckIcon, WifiSlashIcon } from '@phosphor-icons/react';
import { authHeaders } from '../../utils/auth';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';
import { ConfirmDialog } from './ConfirmDialog';
import { ScreenHeader } from '../ui/ScreenHeader';
import { ListGroup, ListRow } from '../ui/ListRow';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

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
        headers: authHeaders(),
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
          ? "No connection. They're still blocked. Try again when you're back online."
          : `Couldn't unblock (${err instanceof Error ? err.message : 'unknown error'}). They're still blocked.`
      );
    } finally {
      setUnblocking(false);
    }
  };

  const count = status === 'ready' && blockedList.length > 0
    ? <span className="tnum">{blockedList.length} {blockedList.length === 1 ? 'person' : 'people'}</span>
    : undefined;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <ScreenHeader title="Blocked people" subtitle={count} onBack={onBack} backLabel="Back to profile" />

      <p className="type-body" style={{ color: 'var(--text-secondary)', margin: '0 4px 16px' }}>
        People you block can't see you in rooms, message you or send you requests. They aren't told.
      </p>

      {status === 'loading' && (
        <div aria-busy="true" aria-label="Loading blocked people" className="list-group">
          {[0, 1, 2].map(i => (
            <div key={i} className="list-row">
              <Skeleton width={40} height={40} borderRadius="var(--radius-squircle)" delayMs={i * 120} />
              <div style={{ flex: 1 }}>
                <Skeleton width="50%" height={12} delayMs={i * 120} />
                <Skeleton width="30%" height={10} delayMs={i * 120} style={{ marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div role="alert">
          <EmptyState
            icon={<WifiSlashIcon size={24} />}
            title="Couldn't load your block list"
            description="Your blocks are still in place. Check your connection and try again."
            action={{ label: 'Try again', onClick: retry }}
          />
        </div>
      )}

      {status === 'ready' && blockedList.length === 0 && (
        <EmptyState
          icon={<ShieldCheckIcon size={24} />}
          title="You haven't blocked anyone"
          description="To block someone, open their profile and choose Block from the menu."
        />
      )}

      {status === 'ready' && blockedList.length > 0 && (
        <ListGroup label="Blocked people" className="stagger">
          {blockedList.map(u => {
            const name = nameOf(u);
            return (
              <ListRow
                key={u.id}
                leading={<Avatar name={name} seed={u.id} bg={u.avatarBg} size={40} />}
                title={name}
                subtitle={u.username ? `@${u.username.replace(/^@/, '')}` : undefined}
                trailing={
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    onClick={() => { setUnblockError(null); setConfirmUser(u); }}
                    aria-label={`Unblock ${name}`}
                  >
                    Unblock
                  </Button>
                }
              />
            );
          })}
        </ListGroup>
      )}

      <ConfirmDialog
        open={confirmUser !== null}
        title={`Unblock ${confirmUser ? nameOf(confirmUser) : ''}?`}
        confirmLabel="Unblock"
        busyLabel="Unblocking"
        busy={unblocking}
        error={unblockError}
        onCancel={() => { if (!unblocking) setConfirmUser(null); }}
        onConfirm={handleUnblock}
      >
        They'll be able to see you in rooms and send you a request again. You won't be friends again unless you both reconnect.
      </ConfirmDialog>
    </div>
  );
};
