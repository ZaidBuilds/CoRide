import type React from 'react';
import type { MetroLine } from '../types';
import { getLineById } from '../data/metroData';

/**
 * Line-colour helpers for the "app wears your line" idea (DESIGN.md §2).
 *
 *   <section style={lineStyle(line)}>…</section>       // line object, id or hex
 *   <span style={{ color: readableInk(hex) }}>…</span>
 *
 * Inside an element styled with lineStyle(), `var(--line)` is the line colour
 * and `var(--line-ink)` is the text colour that reads on it. Legacy aliases
 * (--accent, --accent-purple, --signal-500…) follow the line too.
 */

const INK = '#111418';
const WHITE = '#FFFFFF';

function toRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance of a hex colour (0 black … 1 white). */
export function luminance(hex: string): number {
  const rgb = toRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Text colour for a fill: white or #111418, whichever has more contrast.
 * Yellow, orange, green and (DMRC-ish) blue get dark ink; red, pink, violet,
 * magenta and grey get white. Non-hex input (e.g. a CSS var) returns ink.
 */
export function readableInk(hex: string): string {
  if (!toRgb(hex)) return INK;
  return contrast(hex, WHITE) >= contrast(hex, INK) ? WHITE : INK;
}

type LineInput = MetroLine | string | null | undefined;

/** Resolve a line object, a line id ('blue') or a raw hex to its colour. */
export function lineColor(line: LineInput): string | undefined {
  if (!line) return undefined;
  if (typeof line !== 'string') return line.color;
  if (line.startsWith('#')) return line;
  return getLineById(line)?.color;
}

/**
 * CSS custom properties that put an element in a line's context.
 * Returns {} when there is no line, so --line falls back to ink.
 */
export function lineStyle(line: LineInput): React.CSSProperties {
  const color = lineColor(line);
  if (!color) return {};
  return { '--line': color, '--line-ink': readableInk(color) } as React.CSSProperties;
}
