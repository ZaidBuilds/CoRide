import { useState } from 'react';
import { ShieldCheck, UserX, Trash2, Edit3, EyeOff, ChevronRight, FileText, Lock } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { triggerHaptic } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';

const API = 'http://localhost:4000';

interface Props {
  user?: any;
  onEdit?: () => void;
  onOpenSafetyCenter?: () => void;
  onOpenBlockedUsers?: () => void;
  onAccountDeleted?: () => void;
}

export const ProfileStatsScreen: React.FC<Props> = ({
  user,
  onEdit,
  onOpenSafetyCenter,
  onOpenBlockedUsers,
  onAccountDeleted
}) => {
  const [ghostMode, setGhostMode] = useState(() => {
    return localStorage.getItem('coride_ghost_mode') === 'true';
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const name = user?.pseudonym?.split('_')[0] || user?.username?.replace('@', '') || 'Commuter';

  const handleGhostModeToggle = () => {
    triggerHaptic('light');
    const next = !ghostMode;
    setGhostMode(next);
    localStorage.setItem('coride_ghost_mode', String(next));
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    triggerHaptic('medium');
    setDeleting(true);
    try {
      await fetch(`${API}/api/profile/${user.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      localStorage.clear();
      onAccountDeleted?.();
      window.location.reload();
    } catch {
      localStorage.clear();
      window.location.reload();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 96, maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
          Account & Safety
        </h1>
        <ThemeToggle />
      </div>

      {/* Identity Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl)',
          padding: 16,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: user?.avatarBg || 'linear-gradient(135deg, var(--signal-500), var(--signal-600))',
              border: '3px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
              fontSize: 22
            }}
          >
            {name[0]}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
            {user?.pseudonym || name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            @{user?.username?.replace('@', '') || ''}
          </div>
          {user?.ageBand && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}
            >
              Age {user.ageBand}
            </span>
          )}
        </div>

        {onEdit && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onEdit();
            }}
            className="press touch-target-44"
            aria-label="Edit Profile"
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <Edit3 size={16} />
          </button>
        )}
      </div>

      {/* Safety & UGC Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4 }}>
          Safety & Protection
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenSafetyCenter?.();
            }}
            className="press"
            style={{
              width: '100%',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={20} style={{ color: 'var(--signal-400)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Safety Centre & Rules</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Community guidelines & DMRC helpline</div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenBlockedUsers?.();
            }}
            className="press"
            style={{
              width: '100%',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            <UserX size={20} style={{ color: 'var(--amber-500)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Blocked Commuters</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage your blocked user list</div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Privacy Controls */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4 }}>
          Privacy Controls
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <EyeOff size={20} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Ghost Mode</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hide avatar pin from connected friends on map</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={ghostMode}
            onChange={handleGhostModeToggle}
            aria-label="Toggle Ghost Mode"
            style={{ width: 22, height: 22, accentColor: 'var(--signal-500)', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Legal & Compliance (Separate Terms and Privacy) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4 }}>
          Legal & Compliance
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Terms of Use (Anti-Harassment)
            </span>
            <span style={{ color: 'var(--mint-500)', fontWeight: 600 }}>Accepted ✓</span>
          </div>

          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} /> Privacy Policy (No GPS Tracking)
            </span>
            <span style={{ color: 'var(--mint-500)', fontWeight: 600 }}>Active ✓</span>
          </div>
        </div>
      </div>

      {/* Google Play Mandatory Account Deletion */}
      <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)', borderRadius: 'var(--radius-xl)', padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rose-500)', marginBottom: 4 }}>
          Account & Data Deletion
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 12px' }}>
          Permanently delete your commuter profile, mutual friend links, chat logs, and presence keys from all servers. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="press btn-danger"
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer'
          }}
        >
          <Trash2 size={16} /> Delete My Commuter Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 9, 12, 0.8)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: 20,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.15)',
                color: 'var(--rose-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Permanently Delete Account?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.4 }}>
              All identity records, saved commutes, friendships, and direct messages will be immediately purged.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="press"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="press btn-danger"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting…' : 'Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};