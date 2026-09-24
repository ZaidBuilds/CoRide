import React from 'react';
import { getLineById } from '../../data/metroData';
import { lineStyle, lineColor } from '../../utils/lineStyle';
import type { MetroLine } from '../../types';

/**
 * LinePill: a line's name on its own colour, in Micro type, like DMRC signage.
 * Colour and name come from metroData; text colour is picked for contrast.
 *
 *   <LinePill line="blue" />                    → BLUE LINE
 *   <LinePill line={line} label="Blue" size="sm" />
 *   {station.interchangeLines?.map(id => <LinePill key={id} line={id} />)}   // interchange = several pills
 *
 * With no resolvable line it renders on --line (i.e. the surrounding context).
 */
interface LinePillProps {
  /** MetroLine, line id ('blue') or hex colour. */
  line?: MetroLine | string | null;
  /** Override the text. Defaults to the line's name ("Blue Line"). */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

function lineName(line: LinePillProps['line']): string | undefined {
  if (!line) return undefined;
  if (typeof line !== 'string') return line.name;
  if (line.startsWith('#')) return undefined;
  return getLineById(line)?.name;
}

export const LinePill: React.FC<LinePillProps> = ({ line, label, size = 'md', className = '', style }) => {
  const text = label ?? lineName(line) ?? 'Metro';
  return (
    <span
      className={`line-pill ${size === 'sm' ? 'sm' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={{ ...(lineColor(line) ? lineStyle(line) : {}), ...style }}
    >
      {text}
    </span>
  );
};
