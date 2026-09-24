import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MagnifyingGlassIcon, XIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import type { MetroLine, MetroStation } from '../types';
import { DELHI_METRO_LINES } from '../data/metroData';
import { ProfileSheet } from './ProfileSheet';
import { API } from '../config';
import { Button } from './ui/Button';
import { LinePill } from './ui/LinePill';
import { lineStyle } from '../utils/lineStyle';

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

/** Lowercase, unify "Sector"/"Sec", strip punctuation, so "sec 18" finds "Noida Sector 18 (Atta Market)". */
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
 * "Where are you?": pick a station to join the right room.
 * Renders instantly from the bundled line data and swaps in the server's
 * active-line list when it arrives (so a beachhead launch shows only its line).
 * No query: stations grouped by line in route order, with sticky line headers.
 * Query: one ranked list; each row carries its line colour.
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

  const shortName = (l: MetroLine) => l.name.replace(/\s*\(.*\)\s*$/, '').replace(/\s+Line$/i, '');

  /**
   * One stop on a route diagram: a 4px stripe in the line colour runs through
   * every row of a line group (continuous = the line), with a hollow node per
   * stop. In search results each row carries its own short stripe plus a pill.
   */
  const renderRow = (station: MetroStation, line: MetroLine, showLine: boolean, pos?: 'first' | 'last' | 'only') => {
    const others = (station.interchangeLines || []).map(lineName).filter((l): l is MetroLine => !!l && l.id !== line.id);
    return (
      <button
        key={`${line.id}:${station.id}`}
        type="button"
        data-station-row
        onClick={() => pick(station, line)}
        aria-label={`${station.name}, ${line.name}${others.length ? `, interchange with ${others.map(o => o.name).join(', ')}` : ''}`}
        className="list-row press-row"
        style={{ ...lineStyle(line.color), minHeight: 56, padding: '6px 8px 6px 4px', gap: 12, border: 'none', borderRadius: 'var(--radius-input)', cursor: 'pointer' }}
      >
        <span aria-hidden="true" style={{ position: 'relative', width: 20, alignSelf: 'stretch', flexShrink: 0, display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
          {!showLine && (
            <span style={{ position: 'absolute', top: pos === 'first' || pos === 'only' ? '50%' : 0, bottom: pos === 'last' || pos === 'only' ? '50%' : 0, width: 4, left: 8, background: 'var(--line)' }} />
          )}
          {showLine && <span style={{ position: 'absolute', top: 14, bottom: 14, width: 4, left: 8, borderRadius: 2, background: 'var(--line)' }} />}
          <span style={{ position: 'relative', alignSelf: 'center', width: 12, height: 12, borderRadius: '50%', background: 'var(--bg-surface)', border: '3px solid var(--line)', boxShadow: others.length ? '0 0 0 2px var(--bg-surface), 0 0 0 3.5px var(--text-primary)' : undefined }} />
        </span>
        <span className="row-text">
          <span className="row-title" style={{ fontSize: 16, lineHeight: '21px' }}>{station.name}</span>
          <span className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showLine && <LinePill line={line} label={shortName(line)} size="sm" />}
            {station.hindiName && <span lang="hi" className="type-hi">{station.hindiName}</span>}
          </span>
        </span>
        {others.length > 0 && (
          <span aria-hidden="true" title="Interchange" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 }}>
            {others.slice(0, 3).map(o => <LinePill key={o.id} line={o} label={shortName(o)} size="sm" />)}
          </span>
        )}
      </button>
    );
  };

  const stickyBg = 'var(--bg-surface)';

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
          <h2 id="station-picker-title" className="type-title" style={{ color: 'var(--text-primary)' }}>
            Where are you?
          </h2>
          <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Pick your station so you land in the right room.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss} style={{ marginTop: -6, marginRight: -12, flexShrink: 0 }}>
          Not now
        </Button>
      </div>

      <div style={{ position: 'relative', marginTop: 14 }}>
        <MagnifyingGlassIcon size={20} aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          aria-label="Search stations"
          aria-describedby="station-picker-hint"
          placeholder="Search a station, e.g. Rajiv Chowk"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          className="input"
          style={{ paddingLeft: 44, paddingRight: 48, WebkitAppearance: 'none', appearance: 'none' }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="icon-btn plain"
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          >
            <XIcon size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Line filter: the lines themselves, as pills */}
      {lines.length > 1 && (
        <div
          role="group"
          aria-label="Filter by line"
          style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', margin: `6px -${gutter}px 0`, padding: `0 ${gutter - 4}px`, scrollbarWidth: 'none' }}
        >
          {[{ id: 'all', name: 'All lines', color: '' } as Pick<MetroLine, 'id' | 'name' | 'color'>, ...lines].map(l => {
            const active = lineFilter === l.id;
            const dim = lineFilter !== 'all' && !active;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={active}
                aria-label={l.id === 'all' ? 'All lines' : l.name}
                onClick={() => setLineFilter(l.id)}
                style={{ flexShrink: 0, minHeight: 'var(--tap)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              >
                {l.id === 'all' ? (
                  <span
                    className="type-label"
                    style={{
                      display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 'var(--radius-pill)',
                      background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--ink-inverse)' : 'var(--text-secondary)',
                      border: active ? '1px solid var(--ink)' : '1px solid var(--border-strong)'
                    }}
                  >
                    All
                  </span>
                ) : (
                  <LinePill
                    line={l as MetroLine}
                    label={shortName(l as MetroLine)}
                    style={{
                      height: 28, padding: '0 12px', opacity: dim ? 0.4 : 1,
                      boxShadow: active ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--text-primary)' : undefined,
                      transition: 'opacity var(--dur-micro) var(--ease-standard)'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
      <p id="station-picker-hint" className="type-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginTop: 4 }}>
        <ShieldCheckIcon size={16} aria-hidden="true" /> Other riders only see your station and line.
      </p>
    </div>
  );

  const body = (
    <div ref={listRef} onKeyDown={onListKey} style={{ padding: showInline ? '0 12px 12px' : '4px 0 8px' }}>
      {q ? (
        results.length > 0 ? (
          <div role="list" aria-label={`${results.length} matching stations`}>
            <div aria-live="polite" className="type-meta tnum" style={{ color: 'var(--text-muted)', padding: '8px 4px' }}>
              {results.length} {results.length === 1 ? 'station' : 'stations'}
            </div>
            {results.map(r => <div role="listitem" key={`${r.line.id}:${r.station.id}`}>{renderRow(r.station, r.line, true)}</div>)}
          </div>
        ) : (
          <div role="status" style={{ padding: '32px 4px' }}>
            <p className="type-headline" style={{ color: 'var(--text-primary)' }}>No station called "{query.trim()}"</p>
            <p className="type-body" style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
              {lineFilter !== 'all' ? 'It may be on another line.' : 'Check the spelling, or try part of the name.'}
            </p>
            {lineFilter !== 'all' && (
              <Button type="button" variant="tonal" onClick={() => setLineFilter('all')}>Search all lines</Button>
            )}
          </div>
        )
      ) : (
        visibleLines.map(line => (
          <section key={line.id} aria-label={line.name} style={lineStyle(line.color)}>
            <h3
              style={{
                position: showInline ? 'static' : 'sticky', top: headerH, zIndex: 1,
                display: 'flex', alignItems: 'center', gap: 8,
                margin: showInline ? 0 : '0 -20px', padding: showInline ? '16px 4px 8px' : '16px 20px 8px',
                background: showInline ? 'transparent' : stickyBg
              }}
            >
              <LinePill line={line} />
              <span className="type-meta" style={{ color: 'var(--text-muted)' }}>
                {line.terminalA} to {line.terminalB}
              </span>
            </h3>
            <div role="list">
              {line.stations.map((st, i) => (
                <div role="listitem" key={st.id}>
                  {renderRow(st, line, false, line.stations.length === 1 ? 'only' : i === 0 ? 'first' : i === line.stations.length - 1 ? 'last' : undefined)}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );

  if (showInline) {
    return (
      <div className="card" role="region" aria-labelledby="station-picker-title" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
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
