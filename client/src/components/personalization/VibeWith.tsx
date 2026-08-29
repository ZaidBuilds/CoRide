import { Sparkles, ArrowRight } from 'lucide-react';
import type { RankedTraveler } from '../../types';

interface Props {
  vibe: RankedTraveler[];
  onConnect: (userId: string) => void;
  onProfile?: (userId: string) => void;
}

export const VibeWith: React.FC<Props> = ({ vibe, onConnect }) => {
  if (!vibe || vibe.length===0) return null;
  return (
    <div className="glass-panel" style={{ padding: 14, borderRadius: 'var(--radius-lg)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', display:'flex', alignItems:'center', gap:6, marginBottom: 4 }}>
        <Sparkles size={14} style={{color:'var(--accent-purple)'}}/> People you may vibe with
        <span style={{ marginLeft:'auto', fontSize:10, padding:'2px 6px', borderRadius:'var(--radius-full)', background:'rgba(168,85,247,0.12)', color:'var(--accent-purple)', border:'1px solid rgba(168,85,247,0.22)' }}>{vibe.length} picks</span>
      </h3>
      <p style={{ fontSize: 11, color:'var(--text-muted)', marginBottom: 10 }}>Smart ranking by shared interests + trust • changes as network grows</p>
      <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
        {vibe.map(r => (
          <div key={r.profile.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius-md)', background: 'var(--bg-surface)', border:'1px solid var(--border-subtle)' }}>
            <div style={{ width:36, height:36, borderRadius:8, background:r.profile.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:12 }}>{r.profile.pseudonym[0]}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{r.profile.pseudonym}</span>
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(16,185,129,0.12)', color:'var(--accent-emerald)', border:'1px solid var(--border-subtle)' }}>{r.trustBadge?.replace('✅','').trim() || r.trustTier}</span>
              </div>
              <div style={{ fontSize:11, color:'var(--accent-purple)', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <Sparkles size={10}/> {r.mutualCount} shared: {r.mutualTags.slice(0,2).join(', ')}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.profile.interestTags.slice(0,3).join(' · ')}</div>
            </div>
            <button onClick={()=>onConnect(r.profile.id)} className="btn-primary" style={{ padding:'6px 10px', fontSize:11, flexShrink:0 }}>
              Vibe <ArrowRight size={12}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
