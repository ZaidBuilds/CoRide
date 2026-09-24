import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search, X, Shield } from 'lucide-react';
import type { MetroLine, MetroStation } from '../types';
import { DELHI_METRO_LINES } from '../data/metroData';
import { ProfileSheet } from './ProfileSheet';
import { API } from '../config';

interface Props {
  onConfirm: (station: MetroStation, line: MetroLine) => void;
  onDismiss: () => void;
  showInline?: boolean;
}

interface Row {
  station: MetroStation;
  line: MetroLine;
  score: number;
}

/** Lowercase, unify "Sector"/"Sec", strip punctuation — so "sec 18" finds "Noida Sector 18 (Atta Market)". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bsector\b/g, 'sec')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .trim();
}

/** Lower is better; -1 = no match. */
function matchScore(station: MetroStation, line: MetroLine, q: string, rawQ: string): number {
  const name = norm(station.name);
  if (name.startsWith(q)) return 0;
  const tokens = q.split(' ');
  const words = name.split(' ');
  if (tokens.every(t => words.some(w => w.startsWith(t)))) return 1;
  if (name.includes(q)) return 2;
  if (station.hindiName && station.hindiName.includes(rawQ.trim())) return 2;
  if (norm(line.name).includes(q)) return 3;
  return -1;
}

const ROW_SELECTOR = '[data-station-row]';

/**
 * "Where are you now?" — pick a station to join the right room.
 * Renders instantly from the bundled line data and swaps in the server's
 * active-line list when it arrives (so a beachhead launch shows only its line).
 * No query → stations grouped by line in route order, with sticky line headers.
 * Query → one ranked list; each row carries its line colour.
 */
