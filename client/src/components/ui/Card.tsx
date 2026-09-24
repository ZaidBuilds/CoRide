import React from 'react';
import { lineStyle } from '../../utils/lineStyle';
import type { MetroLine } from '../../types';

/**
 * Card: the default content container. Surface colour on concrete, 16px
 * radius, 16px padding, no border, no shadow (flat elevation).
 *
 *   <Card>…</Card>
 *   <Card line={room.lineId}>…</Card>             4px line-colour stub on the left (rider/room cards)
 *   <Card stub>…</Card>                            stub in the inherited --line
 *   <Card onClick={open} aria-label="Open room">…</Card>   pressable (scale .97), rendered as a button
 *
 * Don't nest cards, and don't put a hairline around a card AND its rows.
 */
interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Line for the stub (MetroLine, id or hex). Implies `stub`. */
  line?: MetroLine | string | null;
  stub?: boolean;
  onClick?: () => void;
  padding?: number | string;
  as?: 'div' | 'section' | 'article' | 'li';
}

export const Card: React.FC<CardProps> = ({
  line, stub, onClick, padding, as: Tag = 'div', className = '', style, children, ...rest
}) => {
  const hasStub = stub || !!line;
  const cls = ['card', hasStub ? 'has-stub' : '', onClick ? 'pressable' : '', className].filter(Boolean).join(' ');
  const st: React.CSSProperties = {
    ...(line ? lineStyle(line) : {}),
    ...(padding != null ? { padding, ...(hasStub ? { paddingLeft: `calc(${typeof padding === 'number' ? `${padding}px` : padding} + 4px)` } : {}) } : {}),
    ...style,
  };
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', color: 'inherit', font: 'inherit', ...st }}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
  return <Tag className={cls} style={st} {...rest}>{children}</Tag>;
};
