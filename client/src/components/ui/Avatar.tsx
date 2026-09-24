import React from 'react';
import { readableInk } from '../../utils/lineStyle';
import { avatarColor, initials } from '../../utils/avatar';

/**
 * Avatar: squircle (34% radius), never a circle, never a purple gradient.
 * Colour: the user's own avatarBg when it's a solid, non-purple hex; otherwise
 * a deterministic pick from a muted neutral-tinted palette keyed on `seed`
 * (user id), so a rider keeps the same colour everywhere.
 *
 *   <Avatar name={u.pseudonym} seed={u.id} bg={u.avatarBg} size={48} />
 *   <Avatar name="Aarav" seed="u1" size={40} presence="active" />   // status dot
 *   <Avatar name="You" seed={me.id} size={32} you />                  // lime ring: "you"
 *
 * Sizes: 24 (inline), 32 (stack/chat), 40 (rows), 48 (cards), 64+ (profile).
 */
interface AvatarProps {
  name?: string;
  /** Stable id for the deterministic colour. Falls back to name. */
  seed?: string;
  /** The user's avatarBg (hex). Gradients and purples are ignored. */
  bg?: string | null;
  size?: number;
  /** Photo URL, if one ever exists. */
  src?: string;
  presence?: 'active' | 'nearby' | 'other' | 'sameTrain';
  /** Lime ring marking the current user. */
  you?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Decorative when the name is printed next to it (default true). */
  decorative?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name, seed, bg, size = 40, src, presence, you = false, className = '', style, decorative = true,
}) => {
  const color = avatarColor(seed ?? name ?? '', bg);
  const face = (
    <span
      className={`avatar ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : name}
      style={{
        width: size, height: size,
        fontSize: Math.round(size * 0.4), lineHeight: 1,
        background: color, color: readableInk(color),
        boxShadow: you ? '0 0 0 2px var(--bg-surface), 0 0 0 4px var(--signal)' : undefined,
        ...style,
      }}
    >
      {src ? <img src={src} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name, size < 36 ? 1 : 2)}
    </span>
  );
  if (!presence) return face;
  return (
    <span className="avatar-wrap" style={{ display: 'inline-flex' }}>
      {face}
      <span className={`avatar-dot ${presence}`} aria-hidden="true" />
    </span>
  );
};
