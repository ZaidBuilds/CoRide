import { useState, useEffect } from 'react';
import { ArrowLeft, Unlock, ShieldAlert } from 'lucide-react';
import { authHeaders } from '../../utils/auth';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';


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

export const BlockedUsersScreen: React.FC<BlockedUsersScreenProps> = ({ onBack, onUnblocked }) => {
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/blocks`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setBlockedList(d.blockedUsers || []);
      })
      .catch(() => {
        setBlockedList([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUnblock = async (targetId: string) => {
    triggerHaptic('medium');
    setUnblockingId(targetId);
    try {
      const res = await fetch(`${API}/api/blocks/${targetId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        setBlockedList(prev => prev.filter(u => u.id !== targetId));
        onUnblocked?.(targetId);
      }
    } catch (err) {
      console.error('[unblock] failed', err);
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: '16px 14px calc(24px + env(safe-area-inset-bottom))',
        maxWidth: 520,
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--bg-base)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => {
            triggerHaptic('light');
            onBack();
          }}
          className="icon-btn touch-target-44"
          aria-label="Back"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Blocked Users
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {blockedList.length} commuters blocked
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Loading blocked list…
        </div>
      ) : blockedList.length === 0 ? (
        <div
          className="empty-state-card"
          style={{
            marginTop: 40,
            padding: '36px 20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(5, 150, 105, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mint-500)',
              marginBottom: 12
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            No Blocked Commuters
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280, margin: '6px 0 0' }}>
            Users you block will appear here. Blocking is bidirectional: they cannot see you in carriages or message you.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {blockedList.map(u => {
            const name = u.pseudonym || u.username?.replace('@', '') || 'Commuter';
            return (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: u.avatarBg || 'var(--ink-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: 16
                  }}
                >
                  {name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    @{u.username?.replace('@', '')}
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblockingId === u.id}
                  className="press"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--signal-400)',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <Unlock size={14} />
                  {unblockingId === u.id ? 'Unblocking…' : 'Unblock'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
