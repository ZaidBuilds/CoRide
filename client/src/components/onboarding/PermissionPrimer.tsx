import React from 'react';
import { MapPinIcon, EyeSlashIcon, ClockIcon, TrashIcon, TrainSimpleIcon } from '@phosphor-icons/react';

/**
 * Prominent disclosure shown BEFORE the OS location prompt (Google Play User
 * Data policy). It must say what is collected, why, when, and whether it is
 * shared, and offer a real alternative. Actions are rendered by the parent
 * (sticky footer in OnboardingScreen) so they stay in thumb reach.
 *
 * Keep this copy in sync with server/public/privacy.html.
 */
interface PermissionPrimerProps {
  /** The OS prompt was answered "Don't allow" (or location is unavailable). */
  denied?: boolean;
}

const POINTS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <TrainSimpleIcon size={22} />,
    title: 'Finds your station for you',
    body: 'Your location is used to work out which station, line and direction you are on, so you land in the right room.',
  },
  {
    icon: <ClockIcon size={22} />,
    title: 'Only while CoRide is open',
    body: 'No background tracking. Location stops when you leave the app.',
  },
  {
    icon: <EyeSlashIcon size={22} />,
    title: 'Never shown to other riders',
    body: 'Others see only that you are in the same station or line room, never your coordinates.',
  },
  {
    icon: <TrashIcon size={22} />,
    title: 'Not stored',
    body: 'Coordinates are processed in real time and are not saved on our servers.',
  },
];

export const PermissionPrimer: React.FC<PermissionPrimerProps> = ({ denied = false }) => (
  <div className="animate-fade-in">
    <div className="empty-state-icon" aria-hidden="true" style={{ width: 56, height: 56, margin: '12px 0 20px' }}>
      <MapPinIcon size={28} weight="fill" />
    </div>
    <p className="type-meta" style={{ color: 'var(--text-muted)' }}>Location</p>
    <h1 className="type-display" style={{ color: 'var(--text-primary)', margin: '4px 0 8px' }}>
      Use your location to find your station?
    </h1>
    <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
      CoRide collects your device location while the app is open to detect your metro station and show people riding
      with you. Underground, it may guess. You can always correct it.
    </p>

    {denied && (
      <div role="alert" className="offline-banner" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <MapPinIcon size={22} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
        <p className="type-label" style={{ fontWeight: 420, color: 'var(--text-primary)' }}>
          Location is off. Pick your station yourself and everything works the same. To turn location on later, go to
          Android Settings, then Apps, CoRide, Permissions.
        </p>
      </div>
    )}

    <ul className="list-group" style={{ listStyle: 'none' }}>
      {POINTS.map(p => (
        <li key={p.title} className="list-row" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
          <span aria-hidden="true" className="row-lead" style={{ color: 'var(--text-primary)', marginTop: 1 }}>{p.icon}</span>
          <span className="row-text">
            <span className="row-title" style={{ whiteSpace: 'normal' }}>{p.title}</span>
            <span className="row-sub" style={{ whiteSpace: 'normal', color: 'var(--text-secondary)' }}>{p.body}</span>
          </span>
        </li>
      ))}
    </ul>
  </div>
);
