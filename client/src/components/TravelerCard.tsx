import { UserPlus, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { UserProfile } from '../types';

interface Props {
  user: UserProfile;
  isMe: boolean;
  mutualTags?: string[];
  mutualCount?: number;
  trustBadge?: string;
  trustTier?: string;
  rankedScore?: number;
  vibeTagline?: string;
  onTap: () => void;
  onConnect: () => void;
  onBlock: () => void;
  onReport: () => void;
}

export const TravelerCard: React.FC<Props> = ({
  user,
  isMe,
  onTap,
  onConnect,
  mutualTags,
  mutualCount,
  trustBadge,
  trustTier,
  rankedScore,
  vibeTagline,
}) => {
  const tier = user.presenceTier || 'other';
  const initials = user.pseudonym.substring(0, 2).toUpperCase();
  const emoji = user.collegeOrTag || '';
  const hasMutual = (mutualCount || 0) > 0;
  const trustColor = trustTier === 'verified' ? 'var(--accent-purple)' : trustTier === 'trusted' ? 'var(--accent-emerald)' : trustTier === 'regular' ? 'var(--accent-blue)' : 'var(--text-muted)';

  return (
    <div
      className="traveler-card animate-fade-in"
      onClick={onTap}
      role="button"
      tabIndex={0}
      style={hasMutual ? { borderColor: 'rgba(168,85,247,0.22)', background: 'rgba(168,85,247,0.04)' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: user.avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 800,
            color: 'white',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.pseudonym}
            </span>
            {isMe && (
              <span style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 500 }}>
                (You)
              </span>
            )}
            {trustBadge && !isMe && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-full)', background: trustTier==='verified' ? 'rgba(168,85,247,0.15)' : trustTier==='trusted' ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface)', border: `1px solid ${trustTier==='verified' ? 'rgba(168,85,247,0.3)' : 'var(--border-subtle)'}`, color: trustColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {trustTier==='verified' ? <ShieldCheck size={10}/> : trustTier==='trusted' ? <Star size={10}/> : null}
                {trustBadge.replace('✅','').replace('⭐','').trim() || trustBadge}
              </span>
            )}
            {typeof rankedScore === 'number' && hasMutual && (
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-purple)' }}>#{rankedScore}</span>
            )}
          </div>

          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap'
          }}>
            {emoji && <span>{emoji}</span>}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{user.interestTags?.join(' · ') || ''}</span>
          </div>
          {vibeTagline && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 1 }}>{vibeTagline}</div>}
          {hasMutual && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent-purple)', fontWeight: 700 }}>
              <Sparkles size={11} style={{ color: 'var(--accent-purple)' }} />
              <span>{mutualCount} shared: {mutualTags?.slice(0,2).join(', ')}</span>
              {mutualCount! > 2 && <span> +{mutualCount! - 2} more</span>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!isMe && (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(); }}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            <UserPlus size={14} />
            Connect
          </button>
        )}

        <div className={`presence-dot ${tier}`} title={tier} />
      </div>
    </div>
  );
};
