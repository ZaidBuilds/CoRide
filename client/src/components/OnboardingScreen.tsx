import { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';

const API = 'http://localhost:4000';

interface Props {
  user: UserProfile;
  onComplete: (updated: UserProfile) => void;
  onSkip: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ user, onComplete, onSkip }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [line, setLine] = useState('blue');
  const [from, setFrom] = useState('rajiv_chowk');
  const [to, setTo] = useState('noida_sec_18');
  const [tags, setTags] = useState<string[]>(user.interestTags || []);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(()=>{ fetch(`${API}/api/metro/lines`).then(r=>r.json()).then(d=> setLines(d.lines||[])).catch(()=>{}); }, []);

  const toggleTag = (id: string) => {
    setTags(prev => prev.includes(id) ? prev.filter(t=>t!==id) : prev.length<5 ? [...prev, id] : prev);
  };

  const saveJourney = async () => {
    // save commute pattern
    const lineObj = lines.find(l=>l.id===line) || lines[0];
    const fromSt = lineObj?.stations.find((s:any)=> s.id===from);
    const toSt = lineObj?.stations.find((s:any)=> s.id===to);
    const stationName = fromSt?.name || 'Rajiv Chowk';
    const lineName = lineObj?.name || 'Blue Line';
    const lineColor = lineObj?.color || '#0284c7';
    const direction = `Towards ${toSt?.name || 'Noida'}`;
    try {
      await fetch(`${API}/api/commute/patterns`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        userId: user.id, lineId: line, lineName, lineColor, stationId: from, stationName, direction, targetTime:'08:30', daysOfWeek:['Mon','Tue','Wed','Thu','Fri'], label: `${stationName} → ${toSt?.name || 'Noida'}`
      })});
    } catch {}
    setStep(2);
  };

  const finish = async () => {
    try {
      const r = await fetch(`${API}/api/profile/${user.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ interestTags: tags })});
      const j = await r.json();
      if (r.ok) {
        localStorage.setItem('coride_profile', JSON.stringify(j.profile));
        onComplete(j.profile);
      } else onComplete({ ...user, interestTags: tags });
    } catch { onComplete({ ...user, interestTags: tags }); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'var(--bg-base)', overflowY:'auto', padding:'calc(16px + env(safe-area-inset-top)) 12px calc(24px + env(safe-area-inset-bottom))' }}>
      {/* Progress header */}
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <button onClick={onSkip} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12 }}><span style={{ fontSize:18 }}>←</span></button>
          <div style={{ flex:1, margin:'0 16px', height:4, borderRadius:999, background:'var(--bg-surface)', display:'flex', gap:4, alignItems:'center' }}>
            <div style={{ flex:1, height:4, borderRadius:999, background: step>=1 ? 'linear-gradient(90deg, var(--accent-purple), var(--accent-pink))' : 'var(--border-subtle)' }} />
            <div style={{ flex:1, height:4, borderRadius:999, background: step>=2 ? 'linear-gradient(90deg, var(--accent-purple), var(--accent-pink))' : 'var(--border-subtle)' }} />
            <div style={{ flex:1, height:4, borderRadius:999, background:'var(--border-subtle)' }} />
          </div>
          <button onClick={onSkip} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:12, fontWeight:600 }}>Skip</button>
        </div>

        {step===1 ? (
          <div className="animate-fade-in">
            <h2 style={{ fontSize:22, fontWeight:900, textAlign:'center', lineHeight:1.2 }}>Where do you<br/>often travel?</h2>
            <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:6 }}>Select your metro line and preferred route.</p>

            <div style={{ margin:'20px auto 0', width:'100%', maxWidth:320, height:180, borderRadius:'var(--radius-xl)', background:'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)', border:'1px solid var(--border-card)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, opacity:0.12, background:'radial-gradient(circle at 50% 30%, var(--accent-purple), transparent 60%)' }} />
              <div style={{ fontSize:48 }}>🚇</div>
              <div style={{ position:'absolute', bottom:12, left:12, right:12, height:2, background:'linear-gradient(90deg, var(--accent-purple), var(--accent-pink))', borderRadius:999, opacity:0.6 }} />
              <div style={{ position:'absolute', top:12, right:14, width:10,height:10, borderRadius:'50%', background:'var(--accent-pink)', boxShadow:'0 0 8px var(--accent-pink)' }} />
              <div style={{ position:'absolute', bottom:24, left:18, width:10,height:10, borderRadius:'50%', background:'var(--accent-purple)', border:'2px solid white' }} />
            </div>

            <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:10 }}>
              <label style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>Select Metro Line
                <select value={line} onChange={e=> setLine(e.target.value)} style={{ marginTop:6, width:'100%', padding:'12px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border-card)', color:'var(--text-primary)', fontSize:16 }}>
                  {lines.map((l:any)=> <option key={l.id} value={l.id}>{l.name}</option>)}
                  {lines.length===0 && <option value="blue">Blue Line</option>}
                </select>
              </label>
              <label style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>From Station
                <select value={from} onChange={e=> setFrom(e.target.value)} style={{ marginTop:6, width:'100%', padding:'12px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border-card)', color:'var(--text-primary)', fontSize:16 }}>
                  {(lines.find((l:any)=>l.id===line)?.stations || [{id:'rajiv_chowk', name:'Rajiv Chowk'},{id:'mandi_house', name:'Mandi House'},{id:'noida_sec_18', name:'Noida Sector 18'}]).map((s:any)=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>To Station
                <select value={to} onChange={e=> setTo(e.target.value)} style={{ marginTop:6, width:'100%', padding:'12px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border-card)', color:'var(--text-primary)', fontSize:16 }}>
                  {(lines.find((l:any)=>l.id===line)?.stations || [{id:'noida_sec_18', name:'Noida Sector 18'}]).map((s:any)=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <button onClick={saveJourney} style={{ marginTop:8, padding:'14px', borderRadius:'var(--radius-full)', background:'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))', border:'none', color:'white', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                Continue <ArrowRight size={16}/>
              </button>
            </div>

            <div style={{ marginTop:20, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ width:36,height:36, borderRadius:'50%', background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}><ShieldCheck size={18}/></div>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>Your safety is our priority</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>No exact location • Block & Report • Verified Environment</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <h2 style={{ fontSize:22, fontWeight:900, textAlign:'center', lineHeight:1.2 }}>What are you<br/>interested in?</h2>
            <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:6 }}>Choose a few topics you love.</p>

            <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {INTEREST_TAXONOMY.slice(0,12).map(t=> {
                const active = tags.includes(t.id);
                return (
                  <button key={t.id} onClick={()=> toggleTag(t.id)} style={{
                    padding:'14px 12px', borderRadius:'var(--radius-lg)',
                    background: active ? 'rgba(123,93,255,0.16)' : 'var(--bg-card)',
                    border:`1px solid ${active ? 'rgba(123,93,255,0.32)' : 'var(--border-card)'}`,
                    color: active ? '#C4B5FF' : 'var(--text-secondary)', fontSize:12, fontWeight:700,
                    display:'flex', alignItems:'center', gap:8, justifyContent:'flex-start'
                  }}>
                    <span style={{ fontSize:16 }}>{t.emoji}</span> {t.label}
                    {active && <span style={{ marginLeft:'auto', width:18,height:18, borderRadius:'50%', background:'var(--accent-purple)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={finish} disabled={tags.length===0} style={{ marginTop:16, width:'100%', padding:'14px', borderRadius:'var(--radius-full)', background: tags.length? 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))' : 'var(--bg-surface)', border:'none', color:'white', fontWeight:800, fontSize:14, opacity: tags.length?1:0.5, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              Continue <ArrowRight size={16}/>
            </button>
            <p style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', marginTop:8 }}>{tags.length}/5 selected • You can change later in Profile</p>
          </div>
        )}
      </div>
    </div>
  );
};
