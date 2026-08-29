import { useEffect, useState } from 'react';
import { MapPin, Check, Search, Navigation, Shield } from 'lucide-react';
import type { MetroLine, MetroStation } from '../types';

const API = 'http://localhost:4000';

interface Props {
  onConfirm: (station: MetroStation, line: MetroLine) => void;
  onDismiss: () => void;
  showInline?: boolean;
}

export const StationPicker: React.FC<Props> = ({ onConfirm, onDismiss, showInline }) => {
  const [lines, setLines] = useState<MetroLine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<string>('all');

  useEffect(() => {
    fetch(`${API}/api/metro/lines`).then(r => r.json()).then(d => setLines(d.lines || [])).catch(() => {});
  }, []);

  const allStations: { station: MetroStation; line: MetroLine }[] = [];
  for (const line of lines) {
    for (const st of line.stations) {
      allStations.push({ station: st, line });
    }
  }

  const filtered = allStations.filter(({ station, line }) => {
    if (selectedLine !== 'all' && line.id !== selectedLine) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return station.name.toLowerCase().includes(q) || station.hindiName.includes(search) || line.name.toLowerCase().includes(q);
  });

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: showInline ? 420 : '70vh' }}>
      <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--border-subtle)', background:'var(--bg-elevated)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: 10, letterSpacing:-0.2 }}>
          <span style={{ width:32,height:32, borderRadius:'50%', background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7B5DFF' }}>
            <Navigation size={16} />
          </span>
          Where are you now?
        </h3>
        <p style={{ fontSize: 12, color:'var(--text-secondary)', margin:'8px 0 0', lineHeight:1.4 }}>
          {showInline ? 'Tap your station to get the right room. You can change anytime.' : 'Low confidence — pick your station to join the right room. +50 boost, coach never shared.'}
        </p>
        {!showInline && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color:'#FDE68A', background:'rgba(234,179,8,0.08)', padding:'8px 10px', borderRadius:'var(--radius-md)', border:'1px solid rgba(234,179,8,0.14)' }}>
            <Shield size={14} style={{ color:'#FDE68A' }} />
            Your exact coach is never shared — only station & line.
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', background:'var(--bg-surface)' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, color:'var(--text-muted)' }} />
          <input
            placeholder="Search Rajiv Chowk"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding:'10px 12px 10px 34px', borderRadius:'var(--radius-full)', background:'var(--bg-input)', border:'1px solid var(--border-subtle)', color:'white', fontSize:13, outline:'none' }}
          />
        </div>
        <select
          value={selectedLine}
          onChange={e => setSelectedLine(e.target.value)}
          style={{ padding:'10px 12px', borderRadius:'var(--radius-full)', background:'var(--bg-input)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', fontSize:12, fontWeight:700 }}
        >
          <option value="all">All lines</option>
          {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, background:'var(--bg-base)' }}>
        {filtered.slice(0, 30).map(({ station, line }) => (
          <button
            key={`${line.id}:${station.id}`}
            onClick={() => onConfirm(station, line)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius:'var(--radius-lg)',
              background:'var(--bg-card)',
              border:'1px solid var(--border-card)',
              cursor: 'pointer',
              textAlign: 'left',
              transition:'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius:'50%', background: line.color, display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.25)' }}>
                <MapPin size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color:'white' }}>{station.name}</div>
                <div style={{ fontSize: 11, color:'var(--text-muted)', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:7,height:7, borderRadius:'50%', background: line.color, display:'inline-block' }} /> {line.name} • {station.isInterchange ? 'Interchange' : station.isUnderground ? 'Underground' : 'Elevated'}
                </div>
              </div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius:'50%', background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7B5DFF' }}>
              <Check size={16} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:24, fontSize:12, color:'var(--text-muted)', border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-lg)', background:'var(--bg-card)' }}>No stations for “{search}”</div>
        )}
        {filtered.length > 30 && (
          <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', padding:8 }}>Showing 30 of {filtered.length} — refine search</div>
        )}
      </div>

      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-elevated)', display:'flex', gap:8 }}>
        <button onClick={onDismiss} style={{ flex:1, padding:'12px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-card)', color:'var(--text-secondary)', fontWeight:700, fontSize:13 }}>
          Keep auto-detect
        </button>
      </div>
    </div>
  );

  if (showInline) {
    return <div className="glass-panel" style={{ overflow:'hidden', marginBottom:16, borderRadius:'var(--radius-xl)' }}>{content}</div>;
  }

  return (
    <div className="drawer-overlay" onClick={onDismiss} style={{ zIndex: 60, background:'rgba(5,5,12,0.72)', backdropFilter:'blur(16px)' }}>
      <div className="drawer-panel animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight:'86vh', padding:0, overflow:'hidden', background:'#12121A', border:'1px solid var(--border-card)', borderRadius:'var(--radius-2xl) var(--radius-2xl) 0 0' }}>
        <div style={{ width:40,height:4, borderRadius:999, background:'rgba(255,255,255,0.18)', margin:'12px auto 0' }} />
        {content}
      </div>
    </div>
  );
};
