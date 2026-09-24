import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ListNumbersIcon, MapTrifoldIcon, InfoIcon } from '@phosphor-icons/react';
import type { UserProfile, ContextResult, ContextRoom, MetroLine } from '../types';
import type { LocationContext } from '../hooks/useLocationContext';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getLineById } from '../data/metroData';
import { FriendsMetroMap } from './FriendsMetroMap';
import { railLayout, shortStationName, shortLineName, type RailCell, type RailGroup, type RailRow } from './transit/lineSegments';
import { triggerHaptic } from '../utils/nativeBridge';
import { lineStyle } from '../utils/lineStyle';
import { describeContext, CONFIDENT_CONTEXT } from '../utils/commuteContext';
import { ScreenHeader } from './ui/ScreenHeader';
import { LinePill } from './ui/LinePill';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';

interface Props {
  currentUser: UserProfile;
  friends: MetroFriend[];
  /** Engine v2 context (LocationContext) or the legacy shape. */
  currentContext?: LocationContext | ContextResult | null;
  activeRoom?: ContextRoom | null;
  onBack?: () => void;
  onOpenChat?: (friendId: string) => void;
  onOpenProfile?: (profile: UserProfile) => void;
  onContextUpdated?: (newCtx: ContextResult) => void;
  /** Opens the check-in screen to set/confirm station and direction. Button hidden until wired. */
  onOpenCheckIn?: () => void;
}

type Tab = 'route' | 'map';

/** Header height (ScreenHeader min-height) so the direction bar sticks just under it. */
const HEADER_H = 'calc(64px + var(--safe-top))';

/** Compact terminal label for the direction control: "Noida Electronic City / Vaishali" → "Noida / Vaishali". */
function terminalLabel(name: string): string {
  const clean = name.split(' (')[0].trim();
  if (clean.includes(' / ') && clean.length > 22) return clean.split(' / ').map(p => p.split(' ')[0]).join(' / ');
  return clean;
}

type Item =
  | { kind: 'stop'; row: RailRow; key: string }
  | { kind: 'marker'; cells: RailCell[]; col: 0 | 1; group: RailGroup; key: string; label: string }
  | { kind: 'header'; cells: RailCell[]; key: string; label: string };

const passThrough = (prev: RailCell[] | undefined, columns: number): RailCell[] =>
  Array.from({ length: columns }, (_, c) => {
    const on = Boolean(prev?.[c]?.bottom);
    return { node: false, top: on, bottom: on };
  });

/**
 * Journey: the route diagram of a whole line, in travel order, with the
 * rider's own position when we know it. Static network data from metroData;
 * the only live input is the rider's context. No timetables, ETAs or crowding.
 */
