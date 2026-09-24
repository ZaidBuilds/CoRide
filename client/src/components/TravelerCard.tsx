import { UserPlus, Check, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { getCommuteRelationship } from '../utils/commuteContext';

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
  active: 'active now',
  nearby: 'nearby',
  other: 'recently active'
};

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { emoji: '', label: id.replace(/_/g, ' ') };
}

/** Trust badges arrive as "✅ Verified commuter" / "🌱 New" — keep the words, drop the emoji. */
function trustWord(badge: string): string {
  return badge.replace(/^[^\p{L}\p{N}]+/u, '').trim() || badge;
}

/**
 * One traveler in the People list. The body is a single button that opens the
 * profile sheet; the trailing button sends a request without opening it.
 * Two sibling buttons rather than a clickable card with a nested button, so
 * each has its own focus stop and accessible name.
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
  const initials = user.pseudonym.substring(0, 2).toUpperCase();
  const tags = user.interestTags || [];
  const shared = new Set((mutualTags || []).filter(t => tags.includes(t)));
  const orderedTags = [...tags.filter(t => shared.has(t)), ...tags.filter(t => !shared.has(t))];
  const visibleTags = orderedTags.slice(0, MAX_TAGS);
  const overflow = orderedTags.length - visibleTags.length;
  const blurb = vibeTagline || user.bio;

  const commuteRel = getCommuteRelationship(user, {
    isFriend,
    activeRoomId,
    userPresenceTier: user.presenceTier
  });
  const showRel = commuteRel.type !== 'none' && !isMe;
  const effectiveState: CardRequestState = isFriend ? 'friends' : requestState;

  const a11yLabel = [
    `${user.pseudonym}${isMe ? ' (you)' : ''}`,
    tier ? TIER_LABEL[tier] : null,
    showRel ? commuteRel.label : null,
    shared.size ? `${shared.size} interest${shared.size === 1 ? '' : 's'} in common` : null,
    'View profile'
  ].filter(Boolean).join(', ');

  return (
    <div
      className={`traveler-card${shared.size > 0 && !isMe ? ' vibe' : ''}`}
      style={{ padding: 0, gap: 0, alignItems: 'stretch', cursor: 'default' }}
    >
      <button
        type="button"
        onClick={onTap}
        aria-label={a11yLabel}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 8px 14px 14px', background: 'none', border: 'none',
          textAlign: 'left', color: 'inherit', cursor: 'pointer', borderRadius: 'inherit'
        }}
      >
        {/* Avatar with presence dot (only when presence is known) */}
        <div className="avatar-wrap" aria-hidden="true">
          <div className="avatar" style={{ width: 52, height: 52, background: user.avatarBg, fontSize: 16 }}>
            {initials}
          </div>
          {tier && <div className={`avatar-dot ${tier}`} />}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.pseudonym}
            </span>
            {isMe && (
              <span className="tag-pill active" style={{ padding: '2px 8px', fontSize: 11, flexShrink: 0 }}>You</span>
            )}
            {!isMe && trustBadge && (trustTier === 'verified' || trustTier === 'trusted') && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {trustWord(trustBadge)}
              </span>
            )}
          </div>

          {/* Context row — how they relate to you, and what you share */}
          {(showRel || shared.size > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 700 }}>
              {showRel && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: commuteRel.textColor }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: commuteRel.dotColor }} />
                  {commuteRel.label}
                </span>
              )}
              {shared.size > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-purple-text)' }}>
                  <Sparkles size={12} />
                  {shared.size} in common
                </span>
              )}
            </div>
          )}

          {blurb && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
              {blurb}
            </div>
          )}

          {visibleTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {visibleTags.map(tid => {
                const meta = tagMeta(tid);
                return (
                  <span key={tid} className={`tag-pill${shared.has(tid) ? ' active' : ''}`} style={{ padding: '4px 9px', fontSize: 12 }}>
                    {meta.emoji && <span>{meta.emoji}</span>}
                    {meta.label}
                  </span>
                );
              })}
              {overflow > 0 && (
                <span className="tag-pill" style={{ padding: '4px 9px', fontSize: 12 }}>+{overflow}</span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Quick request */}
      {!isMe && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 4px', flexShrink: 0 }}>
          {effectiveState === 'idle' ? (
            <button
              type="button"
              onClick={onConnect}
              className="press"
              aria-label={`Send request to ${user.pseudonym}`}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))',
                border: 'none', color: 'var(--text-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)', cursor: 'pointer'
              }}
            >
              <UserPlus size={20} />
            </button>
          ) : (
            <span
              role="img"
              aria-label={effectiveState === 'friends' ? `Friends with ${user.pseudonym}` : `Request sent to ${user.pseudonym}`}
              title={effectiveState === 'friends' ? 'Friends' : 'Request sent'}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)',
                color: effectiveState === 'friends' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Check size={20} />
            </span>
          )}
        </div>
      )}
    </div>
  );
};
