import React from 'react';
import { Avatar } from './Avatar';

/**
 * PresenceStack: overlapping squircle avatars (max 4) and a tabular count.
 * The lime live dot pulses ONLY when `live` is true and count > 0: never
 * animate presence you don't actually have.
 *
 *   <PresenceStack people={riders} count={riders.length} label="riding now" live />
 *   <PresenceStack people={[]} count={0} label="here" />        → "0 here", no dot
 *
 * `count` is the real total (may exceed people.length). Set --stack-ring on a
 * parent if the stack sits on something other than --bg-surface.
 */
export interface PresencePerson { id: string; name?: string; avatarBg?: string | null }

interface PresenceStackProps {
  people: PresencePerson[];
  count: number;
  /** Text after the number, e.g. "riding now", "at this station". */
  label?: string;
  live?: boolean;
  size?: number;
  max?: number;
  className?: string;
}

export const PresenceStack: React.FC<PresenceStackProps> = ({
  people, count, label, live = false, size = 28, max = 4, className = '',
}) => {
  const shown = people.slice(0, Math.min(max, 4));
  const isLive = live && count > 0;
  return (
    <span className={`presence-stack ${className}`.trim()}>
      {shown.length > 0 && (
        <span className="stack" aria-hidden="true">
          {shown.map(p => <Avatar key={p.id} name={p.name} seed={p.id} bg={p.avatarBg} size={size} />)}
        </span>
      )}
      <span className="count">
        {isLive && <span className="live-dot pulse" aria-hidden="true" />}
        <span>{count}{label ? <span style={{ fontWeight: 480, color: 'var(--text-secondary)' }}> {label}</span> : null}</span>
      </span>
    </span>
  );
};
