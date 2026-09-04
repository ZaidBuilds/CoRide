import { Users, Shield, MapPin } from 'lucide-react';
import type { UserProfile, ContextRoom, RankedTraveler } from '../types';
import type { EngagementSnapshot } from '../types/engagement';

interface Props {
  user: UserProfile | null;
  room: ContextRoom | null;
  ranked?: RankedTraveler[];
  engagement?: Record<string, EngagementSnapshot>;
  onProfile: (u: UserProfile) => void;
  onJoinRoom: (roomId: string, type: string) => void;
  onSeeAllPeople: () => void;
}

const LIVE_ROOMS = [
  { id:'music', title:'Music Lounge', people:14, desc:'Talk about songs, artists and live concerts.', color:'var(--accent-purple)', icon:'🎧', avatars:['var(--accent-purple)','var(--accent-pink)','#10b981','#F59E0B'] },
  { id:'travel', title:'Travel Talk', people:9, desc:'Share travel stories, tips and experiences.', color:'var(--accent-blue)', icon:'✈️', avatars:['#06B6D4','var(--accent-violet)','#F59E0B','#EF4444'] },
  { id:'tech', title:'Tech Hub', people:12, desc:'Discuss tech, AI, coding and more.', color:'var(--accent-pink)', icon:'🖥️', avatars:['#6366F1','#10B981','#F59E0B','var(--accent-pink)'] },
];

const QUICK_GAMES = [
  { id:'trivia', title:'Metro Trivia', playing:234, desc:'Test your knowledge and win points.', icon:'🏆', color:'var(--accent-purple)' },
  { id:'would', title:'Would You Rather?', playing:189, desc:'Fun choices, crazy questions!', icon:'💬', color:'var(--accent-pink)' },
  { id:'word', title:'Word Connect', playing:156, desc:'Find words, make connections.', icon:'W', color:'#10B981' },
  { id:'rapid', title:'Rapid Fire', playing:312, desc:'Quick questions, real fast answers.', icon:'⚡', color:'#F59E0B' },
];

