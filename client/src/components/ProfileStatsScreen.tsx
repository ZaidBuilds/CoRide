import { Flame, Crown, TrendingUp } from 'lucide-react';

interface Props {
  user?: any;
  onBack?: () => void;
}

export const ProfileStatsScreen: React.FC<Props> = ({ user }) => {
  const name = user?.pseudonym?.split('_')[0] || 'Kabir Sharma';
  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <h2 style={{ fontSize:20, fontWeight:900 }}>Profile</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ width:32,height:32, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>⚙️</button>
          <button style={{ width:32,height:32, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', position:'relative' }}>🔔<span style={{ position:'absolute', top:-2,right:-2, width:16,height:16, borderRadius:999, background:'#EF4444', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>3</span></button>
        </div>
      </div>

      {/* Top profile card */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:14, display:'flex', gap:12, marginBottom:12 }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:64,height:64, borderRadius:'50%', background: user?.avatarBg || 'linear-gradient(135deg, #7B5DFF, #EC4899)', border:'3px solid #7B5DFF', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:18 }}>
            {name[0]}
          </div>
          <span style={{ position:'absolute', bottom:0, right:0, width:20,height:20, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>✏️</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:900, color:'white', display:'flex', alignItems:'center', gap:6 }}>{name} <span style={{ color:'#7B5DFF' }}>✔</span></div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>@{user?.username?.replace('@','') || 'kabir_12'} • Meerut, India</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <span style={{ width:6,height:6, borderRadius:'50%', background:'#7B5DFF', display:'inline-block' }}/> Explorer
            <span>📍 Meerut, India</span>
            <span>📅 Member since Jan 2024</span>
          </div>
        </div>
        <div style={{ textAlign:'right', background:'rgba(123,93,255,0.10)', border:'1px solid rgba(123,93,255,0.18)', borderRadius:'var(--radius-lg)', padding:'8px 10px' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#C4B5FF', display:'flex', alignItems:'center', gap:4 }}><Crown size={14}/> Level 12</div>
          <div style={{ height:4, borderRadius:999, background:'var(--bg-surface)', marginTop:6, width:100 }}>
            <div style={{ width:'82%', height:'100%', borderRadius:999, background:'linear-gradient(90deg,#7B5DFF,#EC4899)' }} />
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>2,450 / 3,000 XP</div>
        </div>
      </div>

      {/* Journey Stats */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:14, marginBottom:12 }}>
        <h3 style={{ fontSize:13, fontWeight:800, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><TrendingUp size={14} style={{ color:'#7B5DFF' }}/> Journey Stats</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
          {[
            { icon:'🚇', value:'128', label:'Rides', sub:'This Month', color:'#7B5DFF' },
            { icon:'📏', value:'412 km', label:'Distance', sub:'Traveled', color:'#0EA5E9' },
            { icon:'⏱️', value:'18h 36m', label:'Time', sub:'Saved', color:'#F43F5E' },
            { icon:'🌿', value:'21.4 kg', label:'CO₂', sub:'Saved', color:'#10B981' },
          ].map(s=>(
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ width:36,height:36, borderRadius:10, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', color:s.color }}>{s.icon}</div>
              <div style={{ fontSize:14, fontWeight:900, color:'white' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>{s.label}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:14, marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:800 }}><Flame size={16} style={{ color:'#F59E0B' }}/> 14 Day Streak</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Keep it going!</div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {['M','T','W','T','F','S','S'].map((d,i)=>(
              <div key={d+i} style={{ width:28,height:28, borderRadius:'50%', background: i<6 ? '#7B5DFF' : 'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color: i<6 ? 'white' : 'var(--text-muted)', fontSize:10 }}>{i<6 ? '✓' : d}</div>
            ))}
          </div>
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}><Crown size={12} style={{ color:'#F59E0B' }}/> Longest Streak: 21 days</div>
      </div>

      {/* Achievements */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:13, fontWeight:800 }}>Achievements</h3>
        <button style={{ background:'none', border:'none', color:'var(--accent-violet)', fontSize:12, fontWeight:700 }}>View all ›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:14 }}>
        {[
          { title:'First Ride', sub:'Complete your first ride', prog:'✓', color:'#7B5DFF', done:true },
          { title:'Explorer', sub:'Travel 100 km', prog:'100 / 100', color:'#0EA5E9', done:true },
          { title:'People Connector', sub:'Connect with 25 people', prog:'18 / 25', color:'#F43F5E' },
          { title:'Eco Saver', sub:'Save 10 kg CO₂', prog:'10 / 10', color:'#10B981', done:true },
        ].map(a=>(
          <div key={a.title} style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:10, textAlign:'center', opacity: a.done ? 1 : 0.85 }}>
            <div style={{ width:40,height:40, borderRadius:12, background: a.color, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', color:'white' }}>🏆</div>
            <div style={{ fontSize:11, fontWeight:800, color:'white', lineHeight:1.2 }}>{a.title}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{a.sub}</div>
            <div style={{ fontSize:10, fontWeight:700, color: a.done ? '#10B981' : '#F43F5E', marginTop:4 }}>{a.prog}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <h3 style={{ fontSize:13, fontWeight:800 }}>Recent Activity</h3>
        <button style={{ background:'none', border:'none', color:'var(--accent-violet)', fontSize:12, fontWeight:700 }}>View all ›</button>
      </div>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:12, display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
        {[
          { icon:'🚇', title:'Ride completed', sub:'Rajiv Chowk → Noida Sec 18', time:'Today, 9:52 AM', xp:'+50 XP' },
          { icon:'👥', title:'Connected with Ishita', sub:'You are now connected', time:'Yesterday, 6:30 PM', xp:'+20 XP' },
        ].map(r=>(
          <div key={r.title} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32,height:32, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center' }}>{r.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'white' }}>{r.title}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.sub}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>{r.time}</div>
              <div style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(16,185,129,0.12)', color:'var(--accent-emerald)', border:'1px solid rgba(16,185,129,0.22)', display:'inline-block', marginTop:2 }}>{r.xp}</div>
            </div>
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:4 }}>
          {[
            { label:'My Rides', sub:'View all history', icon:'🚇' },
            { label:'Saved Routes', sub:'3 routes saved', icon:'✔️' },
            { label:'Preferences', sub:'Manage settings', icon:'⚙️' },
          ].map(b=>(
            <button key={b.label} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:10, display:'flex', alignItems:'center', gap:8, textAlign:'left' }}>
              <span style={{ fontSize:14 }}>{b.icon}</span>
              <span>
                <div style={{ fontSize:11, fontWeight:800, color:'white' }}>{b.label}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)' }}>{b.sub}</div>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Go Premium */}
      <div style={{ background:'linear-gradient(135deg, #1A1033, #1E1A3A)', border:'1px solid rgba(123,93,255,0.22)', borderRadius:'var(--radius-xl)', padding:14 }}>
        <div style={{ display:'flex', gap:12, marginBottom:12 }}>
          <div style={{ width:44,height:44, borderRadius:'50%', background:'linear-gradient(135deg, #7B5DFF, #EC4899)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>👑</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'white' }}>Go Premium, Do More</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Unlock exclusive features and enhance your CoRide experience.</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:12 }}>
          {[
            { title:'Unlimited Connections', desc:'Connect with more people', icon:'∞' },
            { title:'Smart Alerts', desc:'Get notified smarter', icon:'🔔' },
            { title:'Advanced Insights', desc:'Deep stats & analytics', icon:'📊' },
            { title:'Priority Support', desc:'We’re here for you', icon:'🛡️' },
          ].map(f=>(
            <div key={f.title} style={{ textAlign:'center' }}>
              <div style={{ width:36,height:36, borderRadius:'50%', background:'rgba(123,93,255,0.12)', border:'1px solid rgba(123,93,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', color:'#7B5DFF', fontSize:14 }}>{f.icon}</div>
              <div style={{ fontSize:10, fontWeight:800, color:'white', lineHeight:1.2 }}>{f.title}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', lineHeight:1.2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <button style={{ width:'100%', padding:'12px', borderRadius:'var(--radius-full)', background:'linear-gradient(135deg, #EC4899, #7B5DFF)', border:'none', color:'white', fontWeight:800, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          Upgrade to Premium <span>→</span>
        </button>
      </div>
    </div>
  );
};
