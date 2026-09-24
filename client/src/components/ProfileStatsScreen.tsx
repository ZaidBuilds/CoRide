import { useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheck, UserX, Trash2, Pencil, ExternalLink, Lock, FileText, FileX, Users, Bookmark,
  SunMoon, Sun, Moon, AlertTriangle
} from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { triggerHaptic, getAppVersion } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';
import { getTheme, setTheme, type Theme } from '../utils/theme';
import { API } from '../config';
import { ConfirmDialog } from './safety/ConfirmDialog';

interface Props {
  user?: UserProfile | null;
  onEdit?: () => void;
  onOpenSafetyCenter?: () => void;
  onOpenBlockedUsers?: () => void;
  /** Friends & requests (ConnectScreen). Row is hidden until wired. */
  onOpenConnections?: () => void;
  /** Saved commutes. Row is hidden until wired. */
  onOpenSavedCommutes?: () => void;
  onAccountDeleted?: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: SunMoon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
];

/**
 * "Who am I on CoRide?" — identity plus settings, laid out as an Android-style
 * grouped settings list. Everything here is real: no stats, streaks or badges
 * until the server can back them (see SCREENS.md → MyProfile).
 */
export const ProfileStatsScreen: React.FC<Props> = ({
  user,
  onEdit,
  onOpenSafetyCenter,
  onOpenBlockedUsers,
  onOpenConnections,
  onOpenSavedCommutes,
  onAccountDeleted
}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return getTheme(); } catch { return 'system'; }
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAppVersion().then(v => { if (alive && v) setAppVersion(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const displayName = user?.pseudonym || user?.username?.replace(/^@/, '') || 'Commuter';
  const handle = user?.username?.replace(/^@/, '');
  const tags = (user?.interestTags || [])
    .map(id => INTEREST_TAXONOMY.find(t => t.id === id))
    .filter((t): t is (typeof INTEREST_TAXONOMY)[number] => Boolean(t));

  const chooseTheme = (value: Theme) => {
    triggerHaptic('light');
    try { setTheme(value); } catch { /* storage blocked — still applied for this session */ }
    setThemeState(value);
  };

  const openDelete = () => {
    triggerHaptic('medium');
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    triggerHaptic('medium');
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/api/profile/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) {
        // Nothing local is cleared: the server still holds the data, so the
        // user must be able to retry from this same session.
        if (res.status === 401 || res.status === 403) {
          setDeleteError('We couldn’t confirm this device owns the account. Close and reopen CoRide, then try again — or use the web deletion form below.');
        } else {
          setDeleteError(`The server couldn’t delete your account (error ${res.status}). Nothing was removed. Please try again.`);
        }
        setDeleting(false);
        return;
      }
      try { localStorage.clear(); } catch { /* ignore */ }
      onAccountDeleted?.();
      window.location.reload();
    } catch {
      setDeleteError('No connection to CoRide. Nothing was deleted — check your internet and try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 16, maxWidth: 520, margin: '0 auto' }}>
      <h1 className="display" style={{ fontSize: 28, lineHeight: '34px', color: 'var(--text-primary)', margin: '4px 4px 16px' }}>
        Profile
      </h1>

      {/* Identity — exactly what other riders see */}
      <section
        aria-label="Your public profile"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: 64,
              height: 64,
              flexShrink: 0,
              borderRadius: '50%',
              background: user?.avatarBg || 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 26
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, lineHeight: '26px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            {handle && (
              <div style={{ fontSize: 14, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{handle}
              </div>
            )}
            {user?.vibeTagline && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{user.vibeTagline}</div>
            )}
          </div>
        </div>

        {user?.bio ? (
          <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '12px 0 0', overflowWrap: 'anywhere' }}>
            {user.bio}
          </p>
        ) : (
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-muted)', margin: '12px 0 0' }}>
            No bio yet. A line about you helps riders decide to say hi.
          </p>
        )}

        {tags.length > 0 && (
          <ul aria-label="Interests" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 0', padding: 0 }}>
            {tags.map(t => (
              <li
                key={t.id}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
              >
                <span aria-hidden="true">{t.emoji}</span> {t.label}
              </li>
            ))}
          </ul>
        )}

        {onEdit && (
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); onEdit(); }}
            className="pill-button secondary"
            style={{ width: '100%', marginTop: 16 }}
          >
            <Pencil size={16} aria-hidden="true" /> Edit profile
          </button>
        )}
      </section>

      {(onOpenConnections || onOpenSavedCommutes) && (
        <SettingsGroup title="Your commute">
          {onOpenConnections && (
            <SettingsRow icon={<Users size={20} />} title="Friends & requests" subtitle="Accept requests and see your Metro friends" onClick={onOpenConnections} />
          )}
          {onOpenSavedCommutes && (
            <SettingsRow icon={<Bookmark size={20} />} title="Saved commutes" subtitle="Your usual routes, one tap to check in" onClick={onOpenSavedCommutes} />
          )}
        </SettingsGroup>
      )}

      <SettingsGroup title="Safety">
        <SettingsRow
          icon={<ShieldCheck size={20} />}
          title="Safety Centre"
          subtitle="Community rules, reporting and helplines"
          onClick={onOpenSafetyCenter}
        />
        <SettingsRow
          icon={<UserX size={20} />}
          title="Blocked people"
          subtitle="See and unblock people you’ve blocked"
          onClick={onOpenBlockedUsers}
        />
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <div className="list-row" style={{ flexWrap: 'wrap', cursor: 'default' }}>
          <span className="row-text" style={{ flex: '1 1 140px' }}>
            <span className="row-title" id="theme-label">Theme</span>
            <span className="row-sub">System follows your phone’s setting</span>
          </span>
          <div
            role="radiogroup"
            aria-labelledby="theme-label"
            style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            {THEME_OPTIONS.map(opt => {
              const selected = theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${opt.label} theme`}
                  onClick={() => chooseTheme(opt.value)}
                  className="press"
                  style={{
                    minWidth: 48,
                    minHeight: 40,
                    padding: '0 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: selected ? 'var(--text-on-accent)' : 'var(--text-secondary)'
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Privacy & legal">
        <SettingsRow
          icon={<Lock size={20} />}
          title="Privacy policy"
          subtitle="What we collect and why"
          href={`${API}/privacy`}
        />
        <SettingsRow
          icon={<FileText size={20} />}
          title="Terms of use"
          subtitle="Community rules and 18+ requirement"
          href={`${API}/terms`}
        />
        <SettingsRow
          icon={<FileX size={20} />}
          title="Delete account from the web"
          subtitle="Deletion steps if you lose this device"
          href={`${API}/account-deletion`}
        />
      </SettingsGroup>

      <SettingsGroup title="Account & data deletion">
        <button type="button" className="list-row" onClick={openDelete} disabled={!user} style={{ cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ color: 'var(--status-danger)', display: 'flex' }}><Trash2 size={20} /></span>
          <span className="row-text">
            <span className="row-title" style={{ color: 'var(--status-danger)' }}>Delete my commuter account</span>
            <span className="row-sub">Permanently erase your profile, friends and chats</span>
          </span>
        </button>
      </SettingsGroup>

      <p style={{ textAlign: 'center', fontSize: 12, lineHeight: '16px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
        CoRide{appVersion ? ` · Version ${appVersion}` : ''}
        <br />
        For Delhi Metro commuters · 18+
      </p>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        icon={<AlertTriangle size={32} aria-hidden="true" />}
        destructive
        confirmLabel="Delete forever"
        busyLabel="Deleting…"
        busy={deleting}
        error={deleteError}
        onCancel={() => { if (!deleting) setShowDeleteConfirm(false); }}
        onConfirm={handleDeleteAccount}
      >
        <p style={{ margin: 0 }}>This can’t be undone. We’ll immediately erase:</p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li>your profile, bio and interests</li>
          <li>your friends, requests and blocks</li>
          <li>your chats and saved commutes</li>
        </ul>
        <p style={{ margin: '8px 0 0' }}>
          Reports filed by or about you are kept for safety review, as our privacy policy explains.
        </p>
      </ConfirmDialog>
    </div>
  );
};

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        style={{
          fontSize: 13,
          lineHeight: '20px',
          fontWeight: 700,
          color: 'var(--accent-purple-text)',
          margin: '0 4px 8px',
          letterSpacing: '0.01em'
        }}
      >
        {title}
      </h2>
      <div className="list-group">{children}</div>
    </section>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onClick,
  href
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className="list-row"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} (opens in browser)`}
        style={{ textDecoration: 'none', cursor: 'pointer' }}
      >
        {body}
        <ExternalLink size={16} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </a>
    );
  }

  return (
    <button
      type="button"
      className="list-row navigable"
      disabled={!onClick}
      onClick={() => { triggerHaptic('light'); onClick?.(); }}
    >
      {body}
    </button>
  );
}
