import type { RoomPresenceTraveler } from '../types';

interface Props {
  traveler: RoomPresenceTraveler;
  /** Epoch ms. Omitted when the presence payload doesn't carry it (it currently doesn't). */
  joinedAt?: number;
  /** id the parent sheet points aria-labelledby at. */
  titleId?: string;
}

function initials(t: RoomPresenceTraveler): string {
  return (t.pseudonym || t.username).replace(/^@/, '').slice(0, 2).toUpperCase();
}

function joinedLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Display-only profile body for the ProfileSheet. No actions, no handlers —
 * ProfileSheetActions renders those below this.
 */
export function ProfileSheetContent({ traveler, joinedAt, titleId }: Props) {
  const name = traveler.pseudonym || traveler.username.replace(/^@/, '');

  return (
    <div style={{ textAlign: 'center', padding: '4px 4px 20px' }}>
      {/* Avatar — large, with live presence dot */}
      <div className="avatar-wrap" style={{ width: 88, height: 88, margin: '0 auto 14px' }}>
        <div
          className="avatar"
          style={{
            width: 88,
            height: 88,
            fontSize: 30,
            background: traveler.avatarBg || 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))'
          }}
        >
          {initials(traveler)}
        </div>
        <div
          className="avatar-dot active"
          style={{ width: 18, height: 18 }}
          title="Live now"
        />
      </div>

      <h2
        id={titleId}
        className="display"
        style={{ fontSize: 22, margin: 0, color: 'var(--text-primary)' }}
      >
        {name}
      </h2>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
        {traveler.username.startsWith('@') ? traveler.username : `@${traveler.username}`}
      </div>

      {traveler.bio && (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            margin: '14px auto 0',
            maxWidth: 340
          }}
        >
          {traveler.bio}
        </p>
      )}

      {joinedAt !== undefined && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>
          Joined {joinedLabel(joinedAt)}
        </div>
      )}
    </div>
  );
}
