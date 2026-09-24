import { CheckIcon, HandWavingIcon, SealCheckIcon } from '@phosphor-icons/react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { getCommuteRelationship } from '../utils/commuteContext';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';

/** Card-level mirror of the sheet's request state. */
export type CardRequestState = 'idle' | 'sent' | 'friends';

interface Props {
  user: UserProfile;
  isMe: boolean;
  /** Interest ids shared with the viewer (from /api/rank or a client intersection). */
  mutualTags?: string[];
  trustBadge?: string;
  trustTier?: string;
  vibeTagline?: string;
  isFriend?: boolean;
  activeRoomId?: string;
  requestState?: CardRequestState;
  onTap: () => void;
  onConnect: () => void;
}

const MAX_TAGS = 3;

const TIER_LABEL: Record<string, string> = {
  active: 'Active now',
  nearby: 'Nearby',
  other: 'Recently active'
};

function interestLabel(id: string): string {
  return INTEREST_TAXONOMY.find(t => t.id === id)?.label || id.replace(/_/g, ' ');
}

/** Trust badges arrive as "✅ Verified commuter" / "🌱 New": keep the words, drop the emoji. */
function trustWord(badge: string): string {
  return badge.replace(/^[^\p{L}\p{N}]+/u, '').trim() || badge;
}

/**
 * Rider card (DESIGN.md §5): surface card with a --line stub, squircle avatar,
 * name, tagline, up to three interests (shared ones in lime, listed first) and
 * one tonal action. The whole card opens the profile; the action button sits
 * above that hit area so each has its own focus stop and accessible name.
 * The stub takes --line from the nearest lineStyle() ancestor.
 */
export const TravelerCard: React.FC<Props> = ({
  user,
  isMe,
  onTap,
  onConnect,
  mutualTags,
  trustBadge,
  trustTier,
  vibeTagline,
  isFriend,
  activeRoomId,
  requestState = 'idle'
}) => {
  const tier = user.presenceTier;
  const tags = user.interestTags || [];
  const shared = new Set((mutualTags || []).filter(t => tags.includes(t)));
  const orderedTags = [...tags.filter(t => shared.has(t)), ...tags.filter(t => !shared.has(t))];
  const visibleTags = orderedTags.slice(0, MAX_TAGS);
  const overflow = orderedTags.length - visibleTags.length;
  const blurb = vibeTagline || user.bio;
  const trusted = !isMe && !!trustBadge && (trustTier === 'verified' || trustTier === 'trusted');

  const commuteRel = getCommuteRelationship(user, {
    isFriend,
    activeRoomId,
    userPresenceTier: user.presenceTier
  });
  const showRel = commuteRel.type !== 'none' && !isMe;
  const effectiveState: CardRequestState = isFriend ? 'friends' : requestState;

  const metaBits = [
    showRel ? commuteRel.label : tier ? TIER_LABEL[tier] : null,
    shared.size ? `${shared.size} in common` : null
  ].filter(Boolean);

  const a11yLabel = [
    `${user.pseudonym}${isMe ? ' (you)' : ''}`,
    tier ? TIER_LABEL[tier] : null,
    showRel ? commuteRel.label : null,
    trusted ? trustWord(trustBadge!) : null,
    shared.size ? `${shared.size} interest${shared.size === 1 ? '' : 's'} in common` : null,
    'View profile'
  ].filter(Boolean).join(', ');

  return (
    <article className="card has-stub" style={{ position: 'relative', padding: '16px 16px 16px 20px' }}>
      {/* Full-card hit area: opens the profile. Content below is non-interactive. */}
      <button
        type="button"
        onClick={onTap}
        aria-label={a11yLabel}
        className="press"
        style={{ position: 'absolute', inset: 0, width: '100%', background: 'none', border: 'none', borderRadius: 'inherit', cursor: 'pointer', zIndex: 0 }}
      />

      <div style={{ position: 'relative', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={user.pseudonym} seed={user.id} bg={user.avatarBg} size={48} presence={tier} you={isMe} />
        <div style={{ flex: 1, minWidth: 0 }} aria-hidden="true">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span className="type-headline" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.pseudonym}
            </span>
            {trusted && <SealCheckIcon size={18} weight="fill" style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
            {isMe && <span className="type-meta" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>You</span>}
          </div>
          {metaBits.length > 0 && (
            <p className="type-meta tnum" style={{ color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {metaBits.join(' · ')}
            </p>
          )}
        </div>

        {!isMe && (
          <span style={{ pointerEvents: 'auto', flexShrink: 0 }}>
            {effectiveState === 'idle' ? (
              <Button
                type="button"
                variant="tonal"
                size="sm"
                icon={<HandWavingIcon size={18} />}
                onClick={e => { e.stopPropagation(); onConnect(); }}
                aria-label={`Say hi to ${user.pseudonym}: sends a request`}
              >
                Say hi
              </Button>
            ) : (
              <span
                role="status"
                className="type-label"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 4px', color: 'var(--text-secondary)' }}
              >
                <CheckIcon size={18} aria-hidden="true" />
                {effectiveState === 'friends' ? 'Friends' : 'Sent'}
              </span>
            )}
          </span>
        )}
      </div>

      {blurb && (
        <p
          className="type-body"
          aria-hidden="true"
          style={{ position: 'relative', pointerEvents: 'none', color: 'var(--text-secondary)', marginTop: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}
        >
          {blurb}
        </p>
      )}

      {visibleTags.length > 0 && (
        <div aria-hidden="true" style={{ position: 'relative', pointerEvents: 'none', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {visibleTags.map(tid => (
            <Chip key={tid} shared={shared.has(tid)} style={{ minHeight: 32, padding: '5px 12px' }}>{interestLabel(tid)}</Chip>
          ))}
          {overflow > 0 && <Chip variant="quiet" style={{ minHeight: 32, padding: '5px 12px' }}>+{overflow}</Chip>}
        </div>
      )}
    </article>
  );
};
