import { MessageCircle, Gamepad2, Sparkles, PenLine, Train, Shield, Bell } from 'lucide-react';
import type { UserProfile, ContextRoom, RankedTraveler } from '../types';
import type { EngagementSnapshot } from '../types/engagement';

interface Props {
  user: UserProfile | null;
  contextStationName?: string;
  contextLineName?: string;
  stationRoom: ContextRoom | null;
  trainRoom: ContextRoom | null;
  vibe?: RankedTraveler[];
  engagement?: Record<string, EngagementSnapshot>;
  onViewAllPeople: () => void;
  onQuickAction: (action: 'chat' | 'quiz' | 'icebreaker' | 'post') => void;
  onJoinRoom: (roomId: string) => void;
  onShowNotifications?: () => void;
}

export const HomeScreen: React.FC<Props> = ({ user, contextStationName, contextLineName, stationRoom, trainRoom, vibe, engagement, onViewAllPeople, onQuickAction, onJoinRoom }) => {
  const nearbyCount = stationRoom?.userCount || trainRoom?.userCount || 0;
  const line = contextLineName || trainRoom?.lineName || 'Blue Line';
  const station = contextStationName || trainRoom?.stationName || 'Rajiv Chowk';
  const next = trainRoom?.stationName ? 'Mandi House' : 'Noida Sec 18';

  // Build Around You Now avatars — use vibe or first 6 station users
  const around = vibe && vibe.length ? vibe : (stationRoom?.users.slice(0,6) || trainRoom?.users.slice(0,6) || []);
  // For around, we need to map RankedTraveler[] vs UserProfile[] — normalize
  const aroundItems: { id: string; name: string; bg: string; match: number; avatar?: string; tier?: string }[] =
    (around as any).slice(0,6).map((r: any, idx: number) => {
      if (r.profile) {
        const pct = Math.max(65, 90 - idx*5); // 90,80,75,70,65
        return { id: r.profile.id, name: r.profile.pseudonym.split('_')[0] || r.profile.pseudonym, bg: r.profile.avatarBg, match: pct, tier: r.profile.presenceTier };
      } else {
        const u = r as UserProfile;
        const pct = 90 - idx*5;
        return { id: u.id, name: u.pseudonym.split('_')[0] || u.pseudonym, bg: u.avatarBg, match: pct, tier: (u as any).presenceTier };
      }
    });

  // Active rooms demo + real engagement rooms
  const activeRooms: { id: string; title: string; desc: string; emoji: string; count: number }[] = [];
  // push real engagement active rooms
  if (engagement) {
    for (const snap of Object.values(engagement)) {
      if (snap.activeGame) {
        const g: any = snap.activeGame;
        const titleMap: Record<string,string> = { word_chain: 'Word Chain', trivia: 'Fast Trivia', twenty_q: '20 Questions', prompt: 'Prompt Wall' };
        activeRooms.push({ id: snap.roomId, title: `${titleMap[g.type] || g.type} • Live`, desc: g.type==='prompt' ? g.currentPrompt?.text?.slice(0,28) || 'Share your vibe' : `${g.players?.length || 0} playing`, emoji: g.type==='trivia'?'⚡':g.type==='prompt'?'💬':'🎮', count: g.players?.length || 0 });
      }
    }
  }
  // fallback demo rooms if empty
  if (activeRooms.length===0) {
    activeRooms.push({ id:'demo1', title:'Friday Music Vibes 🎵', desc:"Let's share some good songs!", emoji:'🎵', count:32 });
    activeRooms.push({ id:'demo2', title:'DU Students Room 🎓', desc:'North Campus peeps', emoji:'🎓', count:18 });
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily:'Space Grotesk', fontSize:28, fontWeight:700, letterSpacing:-0.5, margin:0 }}>CoRide</h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>
            Good Morning, {user ? user.pseudonym.split('_')[0] : 'Zaid'} <span>👋</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button style={{ width:38,height:38, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)' }}>
            <Shield size={18} />
          </button>
          <button style={{ width:38,height:38, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', position:'relative' }}>
            <Bell size={18} />
            <span style={{ position:'absolute', top:4,right:6, width:8,height:8, borderRadius:'50%', background:'#8B5CF6', border:'2px solid var(--bg-surface)' }} />
          </button>
        </div>
      </div>

      <p style={{ fontSize:22, fontWeight:800, lineHeight:1.2, marginBottom:16, color:'var(--text-primary)' }}>
        Your journey, <br/>your people.
      </p>

      {/* On Ride */}
      <div style={{ background:'#1A1033', border:'1px solid rgba(123,93,255,0.28)', borderRadius:'var(--radius-xl)', padding:14, display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{ width:42,height:42, borderRadius:'50%', background:'#7B5DFF', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
          <Train size={20} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:'#C4B5FF', fontWeight:700 }}>On Ride</div>
          <div style={{ fontSize:13, color:'white', fontWeight:600 }}>{line} • {station} → {next}</div>
        </div>
        <button className="btn-secondary" style={{ background:'transparent', border:'1px solid rgba(123,93,255,0.35)', color:'#C4B5FF', padding:'6px 12px', fontSize:12 }}>Change</button>
      </div>

      {/* Around You Now */}
      <div className="glass-panel" style={{ padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <h3 style={{ fontSize:14, fontWeight:800 }}>Around You Now</h3>
          <button onClick={onViewAllPeople} style={{ background:'none', border:'none', color:'var(--accent-violet)', fontSize:12, fontWeight:700, cursor:'pointer' }}>View all</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
          <div style={{ width:7,height:7, borderRadius:'50%', background:'var(--presence-active)', boxShadow:'0 0 6px var(--presence-active)' }} />
          <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600 }}>{nearbyCount || 74} people nearby</span>
        </div>
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {aroundItems.length ? aroundItems.map(it => (
            <div key={it.id} style={{ flex:'0 0 72px', textAlign:'center' }}>
              <div style={{ position:'relative', width:64, height:64, margin:'0 auto 6px' }}>
                <div style={{
                  width:64,height:64,borderRadius:'50%',
                  background: it.bg,
                  border:'3px solid #1A1A26',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'white', fontWeight:800, fontSize:14,
                  boxShadow:'0 4px 16px rgba(0,0,0,0.4)'
                }}>
                  {it.name[0]}
                </div>
                <div style={{ position:'absolute', bottom:0, right:0, width:14,height:14, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-card)' }} />
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.name}</div>
              <div style={{ marginTop:4, padding:'3px 6px', borderRadius:999, background:'rgba(123,93,255,0.16)', border:'1px solid rgba(123,93,255,0.22)', color:'#C4B5FF', fontSize:10, fontWeight:800, display:'inline-block' }}>{it.match}% Match</div>
            </div>
          )) : (
            // empty skeleton
            [1,2,3,4,5].map(i=>(
              <div key={i} style={{ flex:'0 0 72px', textAlign:'center', opacity:0.4 }}>
                <div style={{ width:64,height:64, borderRadius:'50%', background:'var(--bg-surface)', margin:'0 auto 6px' }} />
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>—</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <h3 style={{ fontSize:14, fontWeight:800, marginBottom:10 }}>Quick Actions</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { icon: <MessageCircle size={20} color="#7B5DFF"/>, label:'Chat Room', bg:'#EDE9FF', color:'#1A1A26', action:'chat' as const },
          { icon: <Gamepad2 size={20} color="#10B981"/>, label:'Play Quiz', bg:'#E0F7F0', color:'#1A1A26', action:'quiz' as const },
          { icon: <Sparkles size={20} color="#F59E0B"/>, label:'Ice Breaker', bg:'#FEF3C7', color:'#1A1A26', action:'icebreaker' as const },
          { icon: <PenLine size={20} color="#3B82F6"/>, label:'Add Post', bg:'#DBEAFE', color:'#1A1A26', action:'post' as const },
        ].map(card => (
          <button key={card.label} onClick={()=>onQuickAction(card.action)} style={{
            background: card.bg, border:'1px solid rgba(0,0,0,0.04)', borderRadius:'var(--radius-lg)',
            padding:16, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', gap:10,
            boxShadow:'0 4px 16px rgba(0,0,0,0.12)'
          }}>
            <div style={{ width:36,height:36, borderRadius:10, background:'white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
              {card.icon}
            </div>
            <span style={{ fontSize:13, fontWeight:800, color:card.color }}>{card.label}</span>
          </button>
        ))}
      </div>

      {/* Active Rooms */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:14, fontWeight:800 }}>Active Rooms</h3>
        <button onClick={onViewAllPeople} style={{ background:'none', border:'none', color:'var(--accent-violet)', fontSize:12, fontWeight:700 }}>View all</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {activeRooms.map(rm=>(
          <div key={rm.id} className="glass-panel" style={{ padding:14, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
                {rm.title} <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>👥 {rm.count}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{rm.desc}</div>
            </div>
            <button onClick={()=>onJoinRoom(rm.id)} className="btn-primary" style={{ padding:'8px 18px', fontSize:12 }}>Join</button>
          </div>
        ))}
      </div>
    </div>
  );
};
