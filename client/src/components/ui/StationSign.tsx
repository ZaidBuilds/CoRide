import React from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { LinePill } from './LinePill';
import type { MetroLine, MetroStation } from '../../types';

/**
 * StationSign: the hero of Home and Room, modelled on DMRC platform signs.
 * English name in condensed Display, Hindi beneath in Meta/muted, then line
 * pill(s) and "→ Towards X".
 *
 *   <StationSign station={station} lines={[station.lineId, ...(station.interchangeLines ?? [])]} towards="Vaishali" />
 *   <StationSign name="Rajiv Chowk" hindiName="राजीव चौक" lines={['blue', 'yellow']} size="compact" />
 *
 * Names always come from metroData. Put the sign inside lineStyle(line) so
 * anything else on the screen shares the line colour.
 */
interface StationSignProps {
  station?: Pick<MetroStation, 'name' | 'hindiName'> | null;
  name?: string;
  hindiName?: string;
  /** Line(s) serving the station: MetroLine, id or hex. Interchange = several. */
  lines?: (MetroLine | string)[];
  /** Terminal name for "Towards X". Omit when direction is unknown. */
  towards?: string;
  size?: 'default' | 'compact';
  /** Heading level for the station name. Default h1. */
  as?: 'h1' | 'h2' | 'h3' | 'p';
  /** Optional Meta line under the sign, e.g. the signal used ("From GPS"). */
  meta?: React.ReactNode;
  className?: string;
}

export const StationSign: React.FC<StationSignProps> = ({
  station, name, hindiName, lines = [], towards, size = 'default', as: Tag = 'h1', meta, className = '',
}) => {
  const en = name ?? station?.name ?? '';
  const hi = hindiName ?? station?.hindiName;
  return (
    <div className={`station-sign ${size === 'compact' ? 'compact' : ''} ${className}`.replace(/\s+/g, ' ').trim()}>
      <Tag className="sign-name">{en}</Tag>
      {hi && <span className="sign-hi" lang="hi">{hi}</span>}
      {(lines.length > 0 || towards) && (
        <div className="sign-meta">
          {lines.map((l, i) => <LinePill key={typeof l === 'string' ? l : l.id ?? i} line={l} />)}
          {towards && (
            <span className="sign-towards">
              <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
              Towards {towards}
            </span>
          )}
        </div>
      )}
      {meta && <div className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{meta}</div>}
    </div>
  );
};
