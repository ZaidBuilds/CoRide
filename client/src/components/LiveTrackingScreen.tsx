import { Train, Share2, MoreVertical, Users, Navigation } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export const LiveTrackingScreen: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={onBack} aria-label="Back" style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)' }}>←</button>
        <h2 style={{ fontSize:16, fontWeight:800 }}>Live Tracking</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button aria-label="Share journey" style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><Share2 size={14}/></button>
          <button aria-label="More options" style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><MoreVertical size={14}/></button>
        </div>
      </div>

      {/* Blue Line card */}
      <div style={{ background:'linear-gradient(135deg, var(--bg-accent-wash-2), var(--bg-accent-wash))', border:'1px solid rgba(123,93,255,0.22)', borderRadius:'var(--radius-xl)', padding:14, display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ width:44,height:44, borderRadius:12, background:'var(--accent-purple)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}><Train size={20}/></div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>Blue Line</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Rajiv Chowk → Noida Sec 18</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'var(--presence-active)', fontWeight:700, display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}><span style={{ width:6,height:6, borderRadius:'50%', background:'var(--presence-active)', display:'inline-block' }} /> On Time</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Next stop in</div>
          <div style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)' }}>3 min</div>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 280, borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid var(--border-card)', overflow:'hidden', position:'relative', marginBottom:12 }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 30% 40%, rgba(123,93,255,0.08), transparent 60%), linear-gradient(180deg, var(--bg-base) 0%, var(--bg-elevated) 100%)' }} />
        {/* Fake map grid */}
        <div style={{ position:'absolute', inset:0, opacity:0.08, backgroundImage:'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize:'24px 24px' }} />
        <svg viewBox="0 0 320 260" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
          <path d="M 40 140 C 100 60, 160 200, 280 110" fill="none" stroke="#7B5DFF" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          <circle cx="40" cy="140" r="6" fill="#7B5DFF" stroke="white" strokeWidth="2" />
          <circle cx="120" cy="100" r="14" fill="#7B5DFF" stroke="white" strokeWidth="3" />
          <foreignObject x="108" y="88" width="24" height="24"><div style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🚇</div></foreignObject>
          <circle cx="200" cy="135" r="5" fill="white" stroke="#7B5DFF" strokeWidth="2" />
          <circle cx="280" cy="110" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
        </svg>
        <div style={{ position:'absolute', top:10, right:10, display:'flex', flexDirection:'column', gap:8 }}>
          <button aria-label="Recentre map" style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)' }}><Navigation size={16}/></button>
          <button aria-label="Change map layer" style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)' }}>◈</button>
        </div>
        <div style={{ position:'absolute', top: 22, left: 50, background:'var(--bg-elevated)', border:'1px solid var(--border-card)', borderRadius:999, padding:'4px 8px', fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:8,height:8, borderRadius:'50%', background:'var(--presence-active)', display:'inline-block' }} /> Rajiv Chowk <span style={{ opacity:0.7 }}>Departed • 9:20 AM</span>
        </div>
        <div style={{ position:'absolute', top: 72, left: 150, background:'var(--accent-purple)', color:'white', fontSize:11, fontWeight:700, padding:'4px 8px', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <span>Barakhamba</span><span>Road</span><span style={{ fontSize:11, opacity:0.8 }}>9:34 AM</span>
        </div>
        <div style={{ position:'absolute', bottom: 54, right: 16, background:'var(--bg-elevated)', border:'1px solid var(--border-card)', borderRadius:999, padding:'6px 10px', fontSize:11, color:'var(--text-primary)', display:'flex', flexDirection:'column', alignItems:'center' }}>
          <span style={{ fontWeight:800 }}>Noida Sec 18</span><span style={{ color:'var(--text-muted)', fontSize:11 }}>Arrive • 9:52 AM</span>
        </div>
      </div>

      {/* Journey Progress */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)', padding:14, marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:800 }}>Journey Progress</span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>6 Stops • 32 min</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
          {[
            { name:'Rajiv Chowk', time:'9:20 AM', done:true },
            { name:'Barakhamba Road', time:'9:34 AM', done:true },
            { name:'Mandi House', time:'Next • 9:37 AM', active:true },
            { name:'Pragati Maidan', time:'9:41 AM', done:false },
            { name:'Noida Sec 18', time:'9:52 AM', end:true },
          ].map((s,idx)=>(
            <div key={s.name} style={{ flex:1, textAlign:'center' }}>
              <div style={{ width:28,height:28, borderRadius:'50%', margin:'0 auto 6px', background: s.done ? '#10B981' : s.active ? 'var(--accent-purple)' : 'var(--bg-surface)', border: s.active ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color: s.done || s.active ? 'white' : 'var(--text-muted)', fontSize:11 }}>
                {s.done ? '✓' : s.active ? '🚇' : s.end ? '●' : '○'}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color: s.active ? 'var(--accent-purple-text)' : 'var(--text-primary)', lineHeight:1.2 }}>{s.name}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.time}</div>
              {idx<4 && <div style={{ height:2, background: s.done ? '#10B981' : 'var(--border-subtle)', margin:'6px 0' }} />}
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:10, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--accent-purple-text)', fontWeight:700, display:'flex', alignItems:'center', gap:4, justifyContent:'center' }}><Users size={12}/> Crowd in Coach</div>
            <div style={{ fontSize:12, color:'var(--accent-amber)', fontWeight:700 }}>Moderate</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:2, justifyContent:'center', marginTop:4 }}>👥👥👥👥👥<span style={{ opacity:0.3 }}>👥👥</span></div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Not too crowded</div>
          </div>
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:10, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--accent-blue)', fontWeight:700 }}>Arrival Alert</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Noida Sec 18</div>
            <div style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', marginTop:4 }}>9:52 AM</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>You’ll get off in 15 min</div>
          </div>
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:10, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--accent-rose-text)', fontWeight:700 }}>Total Time</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>To Destination</div>
            <div style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', marginTop:4 }}>32 min</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Including 6 stops</div>
          </div>
        </div>
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32,height:32, borderRadius:8, background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>🎫</div>
          <div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--accent-purple-text)' }}>Save this Journey</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Get quick access next time</div>
          </div>
        </div>
        <label style={{ position:'relative', display:'inline-block', width:44, height:26 }}>
          <input type="checkbox" aria-label="Save this journey" style={{ opacity:0, width:0, height:0 }} />
          <span style={{ position:'absolute', inset:0, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:999 }} />
          <span style={{ position:'absolute', top:3, left:3, width:18, height:18, borderRadius:'50%', background:'white', transition:'0.2s' }} />
        </label>
      </div>
    </div>
  );
};
