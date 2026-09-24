import { useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheckIcon, ProhibitIcon, TrashIcon, PencilSimpleIcon, ArrowSquareOutIcon, LockSimpleIcon,
  FileTextIcon, UserMinusIcon, UsersThreeIcon, BookmarkSimpleIcon, WarningIcon, CircleHalfIcon, SunIcon, MoonIcon,
} from '@phosphor-icons/react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { triggerHaptic, getAppVersion } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';
import { getTheme, setTheme, type Theme } from '../utils/theme';
import { API } from '../config';
import { ConfirmDialog } from './safety/ConfirmDialog';
import { IconTile, GroupLabel } from './safety/SettingsParts';
import { ScreenHeader } from './ui/ScreenHeader';
import { Avatar } from './ui/Avatar';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { ListGroup, ListRow } from './ui/ListRow';
import { BrandMark } from './ui/BrandMark';

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

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'system', label: 'System', icon: CircleHalfIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

/** A ListRow-shaped link that opens in the browser. */
function LinkRow({ icon, title, subtitle, href }: { icon: ReactNode; title: string; subtitle?: string; href: string }) {
  return (
    <a className="list-row" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${title} (opens in browser)`} style={{ textDecoration: 'none', cursor: 'pointer' }}>
      <span className="row-lead">{icon}</span>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-sub">{subtitle}</span>}
      </span>
      <span className="row-trail"><ArrowSquareOutIcon size={18} aria-hidden="true" /></span>
    </a>
  );
}

/**
 * Profile tab: who you are on CoRide, then settings as grouped lists.
 * Everything here is real: no stats, streaks or badges until the server can
 * back them.
 */
export const ProfileStatsScreen: React.FC<Props> = ({
  user,
  onEdit,
  onOpenSafetyCenter,
  onOpenBlockedUsers,
  onOpenConnections,
  onOpenSavedCommutes,
  onAccountDeleted,
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
    try { setTheme(value); } catch { /* storage blocked: still applied for this session */ }
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
        headers: authHeaders(),
      });
      if (!res.ok) {
        // Nothing local is cleared: the server still holds the data, so the
        // user must be able to retry from this same session.
        if (res.status === 401 || res.status === 403) {
          setDeleteError("We couldn't confirm this device owns the account. Close and reopen CoRide and try again, or use the web deletion form.");
        } else {
          setDeleteError(`The server couldn't delete your account (error ${res.status}). Nothing was removed. Please try again.`);
        }
        setDeleting(false);
        return;
      }
      try { localStorage.clear(); } catch { /* ignore */ }
      onAccountDeleted?.();
      window.location.reload();
    } catch {
      setDeleteError('No connection to CoRide. Nothing was deleted. Check your internet and try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 16, maxWidth: 520, margin: '0 auto' }}>
      <ScreenHeader title="Profile" size="large" />

      {/* Identity: exactly what other riders see */}
      <section aria-label="Your public profile" style={{ padding: '8px 4px 28px' }}>
        <Avatar name={displayName} seed={user?.id} bg={user?.avatarBg} size={88} />
        <h2 className="type-display" style={{ color: 'var(--text-primary)', marginTop: 16, overflowWrap: 'anywhere' }}>{displayName}</h2>
        {handle && <p className="type-body" style={{ color: 'var(--text-muted)' }}>@{handle}</p>}
        {user?.vibeTagline && (
          <p className="type-label" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{user.vibeTagline}</p>
        )}
        {user?.bio ? (
          <p className="type-body" style={{ color: 'var(--text-secondary)', marginTop: 8, overflowWrap: 'anywhere' }}>{user.bio}</p>
        ) : (
          <p className="type-body" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            No bio yet. A line about you helps riders decide to say hi.
          </p>
        )}
        {tags.length > 0 && (
          <ul aria-label="Interests" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {tags.map(t => <li key={t.id}><Chip>{t.label}</Chip></li>)}
          </ul>
        )}
        {onEdit && (
          <Button type="button" variant="tonal" icon={<PencilSimpleIcon size={20} />} onClick={onEdit} style={{ marginTop: 20 }}>
            Edit profile
          </Button>
        )}
      </section>

      {(onOpenConnections || onOpenSavedCommutes) && (
        <section aria-labelledby="settings-commute">
          <GroupLabel id="settings-commute">Commute</GroupLabel>
          <ListGroup>
            {onOpenConnections && (
              <ListRow leading={<IconTile><UsersThreeIcon size={22} /></IconTile>} title="Friends & requests" subtitle="Accept requests, see your Metro friends" onClick={onOpenConnections} navigable />
            )}
            {onOpenSavedCommutes && (
              <ListRow leading={<IconTile><BookmarkSimpleIcon size={22} /></IconTile>} title="Saved commutes" subtitle="Your usual routes, one tap to check in" onClick={onOpenSavedCommutes} navigable />
            )}
          </ListGroup>
        </section>
      )}

      <section aria-labelledby="settings-safety">
        <GroupLabel id="settings-safety">Safety</GroupLabel>
        <ListGroup>
          {onOpenSafetyCenter && (
            <ListRow leading={<IconTile><ShieldCheckIcon size={22} /></IconTile>} title="Safety Centre" subtitle="Helplines, reporting and community rules" onClick={onOpenSafetyCenter} navigable />
          )}
          {onOpenBlockedUsers && (
            <ListRow leading={<IconTile><ProhibitIcon size={22} /></IconTile>} title="Blocked people" subtitle="See and undo blocks" onClick={onOpenBlockedUsers} navigable />
          )}
        </ListGroup>
      </section>

      <section aria-labelledby="settings-appearance">
        <GroupLabel id="settings-appearance">Appearance</GroupLabel>
        <div className="list-group" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="type-label" id="theme-label" style={{ color: 'var(--text-primary)' }}>Theme</div>
            <div className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 2 }}>System follows your phone's setting</div>
          </div>
          <div role="radiogroup" aria-labelledby="theme-label" className="segmented">
            {THEME_OPTIONS.map(opt => {
              const selected = theme === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseTheme(opt.value)}
                  className={`segmented-option${selected ? ' selected' : ''}`}
                >
                  <Icon size={18} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="settings-legal">
        <GroupLabel id="settings-legal">Privacy & legal</GroupLabel>
        <ListGroup>
          <LinkRow icon={<IconTile><LockSimpleIcon size={22} /></IconTile>} title="Privacy policy" subtitle="What we collect and why" href={`${API}/privacy`} />
          <LinkRow icon={<IconTile><FileTextIcon size={22} /></IconTile>} title="Terms of use" subtitle="Community rules and the 18+ requirement" href={`${API}/terms`} />
          <LinkRow icon={<IconTile><UserMinusIcon size={22} /></IconTile>} title="Delete from the web" subtitle="How to delete if you lose this phone" href={`${API}/account-deletion`} />
        </ListGroup>
      </section>

      {user && (
        <ListGroup>
          <ListRow
            danger
            leading={<IconTile danger><TrashIcon size={22} /></IconTile>}
            title="Delete account"
            subtitle="Erase your profile, friends and chats for good"
            onClick={openDelete}
          />
        </ListGroup>
      )}

      <footer style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
        <BrandMark size={24} wordmark />
        <p className="type-meta" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          {appVersion && <><span className="tnum">Version {appVersion}</span> · </>}For Delhi Metro commuters · 18+
        </p>
      </footer>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete your account?"
        icon={<WarningIcon size={24} aria-hidden="true" />}
        destructive
        confirmLabel="Delete for good"
        busyLabel="Deleting"
        busy={deleting}
        error={deleteError}
        onCancel={() => { if (!deleting) setShowDeleteConfirm(false); }}
        onConfirm={handleDeleteAccount}
      >
        <p>This can't be undone. We erase right away:</p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          <li>your profile, bio and interests</li>
          <li>your friends, requests and blocks</li>
          <li>your chats and saved commutes</li>
        </ul>
        <p style={{ marginTop: 8 }}>
          Reports filed by or about you are kept for safety review, as our privacy policy explains.
        </p>
      </ConfirmDialog>
    </div>
  );
};
