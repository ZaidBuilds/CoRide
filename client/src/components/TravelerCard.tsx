import { UserPlus } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';

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

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { emoji: '•', label: id };
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
  const hasMutual = (mutualCount || 0) > 0;
  void rankedScore;

  // Badge logic: Nearby vs Same Train
  const badge = tier === 'nearby' ? { label: 'Nearby', dot: 'var(--presence-nearby)', bg: 'rgba(234,179,8,0.16)', border: 'rgba(234,179,8,0.28)', color: 'var(--accent-amber)' }
    : tier === 'active' ? { label: 'Same Train', dot: 'var(--presence-sameTrain)', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.28)', color: 'var(--presence-sameTrain)' }
    : null;

  const topTags = (user.interestTags || []).slice(0, 2);

  return (
    <div
      className={`traveler-card animate-fade-in${hasMutual ? ' vibe' : ''}`}
      onClick={onTap}
      role="button"
      tabIndex={0}
      style={{ padding: '14px', gap: 12 }}
    >
      {/* Avatar with presence dot */}
      <div className="avatar-wrap">
        <div className="avatar" style={{ width:52, height:52, background:user.avatarBg, fontSize:15 }}>
          {initials}
        </div>
        <div className={`avatar-dot ${tier}`} title={tier} />
      </div>

      {/* Middle */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', letterSpacing:-0.1 }}>{user.pseudonym}</span>
            {badge && !isMe && (
              <span style={{
                fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999,
                background: badge.bg, border:`1px solid ${badge.border}`, color: badge.color,
                display:'inline-flex', alignItems:'center', gap:5
              }}>
                <span style={{ width:6,height:6, borderRadius:'50%', background: badge.dot, display:'inline-block' }} />
                {badge.label}
              </span>
            )}
            {trustBadge && trustTier && !isMe && (
              <span style={{ fontSize:11, padding:'2px 6px', borderRadius:999, background: trustTier==='verified' ? 'rgba(168,85,247,0.14)' : 'rgba(16,185,129,0.10)', border:'1px solid var(--border-subtle)', color: trustTier==='verified' ? 'var(--accent-purple-text)' : 'var(--accent-emerald)', fontWeight:700 }}>
                {trustBadge.replace('✅','').replace('⭐','').trim() || trustBadge}
              </span>
            )}
            {isMe && <span style={{ fontSize:11, color:'var(--accent-purple-text)', fontWeight:700, background:'rgba(123,93,255,0.12)', padding:'2px 6px', borderRadius:999, border:'1px solid rgba(123,93,255,0.22)' }}>You</span>}
          </div>

          <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {user.interestTags?.slice(0,3).join(' • ') || (user as any).bio?.slice(0,32) || 'Explorer • Food • Photography'}
          </div>
          {vibeTagline && <div style={{ fontSize:12, color:'var(--text-muted)', fontStyle:'italic', lineHeight:1.35 }}>{vibeTagline}</div>}

          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
            {topTags.map(tid => {
              const meta = tagMeta(tid);
              return (
                <span key={tid} className="tag-pill" style={{ padding:'4px 8px', fontSize:11 }}>
                  <span>{meta.emoji}</span> {meta.label}
                </span>
              );
            })}
            {hasMutual && (
              <span style={{ fontSize:11, color:'var(--accent-purple-text)', fontWeight:700, display:'inline-flex', alignItems:'center', gap:3, background:'rgba(123,93,255,0.10)', padding:'4px 8px', borderRadius:999, border:'1px solid rgba(123,93,255,0.14)' }}>
                ✨ {mutualCount} shared{mutualTags && mutualTags.length ? `: ${mutualTags.slice(0,2).join(', ')}` : ''}
              </span>
            )}
          </div>
        </div>

      {/* Connect */}
      {!isMe ? (
        <button
          onClick={(e)=> { e.stopPropagation(); onConnect(); }}
          className="press"
          style={{
            width:44, height:44, borderRadius:'50%',
            background:'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))',
            border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 14px rgba(123,93,255,0.35)', cursor:'pointer', flexShrink:0
          }}
          aria-label={`Connect with ${user.pseudonym}`}
        >
          <UserPlus size={18} />
        </button>
      ) : (
        <div style={{ width:44, height:44 }} />
      )}
    </div>
  );
};
