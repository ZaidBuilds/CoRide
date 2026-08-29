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
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Navigation size={18} style={{ color: 'var(--accent-blue)' }} />
          Where are you right now?
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {showInline ? 'Tap your station to get the right room. You can change anytime.' : 'Low confidence auto-detect — pick your station to join the right room. +50 confidence boost.'}
        </p>
        {!showInline && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.08)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Shield size={12} />
            Your exact coach/seat is never shared. Only station/line is used.
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
          <input
            placeholder="Search station e.g. Rajiv Chowk"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          />
        </div>
        <select
          value={selectedLine}
          onChange={e => setSelectedLine(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
        >
          <option value="all">All lines</option>
          {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.slice(0, 30).map(({ station, line }) => (
          <button
            key={`${line.id}:${station.id}`}
            onClick={() => onConfirm(station, line)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
            onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: line.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                <MapPin size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{station.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.name} • {station.isInterchange ? 'Interchange' : station.isUnderground ? 'Underground' : 'Elevated'}</div>
              </div>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-indigo)' }}>
              <Check size={14} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>No stations match “{search}”</div>
        )}
        {filtered.length > 30 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>Showing 30 of {filtered.length} — refine search</div>
        )}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
        <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onDismiss}>
          Keep auto-detect
        </button>
      </div>
    </div>
  );

  if (showInline) {
    return <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: 16 }}>{content}</div>;
  }

  return (
    <div className="drawer-overlay" onClick={onDismiss} style={{ zIndex: 60 }}>
      <div className="drawer-panel animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '85vh', padding: 0, overflow: 'hidden' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-muted)', margin: '12px auto 0' }} />
        {content}
      </div>
    </div>
  );
};