export const LiveTrackingScreen: React.FC<Props> = ({
  currentUser,
  currentContext,
  activeRoom,
  onOpenProfile,
  onOpenCheckIn,
}) => {
  const rawCtx = (currentContext ?? null) as LocationContext | null;
  // source 'none' means the engine doesn't know where the rider is: draw nothing for them.
  const ctx = rawCtx && rawCtx.source !== 'none' && rawCtx.station ? rawCtx : null;
  const [tab, setTab] = useState<Tab>('route');

  const contextLine = ctx?.line ? getLineById(ctx.line) : undefined;
  const [selectedLineId, setSelectedLineId] = useState<string>(contextLine?.id || DELHI_METRO_LINES[0].id);
  const line: MetroLine = getLineById(selectedLineId) || DELHI_METRO_LINES[0];

  // Follow the rider's context when it changes line (render-time sync, no effect).
  const [syncedLine, setSyncedLine] = useState(contextLine?.id);
  if (contextLine && contextLine.id !== syncedLine) {
    setSyncedLine(contextLine.id);
    setSelectedLineId(contextLine.id);
  }

  const userOnThisLine = contextLine?.id === line.id;

  // The rider's direction: the engine's key when present, else the "Towards X" label.
  const ctxTowardsA = ctx?.directionKey
    ? ctx.directionKey === 'towards_a'
    : !!ctx?.direction && ctx.direction.toLowerCase().includes(line.terminalA.toLowerCase());
  const ctxDirectionKnown = ctx?.directionKey ? ctx.directionKnown !== false : !!ctx?.direction;

  // Viewer's choice per line; defaults to the rider's direction on their line.
  const [dirFor, setDirFor] = useState<Record<string, 'a' | 'b'>>({});
  const towardsA = dirFor[line.id]
    ? dirFor[line.id] === 'a'
    : userOnThisLine && ctxDirectionKnown ? ctxTowardsA : false;

  const layout = useMemo(() => railLayout(line, towardsA), [line, towardsA]);

  const headline = describeContext(rawCtx);
  const sure = !!ctx && ((ctx.confidence >= CONFIDENT_CONTEXT && !ctx.stale) || ctx.source === 'manual');
  const riding = !!ctx && (ctx.context === 'train' || ctx.movement === 'in_vehicle');
  const dimPast = userOnThisLine && riding && ctxDirectionKnown && ctxTowardsA === towardsA;

  // ── Display items: stops, branch headers and the "you" marker ────────────
  const { items, youKey } = useMemo(() => {
    const rows = layout.rows;
    const out: Item[] = [];
    rows.forEach((row, i) => {
      const prev = rows[i - 1];
      if (row.group !== 'trunk' && prev?.group !== row.group) {
        const term = row.group === 'main' ? layout.mainTerminal : layout.branchTerminal;
        out.push({
          kind: 'header',
          key: `h-${row.group}`,
          label: `${towardsA ? 'From' : 'To'} ${term}`,
          cells: passThrough(prev?.cells, layout.columns),
        });
      }
      out.push({ kind: 'stop', row, key: row.station.id });
    });

    let you: string | undefined;
    if (userOnThisLine && ctx) {
      const b = riding ? ctx.between : null;
      const fromIdx = b ? out.findIndex(it => it.kind === 'stop' && it.row.station.id === b.fromStationId) : -1;
      const toIdx = b ? out.findIndex(it => it.kind === 'stop' && it.row.station.id === b.toStationId) : -1;
      if (b && fromIdx >= 0 && toIdx >= 0) {
        const [ui, li] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const upper = (out[ui] as Extract<Item, { kind: 'stop' }>).row;
        const lower = (out[li] as Extract<Item, { kind: 'stop' }>).row;
        const col = upper.isFork ? lower.col : upper.col;
        const at = !upper.isFork && col === upper.col ? ui + 1 : li;
        const before = out[at - 1];
        const prevCells = before.kind === 'stop' ? before.row.cells : before.cells;
        const cells = passThrough(prevCells, layout.columns);
        cells[col] = { node: true, top: true, bottom: true };
        out.splice(at, 0, {
          kind: 'marker', key: 'you', col, cells,
          group: (upper.isFork ? lower : upper).group,
          label: `Between ${shortStationName(b.fromStationName)} and ${shortStationName(b.toStationName)}`,
        });
        you = 'you';
      } else if (ctx.station && rows.some(r => r.station.id === ctx.station)) {
        you = ctx.station;
      }
    }
    return { items: out, youKey: you };
  }, [layout, towardsA, userOnThisLine, ctx, riding]);

  const youIdx = youKey ? items.findIndex(it => it.key === youKey) : -1;
  const youItem = youIdx >= 0 ? items[youIdx] : undefined;
  const youGroup: RailGroup | undefined = youItem?.kind === 'stop' ? youItem.row.group : youItem?.kind === 'marker' ? youItem.group : undefined;
  const isPast = (it: Item, idx: number): boolean => {
    if (!dimPast || youIdx < 0 || idx >= youIdx) return false;
    const g = it.kind === 'stop' ? it.row.group : it.kind === 'marker' ? it.group : undefined;
    if (!g) {
      // Headers follow the item after them.
      const next = items[idx + 1];
      return next ? isPast(next, idx + 1) : false;
    }
    return g === youGroup || g === 'trunk' || youGroup === 'trunk';
  };

  // While riding, bring the rider's position into view once per line.
  const youRef = useRef<HTMLLIElement>(null);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== 'route' || !youKey || !dimPast || scrolledFor.current === `${line.id}:${youKey}`) return;
    scrolledFor.current = `${line.id}:${youKey}`;
    youRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [tab, youKey, line.id, dimPast]);

  const chooseLine = (id: string) => {
    triggerHaptic('light');
    setSelectedLineId(id);
  };
  const chooseDirection = (d: 'a' | 'b') => {
    if ((d === 'a') === towardsA) return;
    triggerHaptic('light');
    setDirFor(prev => ({ ...prev, [line.id]: d }));
  };

  const riders = activeRoom?.users?.filter(u => u.id !== currentUser.id) ?? [];

  const viewSwitch = (
    <div role="tablist" aria-label="Journey view" className="segmented" style={{ width: 176 }}>
      {([
        { id: 'route', label: 'Route', Icon: ListNumbersIcon },
        { id: 'map', label: 'Map', Icon: MapTrifoldIcon },
      ] as const).map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`journey-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`journey-panel-${t.id}`}
          className="segmented-option"
          onClick={() => { triggerHaptic('light'); setTab(t.id); }}
        >
          <t.Icon size={18} weight={tab === t.id ? 'fill' : 'regular'} aria-hidden="true" />
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ ...lineStyle(line), maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <ScreenHeader title="Journey" size="large" actions={viewSwitch} />

      {/* Line selection */}
      <div
        role="group"
        aria-label="Metro line"
        style={{ display: 'flex', gap: 4, overflowX: 'auto', margin: '0 calc(-1 * var(--gutter)) 12px', padding: '0 var(--gutter)', scrollbarWidth: 'none' }}
      >
        {DELHI_METRO_LINES.map(l => {
          const selected = l.id === line.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={selected}
              onClick={() => chooseLine(l.id)}
              className="press"
              style={{ minHeight: 48, padding: '0 3px', border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              <LinePill
                line={l}
                label={l.name.replace(/\s*\(.*\)/, '')}
                style={{
                  height: 30, padding: '0 12px',
                  ...(selected
                    ? { outline: '2px solid var(--text-primary)', outlineOffset: 2 }
                    : { background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 2px var(--line)' }),
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Where you are: honest words from the location engine */}
      {(ctx || onOpenCheckIn) && (
        <section
          aria-label="Your location"
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="type-headline" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{headline.headline}</div>
              <div className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                {ctx ? [contextLine?.name, ctx.direction, headline.meta].filter(Boolean).join(' · ') : 'Check in to see yourself on the route'}
              </div>
            </div>
            {onOpenCheckIn && (
              <Button type="button" variant="tonal" size="sm" onClick={onOpenCheckIn} style={{ flexShrink: 0 }}>
                {ctx ? 'Change' : 'Check in'}
              </Button>
            )}
          </div>
          {riders.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex' }}>
                {riders.slice(0, 4).map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onOpenProfile?.(u)}
                    aria-label={`View ${u.pseudonym}'s profile`}
                    style={{ width: 40, height: 48, marginLeft: i ? -6 : -4, padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Avatar name={u.pseudonym} seed={u.id} bg={u.avatarBg} size={32} style={{ boxShadow: '0 0 0 2px var(--bg-surface)' }} />
                  </button>
                ))}
              </div>
              <span className="type-label tnum" style={{ color: 'var(--text-primary)' }}>
                {riders.length} <span style={{ fontWeight: 480, color: 'var(--text-secondary)' }}>
                  {riders.length === 1 ? 'rider' : 'riders'} in your room
                </span>
              </span>
            </div>
          )}
        </section>
      )}

      {tab === 'map' && (
        <div
          id="journey-panel-map"
          role="tabpanel"
          aria-labelledby="journey-tab-map"
          style={{ height: 'calc(100dvh - var(--safe-top) - var(--nav-offset) - 380px)', minHeight: 320 }}
        >
          <FriendsMetroMap currentUser={currentUser} friends={[]} currentContext={ctx} focusLineId={line.id} />
        </div>
      )}

      {tab === 'route' && (
        <div id="journey-panel-route" role="tabpanel" aria-labelledby="journey-tab-route">
          {/* Direction: sticky under the header while the diagram scrolls */}
          <div
            style={{
              position: 'sticky', top: HEADER_H, zIndex: 5,
              margin: '0 calc(-1 * var(--gutter))', padding: '8px var(--gutter) 12px',
              background: 'var(--bg-base)',
            }}
          >
            <div role="radiogroup" aria-label={`${line.name} direction`} className="segmented">
              {(['b', 'a'] as const).map(d => {
                const selected = (d === 'a') === towardsA;
                const term = d === 'a' ? line.terminalA : line.terminalB;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Towards ${term}`}
                    onClick={() => chooseDirection(d)}
                    className={`segmented-option${selected ? ' selected' : ''}`}
                    style={{ flexDirection: 'column', gap: 0, minHeight: 52, whiteSpace: 'normal', lineHeight: '18px', textAlign: 'center' }}
                  >
                    <span className="type-meta" style={{ color: 'inherit', opacity: 0.72 }}>Towards</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{terminalLabel(term)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section aria-label={`${line.name} stations towards ${towardsA ? line.terminalA : line.terminalB}`} className="card" style={{ padding: '8px 16px' }}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((it, idx) => {
                const past = isPast(it, idx);
                if (it.kind === 'header') {
                  return (
                    <li key={it.key} style={{ display: 'flex', alignItems: 'stretch', gap: 12, minHeight: 40 }}>
                      <Track cells={it.cells} columns={layout.columns} past={past} />
                      <span className="type-label" style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontWeight: 600, padding: '12px 0 4px' }}>
                        {it.label}
                      </span>
                    </li>
                  );
                }
                if (it.kind === 'marker') {
                  return (
                    <li key={it.key} ref={youRef} aria-current="location" style={{ display: 'flex', alignItems: 'stretch', gap: 12, minHeight: 48 }}>
                      <Track cells={it.cells} columns={layout.columns} dimTop={dimPast} you={sure ? 'live' : 'unsure'} youCol={it.col} />
                      <span style={{ alignSelf: 'center', minWidth: 0, padding: '6px 0' }}>
                        <span className="type-label" style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 650 }}>You</span>
                        <span className="type-meta" style={{ display: 'block', color: 'var(--text-secondary)' }}>{it.label} · {headline.meta}</span>
                      </span>
                    </li>
                  );
                }
                const st = it.row.station;
                const isYou = it.key === youKey;
                const terminal = idx === 0 || idx === items.length - 1 || !it.row.cells[it.row.col].top || !it.row.cells[it.row.col].bottom;
                const others = (st.interchangeLines || [])
                  .map(id => getLineById(id))
                  .filter((l): l is MetroLine => !!l && l.id !== line.id);
                const forkNote = it.row.isFork ? (towardsA ? 'Branches join here' : 'Line splits here') : null;
                return (
                  <li
                    key={it.key}
                    ref={isYou ? youRef : undefined}
                    aria-current={isYou ? 'location' : undefined}
                    style={{ display: 'flex', alignItems: 'stretch', gap: 12, minHeight: 52 }}
                  >
                    <Track
                      cells={it.row.cells}
                      columns={layout.columns}
                      past={past}
                      dimTop={isYou && dimPast}
                      you={isYou ? (sure ? 'live' : 'unsure') : undefined}
                      youCol={it.row.col}
                      interchange={others.length > 0}
                      terminal={terminal}
                    />
                    <span style={{ flex: 1, minWidth: 0, alignSelf: 'center', padding: '7px 0' }}>
                      <span
                        className="type-body"
                        style={{
                          display: 'block', lineHeight: '20px',
                          color: past ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontWeight: isYou ? 650 : terminal ? 600 : 480,
                        }}
                      >
                        {st.name}
                      </span>
                      {st.hindiName && (
                        <span lang="hi" className="type-hi type-meta" style={{ display: 'block', color: 'var(--text-muted)' }}>{st.hindiName}</span>
                      )}
                      {isYou && (
                        <span className="type-meta" style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                          {sure ? 'You are here' : 'You might be here'} <span style={{ fontWeight: 480, color: 'var(--text-secondary)' }}>· {headline.meta}</span>
                        </span>
                      )}
                      {forkNote && (
                        <span className="type-meta" style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 2 }}>{forkNote}</span>
                      )}
                    </span>
                    {others.length > 0 && (
                      <span aria-label={`Change for ${others.map(o => o.name).join(', ')}`} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, alignSelf: 'center', maxWidth: 132, opacity: past ? 0.6 : 1 }}>
                        {others.map(o => <LinePill key={o.id} line={o} label={shortLineName(o)} size="sm" />)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="type-meta" style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', margin: '12px 4px 0' }}>
            <InfoIcon size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            Main stations and interchanges. CoRide has no live train times yet, so check DMRC for timetables.
          </p>
        </div>
      )}
    </div>
  );
};

const COL_W = 20;

/** The track column(s) of one diagram row: bars, the branch curve and the node. */
function Track({ cells, columns, past = false, dimTop = false, you, youCol = 0, interchange = false, terminal = false }: {
  cells: RailCell[];
  columns: number;
  past?: boolean;
  /** Dim the track above the node (the rider's own row while riding). */
  dimTop?: boolean;
  you?: 'live' | 'unsure';
  youCol?: number;
  interchange?: boolean;
  terminal?: boolean;
}) {
  const barOpacity = past ? 0.35 : 1;
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: COL_W * columns, flexShrink: 0, alignSelf: 'stretch' }}>
      {cells.map((c, col) => {
        const x = col * COL_W + COL_W / 2;
        const bar = (from: string, to: string, dim: boolean) => (
          <span style={{ position: 'absolute', left: x - 2, width: 4, top: from, bottom: to, background: 'var(--line)', opacity: dim ? 0.35 : 1 }} />
        );
        const isYou = !!you && col === youCol;
        return (
          <React.Fragment key={col}>
            {c.curve ? null : c.top && c.bottom && !c.node ? bar('0', '0', past) : (
              <>
                {c.top && bar('0', '50%', past || (dimTop && col === youCol))}
                {c.bottom && bar('50%', '0', past)}
              </>
            )}
            {c.curve && (
              <svg
                viewBox={`0 0 ${COL_W * 2} 100`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', left: 0, width: COL_W * 2, top: c.curve === 'fork' ? '50%' : 0, height: '50%', overflow: 'visible', opacity: barOpacity }}
              >
                <path
                  d={c.curve === 'fork'
                    ? `M${COL_W / 2} 0 C${COL_W / 2} 70, ${COL_W * 1.5} 30, ${COL_W * 1.5} 100`
                    : `M${COL_W * 1.5} 0 C${COL_W * 1.5} 70, ${COL_W / 2} 30, ${COL_W / 2} 100`}
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth={4}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {c.node && <Node x={x} you={isYou ? you : undefined} past={past} interchange={interchange} terminal={terminal} />}
          </React.Fragment>
        );
      })}
    </span>
  );
}

function Node({ x, you, past, interchange, terminal }: { x: number; you?: 'live' | 'unsure'; past: boolean; interchange: boolean; terminal: boolean }) {
  let size = 12;
  let style: React.CSSProperties = { background: 'var(--bg-surface)', border: '3px solid var(--line)' };
  if (you === 'live') {
    size = 20;
    style = { background: 'var(--line)', border: '3px solid var(--bg-surface)', boxShadow: '0 0 0 3px var(--signal), 0 0 0 4.5px var(--ink-fixed)' };
  } else if (you === 'unsure') {
    size = 18;
    style = { background: 'var(--line)', border: '3px solid var(--bg-surface)', boxShadow: '0 0 0 2px var(--text-muted)' };
  } else if (terminal) {
    size = 16;
    style = { background: 'var(--line)', border: `3px solid ${interchange ? 'var(--text-primary)' : 'var(--line)'}` };
  } else if (interchange) {
    size = 14;
    style = { background: 'var(--bg-surface)', border: '3px solid var(--text-primary)' };
  }
  if (past && !you) style = { ...style, borderColor: 'color-mix(in srgb, var(--line) 45%, var(--bg-surface))', background: 'var(--bg-surface)' };
  return (
    <span
      style={{
        position: 'absolute', zIndex: 1, left: x - size / 2, top: '50%', marginTop: -size / 2,
        width: size, height: size, borderRadius: '50%', ...style,
      }}
    />
  );
}