export const DiscoverAroundYou: React.FC<Props> = ({ user, room, ranked, engagement, onProfile, onJoinRoom, onSeeAllPeople }) => {
  void engagement;
  const people = ranked && ranked.length ? ranked.slice(0,5) : (room?.users.slice(0,5) || []);
  const count = room?.userCount || people.length || 42;
  const line = room?.lineName || 'Blue Line';
  const from = room?.stationName || 'Rajiv Chowk';
  const to = 'Noida Sec 18';
  const nextStop = 'Barakhamba Road';
  const greeting = user ? user.pseudonym.split('_')[0] : 'traveler';

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:18, fontWeight:900, letterSpacing:-0.3 }}>
          <span style={{ color:'var(--accent-purple-text)' }}>Co</span><span style={{ color:'var(--accent-pink)' }}>Ride</span>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>Hi, {greeting}!</span>
        </div>
        <div style={{ width:32,height:32, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <span style={{ fontSize:14 }}>🔔</span>
          <span style={{ position:'absolute', top:-2,right:-2, minWidth:16,height:16, padding:'0 4px', borderRadius:999, background:'#EF4444', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>3</span>
        </div>
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:12, display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <div style={{ width:40,height:40, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent-purple), #4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
          <MapPin size={18}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>You’re on</div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>{line}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{from} → {to}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'var(--accent-purple-text)', fontWeight:700 }}>Next Stop</div>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{nextStop}</div>
          <button aria-label="Swap from and to stations" style={{ marginTop:4, width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>⇄</button>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:14, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
          People Nearby <span style={{ width:7,height:7, borderRadius:'50%', background:'var(--presence-active)', display:'inline-block' }} /> <span style={{ fontSize:12, color:'var(--presence-active)', fontWeight:700 }}>{count} online</span>
        </h3>
        <button onClick={onSeeAllPeople} style={{ background:'none', border:'none', color:'var(--accent-purple-text)', fontSize:12, fontWeight:700 }}>See all ›</button>
      </div>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>See who’s around you right now, join rooms, start conversations and make your journey better.</p>

      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, marginBottom:14 }}>
        {people.map((p:any, idx:number)=>{
          const profile: UserProfile = p.profile || p;
          const name = profile.pseudonym.split('_')[0];
          const dist = [2.1,1.8,2.3,1.5,2.0][idx%5];
          const interest = profile.interestTags?.[0] || 'Music';
          const meta = { Music:{emoji:'🎧', bg:'rgba(123,93,255,0.14)'}, Travel:{emoji:'✈️', bg:'rgba(14,165,233,0.12)'}, Coding:{emoji:'💻', bg:'rgba(16,185,129,0.12)'}, Books:{emoji:'📚', bg:'rgba(245,158,11,0.12)'}, Gaming:{emoji:'🎮', bg:'rgba(236,72,153,0.12)'} } as any;
          const m = meta[interest] || meta['Music'];
          const ring = ['var(--accent-purple)','#10b981','#F59E0B','var(--accent-pink)','#6366F1'][idx%5];
          return (
            <div key={profile.id} onClick={()=> onProfile(profile)} style={{ flex:'0 0 96px', background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:'10px 8px', textAlign:'center', cursor:'pointer' }}>
              <div style={{ position:'relative', width:64, height:64, margin:'0 auto 8px' }}>
                <div style={{ width:64,height:64, borderRadius:'50%', background: profile.avatarBg, border:`2px solid ${ring}`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>{profile.pseudonym[0]}</div>
                <div style={{ position:'absolute', top:2, right:2, width:10,height:10, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-card)' }} />
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{name}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{dist} km away</div>
              <div style={{ marginTop:6, padding:'4px 6px', borderRadius:999, background:m.bg, border:'1px solid rgba(255,255,255,0.06)', fontSize:11, fontWeight:700, color:'var(--text-secondary)', display:'inline-flex', alignItems:'center', gap:4 }}>
                <span>{m.emoji}</span> {interest}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:14, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}><span style={{ color:'var(--accent-pink)' }}>♨</span> Live Rooms <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>Join a room and start talking</span></h3>
        <button onClick={onSeeAllPeople} style={{ background:'none', border:'none', color:'var(--accent-purple-text)', fontSize:12, fontWeight:700 }}>View all ›</button>
      </div>
      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, marginBottom:14 }}>
        {LIVE_ROOMS.map(r=>(
          <div key={r.id} style={{ flex:'0 0 180px', background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{r.icon}</span>
              <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{r.title}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--presence-active)', fontWeight:700 }}>{r.people} people</div>
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
              {r.avatars.map((c,i)=>(
                <div key={i} style={{ width:24,height:24, borderRadius:'50%', background:c, border:'2px solid var(--bg-card)', marginLeft: i===0?0:-6, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:8, fontWeight:800 }}>{String.fromCharCode(65+i)}</div>
              ))}
              <span style={{ marginLeft:6, fontSize:11, padding:'2px 6px', borderRadius:999, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)' }}>+{r.people -4}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.3 }}>{r.desc}</div>
            <button onClick={()=> onJoinRoom(r.id, r.title)} style={{ marginTop:4, padding:'8px', borderRadius:'var(--radius-full)', background:'var(--accent-purple)', border:'none', color:'white', fontWeight:700, fontSize:12 }}>Join Room</button>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:14, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}><span style={{ color:'var(--accent-blue)' }}>🎮</span> Quick Games <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>Play short games with people around you</span></h3>
        <button style={{ background:'none', border:'none', color:'var(--accent-purple-text)', fontSize:12, fontWeight:700 }}>All Games ›</button>
      </div>
      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, marginBottom:14 }}>
        {QUICK_GAMES.map(g=>(
          <div key={g.id} style={{ flex:'0 0 150px', background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ width:36,height:36, borderRadius:10, background: g.color, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900 }}>{g.icon}</div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>{g.title}</div>
            <div style={{ fontSize:11, color:'var(--presence-active)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6,height:6, borderRadius:'50%', background:'var(--presence-active)', display:'inline-block' }}/> {g.playing} playing</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.3 }}>{g.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <div style={{ flex:1, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', alignItems:'center', gap:10 }}>
          <Users size={18} style={{ color:'var(--accent-purple-text)' }} />
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)' }}>342</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>people on this line</div>
          </div>
        </div>
        <div style={{ flex:1, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32,height:32, borderRadius:10, background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>🎁</div>
          <div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>Invite Friends</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Get CoRide Premium</div>
          </div>
        </div>
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:36,height:36, borderRadius:'50%', background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}><Shield size={18}/></div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>Safety First</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>We keep CoRide safe for everyone.</div>
        </div>
        <span style={{ color:'var(--text-muted)' }}>›</span>
      </div>
    </div>
  );
};
