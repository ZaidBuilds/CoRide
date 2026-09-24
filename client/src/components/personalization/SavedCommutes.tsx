import { useEffect, useState } from 'react';
import { Clock, MapPin, Trash2, Zap, Star } from 'lucide-react';
import type { CommutePattern } from '../../types';
import { API } from '../../config';


interface Props {
  userId: string;
  currentStationId?: string;
  onUse: (pattern: CommutePattern, room?: any) => void;
}

export const SavedCommutes: React.FC<Props> = ({ userId, onUse }) => {
  const [patterns, setPatterns] = useState<CommutePattern[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<CommutePattern>>({ targetTime: '08:30', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri'], label: '' });

  // Distinguishes "no saved commutes" from "still loading" / "request failed"
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = async () => {
    setStatus('loading');
    try {
      const r = await fetch(`${API}/api/commute/patterns/${userId}`);
      const j = await r.json();
      setPatterns(j.patterns || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  useEffect(()=>{ if(userId) load(); }, [userId]);

  const add = async () => {
    // Use current context as defaults if not filled — we just save form + last station fallback
    // For demo we default to blue line rajiv chowk if not set
    const payload: any = {
      userId,
      lineId: (form as any).lineId || 'blue',
      lineName: (form as any).lineName || 'Blue Line',
      lineColor: (form as any).lineColor || '#0284c7',
      stationId: (form as any).stationId || 'rajiv_chowk',
      stationName: (form as any).stationName || 'Rajiv Chowk',
      direction: (form as any).direction || 'Towards Noida Electronic City',
      targetTime: form.targetTime,
      daysOfWeek: form.daysOfWeek,
      label: form.label
    };
    const r = await fetch(`${API}/api/commute/patterns`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const j = await r.json();
    if (j.pattern) { setPatterns(prev=> [...prev, j.pattern].slice(-5)); setShowAdd(false); }
  };

  const remove = async (id: string) => {
    await fetch(`${API}/api/commute/patterns/${userId}/${id}`, { method:'DELETE' });
    setPatterns(prev=> prev.filter(p=>p.id!==id));
  };
  const use = async (p: CommutePattern) => {
    try {
      const r = await fetch(`${API}/api/commute/patterns/${userId}/${p.id}/use`, { method:'POST' });
      const j = await r.json();
      onUse(j.pattern || p, j.room);
    } catch { onUse(p); }
  };

  return (
    <div className="glass-panel" style={{ padding:14, borderRadius:'var(--radius-lg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <h3 style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:6 }}>
          <Clock size={14} style={{color:'var(--accent-purple-text)'}}/> Saved commute
          {patterns.length>0 && <span style={{ fontSize:11, padding:'2px 6px', borderRadius:999, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)' }}>{patterns.length}/5</span>}
        </h3>
        <button onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:11, padding:'6px 10px', borderRadius:'var(--radius-full)', background: showAdd?'var(--bg-surface)':'var(--accent-indigo)', color: showAdd?'var(--text-secondary)':'white', border:'1px solid var(--border-subtle)', cursor:'pointer' }}>{showAdd?'Close':'＋ Add'}</button>
      </div>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>One-tap repeat entry — saves line + station + direction + time. Network grows as you repeat.</p>

      {showAdd && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:10, borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', marginBottom:10 }}>
          <input aria-label="Commute label" placeholder="Label e.g. College → Office" value={form.label||''} onChange={e=>setForm({...form, label:e.target.value})} maxLength={20} style={{ padding:'8px 10px', borderRadius:'var(--radius-md)', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:16 }}/>
          <div style={{ display:'flex', gap:6 }}>
            <input type="time" aria-label="Departure time" value={form.targetTime} onChange={e=>setForm({...form, targetTime:e.target.value})} style={{ flex:1, padding:'8px 10px', borderRadius:'var(--radius-md)', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:16 }}/>
            <button onClick={add} className="btn-primary" style={{ padding:'8px 14px', fontSize:12 }}><Star size={12}/> Save</button>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>Defaults to Blue Line • Rajiv Chowk • Noida direction. Edit via patterns API for precise station.</div>
        </div>
      )}

      {status==='loading' ? (
        <div aria-busy="true" aria-label="Loading saved commutes" style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[0,1].map(i=> <div key={i} className="skeleton" style={{ height:60 }} />)}
        </div>
      ) : status==='error' ? (
        <div role="alert" style={{ textAlign:'center', padding:'16px 12px', border:'1px solid rgba(244,63,94,0.22)', borderRadius:'var(--radius-md)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--accent-rose-text)' }}>Couldn't load saved commutes</div>
          <button onClick={load} className="btn-secondary" style={{ marginTop:10 }}>Try again</button>
        </div>
      ) : patterns.length===0 ? (
        <div style={{ textAlign:'center', padding:'16px 12px', border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-md)', fontSize:13, color:'var(--text-muted)', lineHeight:1.5 }}>
          No saved commutes yet. Add your daily pattern to re-enter in one tap.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {patterns.map(p=> (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)' }}>
              <div style={{ width:36, height:36, borderRadius:8, background: p.lineColor, display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}><MapPin size={16}/></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', lineHeight:1.1 }}>{p.label || `${p.stationName} → ${p.direction.replace('Towards ','')}`}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.lineName} • {p.stationName} • {p.targetTime} • {p.daysOfWeek.join(',')}</div>
                {p.lastUsedAt && <div style={{ fontSize:11, color:'var(--text-muted)' }}>Used {p.useCount}x • last {new Date(p.lastUsedAt).toLocaleDateString()}</div>}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={()=>use(p)} style={{ padding:'7px 12px', borderRadius:'var(--radius-full)', background:'var(--accent-emerald)', color:'black', border:'none', fontWeight:800, fontSize:11, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
                  <Zap size={12}/> Go
                </button>
                <button onClick={()=>remove(p.id)} aria-label={`Delete saved commute ${p.label || p.stationName}`} style={{ width:44, height:44, borderRadius:'50%', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
