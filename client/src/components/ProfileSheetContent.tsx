import type { RoomPresenceTraveler, UserProfile, ContextResult } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { getCommuteRelationship } from '../utils/commuteContext';

interface Props {
  traveler: RoomPresenceTraveler | UserProfile;
  /** Epoch ms. Omitted when the presence payload doesn't carry it. */
  joinedAt?: number;
  /** id the parent sheet points aria-labelledby at. */
  titleId?: string;
  activeRoomId?: string;
  currentContext?: ContextResult | null;
  isFriend?: boolean;
  /**
   * Interest ids the viewer shares with this traveler (from /api/rank's
   * mutualTags, or a client-side intersection). Shared tags are listed first
   * and highlighted — the single strongest "would I connect?" signal.
   */
  sharedTags?: string[];
}

type Tier = 'active' | 'nearby' | 'other';

const TIER_LABEL: Record<Tier, string> = {
  active: 'Active now',
  nearby: 'Nearby',
  other: 'Recently active'
};

function initials(t: RoomPresenceTraveler | UserProfile): string {
  return (t.pseudonym || t.username || '??').replace(/^@/, '').slice(0, 2).toUpperCase();
}

function joinedLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { id, emoji: '', label: id.replace(/_/g, ' ') };
}

/** Presence is only shown when the payload actually carries it — never assumed. */
function presenceOf(t: RoomPresenceTraveler | UserProfile): Tier | null {
  if ('presenceState' in t && t.presenceState === 'active') return 'active';
  const tier = (t as UserProfile).presenceTier;
  return tier === 'active' || tier === 'nearby' || tier === 'other' ? tier : null;
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '0 0 8px'
};

/**
 * Display-only profile body for the ProfileSheet.
 * Identity first (avatar, name, handle), then context (commute relation,
 * trust), then the decision inputs (about, shared interests, languages).
 */
export function ProfileSheetContent({ traveler, joinedAt, titleId, activeRoomId, currentContext, isFriend, sharedTags }: Props) {
  const name = traveler.pseudonym || traveler.username.replace(/^@/, '');
  const handle = traveler.username.startsWith('@') ? traveler.username : `@${traveler.username}`;
  const profile = traveler as Partial<UserProfile>;
  const actualJoined = joinedAt ?? profile.joinedAt;
  const trustBadge = profile.trustBadge;
  const trustTier = profile.trustTier;
  const vibeTagline = profile.vibeTagline;
  const languages = profile.languages?.filter(Boolean) ?? [];
  const tier = presenceOf(traveler);

  const commuteRel = getCommuteRelationship(traveler, {
    isFriend,
    activeRoomId,
    currentContext
  });

  const tags = traveler.interestTags ?? [];
  const shared = new Set((sharedTags ?? []).filter(t => tags.includes(t)));
  const orderedTags = [...tags.filter(t => shared.has(t)), ...tags.filter(t => !shared.has(t))];

  return (
    <div style={{ padding: '0 0 20px' }}>
      {/* Identity */}
      <div style={{ textAlign: 'center' }}>
        <div className="avatar-wrap" style={{ width: 96, height: 96, margin: '4px auto 14px' }}>
          <div
            className="avatar"
            aria-hidden="true"
            style={{
              width: 96,
              height: 96,
              fontSize: 32,
              fontWeight: 800,
              background: traveler.avatarBg || 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))'
            }}
          >
            {initials(traveler)}
          </div>
          {tier && (
            <div
              className={`avatar-dot ${tier}`}
              style={{ width: 20, height: 20, bottom: 4, right: 4, borderWidth: 3 }}
              aria-hidden="true"
            />
          )}
        </div>

        <h2
          id={titleId}
          className="display"
          style={{ fontSize: 24, lineHeight: 1.2, margin: 0, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}
        >
          {name}
        </h2>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {handle}
          {tier && <span> · {TIER_LABEL[tier]}</span>}
        </div>

        {/* Context chips — how you're connected right now, and trust */}
        {(commuteRel.type !== 'none' || trustBadge) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            {commuteRel.type !== 'none' && (
              <span
                title={commuteRel.description}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  minHeight: 32, padding: '6px 12px', borderRadius: 'var(--radius-full)',
                  background: commuteRel.bgColor, border: `1px solid ${commuteRel.borderColor}`,
                  color: 'var(--text-primary)', fontSize: 13, fontWeight: 700
                }}
              >
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: commuteRel.dotColor }} />
                {commuteRel.label}
              </span>
            )}
            {trustBadge && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  minHeight: 32, padding: '6px 12px', borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  color: trustTier === 'verified' || trustTier === 'trusted' ? 'var(--accent-purple-text)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 700
                }}
              >
                {trustBadge}
              </span>
            )}
          </div>
        )}
      </div>

      {vibeTagline && (
        <p style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--text-primary)', fontStyle: 'italic', textAlign: 'center', margin: '16px auto 0', maxWidth: 360 }}>
          “{vibeTagline}”
        </p>
      )}

      {traveler.bio && (
        <section style={{ marginTop: 20 }} aria-label="About">
          <h3 style={sectionLabel}>About</h3>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0, overflowWrap: 'anywhere' }}>
            {traveler.bio}
          </p>
        </section>
      )}

      {orderedTags.length > 0 && (
        <section style={{ marginTop: 20 }} aria-label="Interests">
          <h3 style={{ ...sectionLabel, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            Interests
            {shared.size > 0 && (
              <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--accent-purple-text)', fontWeight: 700 }}>
                {shared.size} in common
              </span>
            )}
          </h3>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
            {orderedTags.map(tid => {
              const meta = tagMeta(tid);
              const isShared = shared.has(tid);
              return (
                <li
                  key={tid}
                  className={`tag-pill${isShared ? ' active' : ''}`}
                  style={{ fontSize: 13, padding: '6px 12px', minHeight: 32 }}
                >
                  {meta.emoji && <span aria-hidden="true">{meta.emoji}</span>}
                  {meta.label}
                  {isShared && <span className="sr-only" style={srOnly}> (you share this)</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {languages.length > 0 && (
        <section style={{ marginTop: 20 }} aria-label="Languages">
          <h3 style={sectionLabel}>Speaks</h3>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>{languages.join(', ')}</p>
        </section>
      )}

      {actualJoined !== undefined && actualJoined > 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
          On CoRide since {joinedLabel(actualJoined)}
        </div>
      )}
    </div>
  );
}

/** Visually hidden, still announced. Inline so it doesn't depend on a global class. */
const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
};
