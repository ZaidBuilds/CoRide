import React from 'react';
import { MapPin, EyeOff, Clock, Trash2 } from 'lucide-react';

/**
 * Prominent disclosure shown BEFORE the OS location prompt (Google Play User
 * Data policy). It must say what is collected, why, when, and whether it is
 * shared — and offer a real alternative. Actions are rendered by the parent
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
    icon: <MapPin size={18} />,
    title: 'Finds your station for you',
    body: 'Your location is used to work out which station, line and direction you are on, so you land in the right room.',
  },
  {
    icon: <Clock size={18} />,
    title: 'Only while CoRide is open',
    body: 'No background tracking. Location stops when you leave the app.',
  },
  {
    icon: <EyeOff size={18} />,
    title: 'Never shown to other riders',
    body: 'Others only see that you are in the same station or line room — never your coordinates.',
  },
  {
    icon: <Trash2 size={18} />,
    title: 'Not stored',
    body: 'Coordinates are processed in real time and are not saved on our servers.',
  },
];

export const PermissionPrimer: React.FC<PermissionPrimerProps> = ({ denied = false }) => (
  <div className="animate-fade-in">
    <div className="empty-state-icon" aria-hidden="true" style={{ width: 64, height: 64, margin: '8px 0 20px' }}>
      <MapPin size={30} />
    </div>
    <h1 className="type-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
      Use your location to find your station?
    </h1>
    <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
      CoRide collects your device location while the app is open to detect your metro station and show people riding
      with you.
    </p>

    {denied && (
      <div role="alert" className="offline-banner" style={{ marginBottom: 16 }}>
        <MapPin size={18} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
        <p className="type-label" style={{ fontWeight: 400, color: 'var(--text-primary)' }}>
          Location is off. You can pick your station yourself — everything works the same. You can turn location on
          later in Android Settings → Apps → CoRide → Permissions.
        </p>
      </div>
    )}

    <ul className="list-group" style={{ listStyle: 'none' }}>
      {POINTS.map(p => (
        <li key={p.title} className="list-row" style={{ alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ color: 'var(--accent-text)', marginTop: 2 }}>{p.icon}</span>
          <span className="row-text">
            <span className="row-title" style={{ whiteSpace: 'normal' }}>{p.title}</span>
            <span className="row-sub" style={{ whiteSpace: 'normal', color: 'var(--text-secondary)', fontSize: 13, lineHeight: '18px' }}>{p.body}</span>
          </span>
        </li>
      ))}
    </ul>
  </div>
);
