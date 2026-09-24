import React from 'react';
import { lineStyle } from '../../utils/lineStyle';
import type { MetroLine } from '../../types';

/**
 * LineRail: a real route diagram. 4px bar in --line, hollow nodes for stops,
 * a filled node for "you", and a Signal Lime ring when that position is live.
 * Only ever draw real route data (metroData order), never decoration.
 *
 *   <LineRail stations={line.stations} currentIndex={i} line={line} live />             vertical journey
 *   <LineRail orientation="horizontal" compact stations={next5} currentIndex={0} />     room header strip
 *   <LineRail stations={slice} currentIndex={2} window={2} />                             i-2 … i+2 only
 *
 * Stops before `currentIndex` are dimmed (travelled). Pass currentIndex={-1}
 * when the rider's position is unknown: every node stays hollow.
 * Compact: tighter rows (vertical) or no labels except current + ends (horizontal).
 */
export interface RailStop { id?: string; name: string }

interface LineRailProps {
  stations: RailStop[];
  currentIndex?: number;
  /** MetroLine, id or hex. Omit to inherit --line from the parent. */
  line?: MetroLine | string | null;
  orientation?: 'vertical' | 'horizontal';
  compact?: boolean;
  /** Current position is confirmed live (adds the lime ring). */
  live?: boolean;
  /** Show only this many stops either side of currentIndex (plus the ends). */
  window?: number;
  /** Dim stops already passed. Default true. */
  dimPast?: boolean;
  /** Extra text after a stop's name, e.g. "2 riders". */
  annotate?: (stop: RailStop, index: number) => React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

export const LineRail: React.FC<LineRailProps> = ({
  stations, currentIndex = -1, line, orientation = 'vertical', compact = false, live = false,
  window: win, dimPast = true, annotate, ariaLabel = 'Route', className = '',
}) => {
  const last = stations.length - 1;
  let indices = stations.map((_, i) => i);
  if (win != null && currentIndex >= 0) {
    const lo = Math.max(0, currentIndex - win), hi = Math.min(last, currentIndex + win);
    indices = indices.filter(i => i >= lo && i <= hi);
  }
  const vertical = orientation === 'vertical';

  return (
    <ol
      aria-label={ariaLabel}
      className={`line-rail ${vertical ? 'v' : 'h'} ${compact ? 'compact' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={line ? lineStyle(line) : undefined}
    >
      {indices.map(i => {
        const s = stations[i];
        const isCurrent = i === currentIndex;
        const isTerminal = i === 0 || i === last;
        const cls = [
          'rail-stop',
          dimPast && currentIndex >= 0 && i < currentIndex ? 'past' : '',
          isCurrent ? (live ? 'current' : 'you') : '',
          isTerminal ? 'terminal' : '',
        ].filter(Boolean).join(' ');
        // Compact horizontal: label the current stop, plus an end only when it's far enough not to collide.
        const showLabel = !compact || vertical || isCurrent || (isTerminal && (currentIndex < 0 || Math.abs(i - currentIndex) >= 3));
        const note = annotate?.(s, i);
        return (
          <li key={s.id ?? `${s.name}-${i}`} className={cls} aria-current={isCurrent ? 'location' : undefined}>
            <span className="rail-track" aria-hidden="true"><span className="rail-node" /></span>
            {showLabel ? (
              <span className="rail-label">
                {s.name}
                {note && <span className="type-meta" style={{ color: 'var(--text-muted)', marginLeft: 8, fontWeight: 480 }}>{note}</span>}
              </span>
            ) : (
              <span className="sr-only">{s.name}</span>
            )}
            {isCurrent && <span className="sr-only">{live ? ', you are here now' : ', you'}</span>}
          </li>
        );
      })}
    </ol>
  );
};
