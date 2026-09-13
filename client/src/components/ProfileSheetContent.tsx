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
}

function initials(t: RoomPresenceTraveler | UserProfile): string {
  return (t.pseudonym || t.username || '??').replace(/^@/, '').slice(0, 2).toUpperCase();
}

function joinedLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Display-only profile body for the ProfileSheet.
 * Features prominent Commute Relationship badge, live presence, and interest tags.
 */
export function ProfileSheetContent({ traveler, joinedAt, titleId, activeRoomId, currentContext, isFriend }: Props) {
  const name = traveler.pseudonym || traveler.username.replace(/^@/, '');
  const actualJoined = joinedAt || ('joinedAt' in traveler ? (traveler as UserProfile).joinedAt : undefined);
  const trustBadge = ('trustBadge' in traveler ? (traveler as UserProfile).trustBadge : undefined);
  const trustTier = ('trustTier' in traveler ? (traveler as UserProfile).trustTier : undefined);

  // Commute Context relation (🚇 Same Train, 🔀 Same Line & Dir, 🏛️ At Station, 🟡 Nearby, 👥 Metro Friend)
  const commuteRel = getCommuteRelationship(traveler, {
    isFriend,
    activeRoomId,
    currentContext
  });

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
            fontWeight: 800,
            background: traveler.avatarBg || 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))'
          }}
        >
          {initials(traveler)}
        </div>
        <div
          className="avatar-dot active"
          style={{ width: 18, height: 18 }}
          title="Live in Metro"
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

      {/* Commute Relationship Banner */}
      {commuteRel.type !== 'none' && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 999,
          background: commuteRel.bgColor,
          border: `1px solid ${commuteRel.borderColor}`,
          color: commuteRel.textColor,
          fontSize: 12,
          fontWeight: 700,
          marginTop: 12,
          maxWidth: '90%'
        }}>
          <span style={{ fontSize: 14 }}>{commuteRel.emoji}</span>
          <span>{commuteRel.label}</span>
          <span style={{ opacity: 0.8, fontWeight: 500, fontSize: 11 }}>• {commuteRel.description}</span>
        </div>
      )}

      {/* Trust tier badge */}
      {trustBadge && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 999,
            background: trustTier === 'verified' ? 'rgba(168,85,247,0.14)' : 'rgba(16,185,129,0.10)',
            border: '1px solid var(--border-subtle)',
            color: trustTier === 'verified' ? 'var(--accent-purple-text)' : 'var(--accent-emerald)',
            fontWeight: 700
          }}>
            {trustBadge}
          </span>
        </div>
      )}

      {/* Bio / About */}
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

      {/* Interest Tags */}
      {traveler.interestTags && traveler.interestTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 }}>
          {traveler.interestTags.map(tid => {
            const meta = INTEREST_TAXONOMY.find(t => t.id === tid) || { emoji: '•', label: tid };
            return (
              <span key={tid} className="tag-pill" style={{ fontSize: 12, padding: '5px 10px' }}>
                <span>{meta.emoji}</span> {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {actualJoined !== undefined && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
          Joined {joinedLabel(actualJoined)}
        </div>
      )}
    </div>
  );
}
