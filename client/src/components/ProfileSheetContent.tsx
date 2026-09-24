import { SealCheckIcon } from '@phosphor-icons/react';
import type { RoomPresenceTraveler, UserProfile, ContextResult, ContextRoom } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { getCommuteRelationship } from '../utils/commuteContext';
import { getLineById, getStationById } from '../data/metroData';
import { lineStyle } from '../utils/lineStyle';
import { Avatar } from './ui/Avatar';
import { Chip } from './ui/Chip';
import { LinePill } from './ui/LinePill';

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
   * and filled lime: the single strongest "would I connect?" signal.
   */
  sharedTags?: string[];
  /** The room you both are in. Falls back to currentContext for the "Riding" line. */
  room?: ContextRoom | null;
}

type Tier = 'active' | 'nearby' | 'other';

const TIER_LABEL: Record<Tier, string> = {
  active: 'Active now',
  nearby: 'Nearby',
  other: 'Recently active'
};

function joinedLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function tagLabel(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id)?.label || id.replace(/_/g, ' ');
}

/** Trust badges arrive as "✅ Verified commuter": keep the words, drop the emoji. */
function trustWord(badge: string): string {
  return badge.replace(/^[^\p{L}\p{N}]+/u, '').trim() || badge;
}

/** Presence is only shown when the payload actually carries it, never assumed. */
function presenceOf(t: RoomPresenceTraveler | UserProfile): Tier | null {
  if ('presenceState' in t && t.presenceState === 'active') return 'active';
  const tier = (t as UserProfile).presenceTier;
  return tier === 'active' || tier === 'nearby' || tier === 'other' ? tier : null;
}

const Label: React.FC<{ children: React.ReactNode; id?: string; trailing?: React.ReactNode }> = ({ children, id, trailing }) => (
  <h3 id={id} className="type-meta" style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: 'var(--text-muted)', fontWeight: 560, margin: '0 0 8px' }}>
    {children}
    {trailing}
  </h3>
);

/**
 * Display-only profile body for the ProfileSheet.
 * Identity (big squircle avatar, name, handle), their vibe line, where they're
 * riding, then the decision inputs: interests (shared first, in lime),
 * about and languages.
 */
export function ProfileSheetContent({ traveler, joinedAt, titleId, activeRoomId, currentContext, isFriend, sharedTags, room }: Props) {
  const name = traveler.pseudonym || traveler.username.replace(/^@/, '');
  const handle = traveler.username.startsWith('@') ? traveler.username : `@${traveler.username}`;
  const profile = traveler as Partial<UserProfile>;
  const actualJoined = joinedAt ?? profile.joinedAt;
  const trustBadge = profile.trustBadge;
  const trusted = !!trustBadge && (profile.trustTier === 'verified' || profile.trustTier === 'trusted');
  const vibeTagline = profile.vibeTagline;
  const languages = profile.languages?.filter(Boolean) ?? [];
  const tier = presenceOf(traveler);

  const commuteRel = getCommuteRelationship(traveler, { isFriend, activeRoomId, currentContext });

  const tags = traveler.interestTags ?? [];
  const shared = new Set((sharedTags ?? []).filter(t => tags.includes(t)));
  const orderedTags = [...tags.filter(t => shared.has(t)), ...tags.filter(t => !shared.has(t))];

  // Where they're riding: the shared room (never coordinates, DESIGN.md §9).
  const lineId = room?.lineId || (activeRoomId ? currentContext?.line : undefined);
  const line = lineId ? getLineById(lineId) : undefined;
  const stationId = room?.stationId || (activeRoomId ? currentContext?.station : undefined);
  const station = stationId ? (line?.stations.find(s => s.id === stationId) || getStationById(stationId)) : undefined;
  const stationName = station?.name || room?.stationName || (activeRoomId ? currentContext?.stationName : undefined);
  const towards = (room?.direction || (activeRoomId ? currentContext?.direction : '') || '').replace(/^Towards\s+/i, '').trim();

  return (
    <div style={{ padding: '4px 0 24px' }}>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name={name} seed={traveler.id} bg={traveler.avatarBg} size={88} presence={tier ?? undefined} style={{ fontSize: 32 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id={titleId} className="type-title" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: 6 }}>
            {name}
            {trusted && <SealCheckIcon size={20} weight="fill" aria-label={trustWord(trustBadge!)} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
          </h2>
          <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {handle}
            {tier && <> · {TIER_LABEL[tier]}</>}
          </p>
          {trustBadge && (
            <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{trustWord(trustBadge)}</p>
          )}
        </div>
      </div>

      {vibeTagline && (
        <p className="type-body" style={{ fontSize: 18, lineHeight: '26px', color: 'var(--text-primary)', marginTop: 16, overflowWrap: 'anywhere' }}>
          {vibeTagline}
        </p>
      )}

      {/* Where they're riding */}
      {stationName && (
        <section aria-label="Riding" style={{ marginTop: 20 }}>
          <div
            className="card has-stub"
            style={{ ...lineStyle(line?.color || room?.lineColor || currentContext?.lineColor), background: 'var(--bg-tonal)', padding: '12px 14px 12px 18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <LinePill line={line || room?.lineColor} label={line?.name || room?.lineName} size="sm" />
              {commuteRel.type !== 'none' && (
                <span className="type-meta" style={{ color: 'var(--text-secondary)' }}>{commuteRel.label}</span>
              )}
            </div>
            <p className="type-headline" style={{ color: 'var(--text-primary)', marginTop: 6, fontStretch: '85%' }}>{stationName}</p>
            {station?.hindiName && <p className="type-meta type-hi" lang="hi" style={{ color: 'var(--text-muted)' }}>{station.hindiName}</p>}
            {towards && <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Towards {towards}</p>}
          </div>
        </section>
      )}

      {orderedTags.length > 0 && (
        <section style={{ marginTop: 20 }} aria-labelledby={titleId ? `${titleId}-interests` : undefined}>
          <Label
            id={titleId ? `${titleId}-interests` : undefined}
            trailing={shared.size > 0 ? <span className="tnum" style={{ color: 'var(--text-secondary)' }}>{shared.size} in common</span> : null}
          >
            Interests
          </Label>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
            {orderedTags.map(tid => (
              <li key={tid}>
                <Chip shared={shared.has(tid)}>
                  {tagLabel(tid)}
                  {shared.has(tid) && <span className="sr-only"> (you share this)</span>}
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {traveler.bio && traveler.bio !== vibeTagline && (
        <section style={{ marginTop: 20 }}>
          <Label>About</Label>
          <p className="type-body" style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{traveler.bio}</p>
        </section>
      )}

      {languages.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <Label>Speaks</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {languages.map(l => <Chip key={l} variant="quiet">{l}</Chip>)}
          </div>
        </section>
      )}

      {actualJoined !== undefined && actualJoined > 0 && (
        <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 20 }}>
          On CoRide since {joinedLabel(actualJoined)}
        </p>
      )}
    </div>
  );
}