export const StationPicker: React.FC<Props> = ({ onConfirm, onDismiss, showInline }) => {
  const [lines, setLines] = useState<MetroLine[]>(DELHI_METRO_LINES);
  const [query, setQuery] = useState('');
  const [lineFilter, setLineFilter] = useState<string>('all');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  // Line headers stick just below the (variable-height) search header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || showInline || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showInline]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/api/metro/lines`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines); })
      .catch(() => { /* offline: bundled data is already on screen */ });
    return () => ctrl.abort();
  }, []);

  const q = norm(query);
  const visibleLines = lineFilter === 'all' ? lines : lines.filter(l => l.id === lineFilter);

  const results: Row[] = useMemo(() => {
    if (!q) return [];
    const out: Row[] = [];
    for (const line of visibleLines) {
      for (const station of line.stations) {
        const score = matchScore(station, line, q, query);
        if (score >= 0) out.push({ station, line, score });
      }
    }
    return out.sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name));
  }, [q, query, visibleLines]);

  const lineName = (id: string) => lines.find(l => l.id === id);

  const pick = (station: MetroStation, line: MetroLine) => onConfirm(station, line);

  const focusRow = (index: number) => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(ROW_SELECTOR) ?? []);
    if (!rows.length) return;
    const i = Math.max(0, Math.min(rows.length - 1, index));
    rows[i].focus();
    rows[i].scrollIntoView({ block: 'nearest' });
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(0); }
    if (e.key === 'Enter' && results[0]) { e.preventDefault(); pick(results[0].station, results[0].line); }
  };

  const onListKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(ROW_SELECTOR) ?? []);
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') focusRow(i + 1);
    else if (e.key === 'ArrowUp') { if (i === 0) inputRef.current?.focus(); else focusRow(i - 1); }
    else if (e.key === 'Home') focusRow(0);
    else focusRow(rows.length - 1);
  };

  const renderRow = (station: MetroStation, line: MetroLine, showLine: boolean) => {
    const others = (station.interchangeLines || []).map(lineName).filter((l): l is MetroLine => !!l && l.id !== line.id);
    return (
      <button
        key={`${line.id}:${station.id}`}
        type="button"
        data-station-row
        onClick={() => pick(station, line)}
        aria-label={`${station.name}, ${line.name}${others.length ? `, interchange with ${others.map(o => o.name).join(', ')}` : ''}`}
        className="list-row"
        style={{ minHeight: 60, padding: '10px 4px', gap: 14, borderRadius: 'var(--radius-md)' }}
      >
        {/* Route stripe + stop marker in the line's colour */}
        <span aria-hidden="true" style={{ position: 'relative', width: 16, alignSelf: 'stretch', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', top: -10, bottom: -10, width: 4, borderRadius: 2, background: line.color, opacity: showLine ? 0 : 0.55 }} />
          <span style={{ position: 'relative', alignSelf: 'center', width: 14, height: 14, borderRadius: '50%', background: 'var(--bg-surface)', border: `3px solid ${line.color}` }} />
        </span>
        <span className="row-text">
          <span className="row-title" style={{ fontSize: 15, fontWeight: 700 }}>{station.name}</span>
          <span className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {showLine && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{line.name}</span>}
            {showLine && station.hindiName && <span aria-hidden="true">·</span>}
            {station.hindiName && <span lang="hi">{station.hindiName}</span>}
          </span>
        </span>
        {others.length > 0 && (
          <span aria-hidden="true" title="Interchange" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            {others.slice(0, 3).map(o => (
              <span key={o.id} style={{ width: 10, height: 10, borderRadius: '50%', background: o.color, border: '2px solid var(--bg-surface)' }} />
            ))}
          </span>
        )}
      </button>
    );
  };

  const stickyBg = 'var(--bg-elevated)';

  const gutter = showInline ? 16 : 20;

  const header = (
    <div
      ref={headerRef}
      style={{
        position: showInline ? 'static' : 'sticky', top: 0, zIndex: 2,
        margin: showInline ? 0 : '0 -20px', padding: showInline ? '16px 16px 8px' : '0 20px 8px',
        background: stickyBg
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="station-picker-title" className="display" style={{ fontSize: 20, margin: 0, color: 'var(--text-primary)' }}>
            Where are you now?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
            Pick your station so you join the right room.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="pill-button plain"
          style={{ minHeight: 'var(--tap)', padding: '0 8px', marginTop: -8, flexShrink: 0 }}
        >
          Not now
        </button>
      </div>

      <div style={{ position: 'relative', marginTop: 12 }}>
        <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          aria-label="Search stations"
          aria-describedby="station-picker-hint"
          placeholder="Search station, e.g. Rajiv Chowk"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          style={{
            width: '100%', minHeight: 'var(--tap)', padding: '12px 44px 12px 42px', borderRadius: 'var(--radius-full)',
            background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 16,
            WebkitAppearance: 'none', appearance: 'none'
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Line filter chips */}
      {lines.length > 1 && (
        <div
          role="group"
          aria-label="Filter by line"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: `10px -${gutter}px 0`, padding: `0 ${gutter}px 2px`, scrollbarWidth: 'none' }}
        >
          {[{ id: 'all', name: 'All lines', color: '' }, ...lines].map(l => {
            const active = lineFilter === l.id;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={active}
                onClick={() => setLineFilter(l.id)}
                style={{
                  flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 'var(--radius-full)',
                  display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: active ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: active ? 'var(--bg-base)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--text-primary)' : 'var(--border-subtle)'}`
                }}
              >
                {l.color && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />}
                {l.name}
              </button>
            );
          })}
        </div>
      )}
      <p id="station-picker-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>
        <Shield size={13} aria-hidden="true" /> Other riders only see your station and line.
      </p>
    </div>
  );

  const body = (
    <div ref={listRef} onKeyDown={onListKey} style={{ padding: showInline ? '0 12px 12px' : '4px 0 8px' }}>
      {q ? (
        results.length > 0 ? (
          <div role="list" aria-label={`${results.length} matching stations`}>
            <div aria-live="polite" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', padding: '8px 4px' }}>
              {results.length} {results.length === 1 ? 'station' : 'stations'}
            </div>
            {results.map(r => <div role="listitem" key={`${r.line.id}:${r.station.id}`}>{renderRow(r.station, r.line, true)}</div>)}
          </div>
        ) : (
          <div role="status" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No stations match “{query.trim()}”</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 12px' }}>
              {lineFilter !== 'all' ? 'Try searching all lines.' : 'Check the spelling, or try part of the name.'}
            </p>
            {lineFilter !== 'all' && (
              <button type="button" className="pill-button secondary" onClick={() => setLineFilter('all')}>Search all lines</button>
            )}
          </div>
        )
      ) : (
        visibleLines.map(line => (
          <section key={line.id} aria-label={line.name}>
            <h3
              style={{
                position: showInline ? 'static' : 'sticky', top: headerH, zIndex: 1,
                display: 'flex', alignItems: 'center', gap: 8,
                margin: showInline ? 0 : '0 -20px', padding: showInline ? '12px 4px 6px' : '12px 24px 6px',
                background: showInline ? 'transparent' : stickyBg,
                fontSize: 13, fontWeight: 800, color: 'var(--text-primary)'
              }}
            >
              <span aria-hidden="true" style={{ width: 22, height: 6, borderRadius: 3, background: line.color }} />
              {line.name}
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{line.stations.length} stations</span>
            </h3>
            <div role="list">
              {line.stations.map(st => <div role="listitem" key={st.id}>{renderRow(st, line, false)}</div>)}
            </div>
          </section>
        ))
      )}
    </div>
  );

  if (showInline) {
    return (
      <div className="glass-panel" role="region" aria-labelledby="station-picker-title" style={{ overflow: 'hidden', marginBottom: 16, borderRadius: 'var(--radius-xl)' }}>
        {header}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>{body}</div>
      </div>
    );
  }

  return (
    <ProfileSheet open onClose={onDismiss} labelledBy="station-picker-title">
      {header}
      {body}
    </ProfileSheet>
  );
};
