import React from 'react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * IconButton: a 48×48 pill for header actions (back, close, more).
 * `label` is REQUIRED; it is the accessible name (TalkBack reads nothing otherwise).
 *
 *   <IconButton label="Back" variant="plain" onClick={onBack}><ArrowLeftIcon size={24} /></IconButton>
 *   <IconButton label="More options"><DotsThreeVerticalIcon size={22} /></IconButton>
 *   <IconButton label="Notifications" badge><BellIcon size={22} /></IconButton>  // lime unread pip
 *
 * variant: 'surface' (default, card-coloured disc) · 'plain' (transparent, for
 * headers) · 'tonal' (grey disc, for use on top of a surface card).
 * Icons: Phosphor regular, 22–24px.
 */
interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  variant?: 'surface' | 'plain' | 'tonal';
  badge?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = 'surface',
  badge = false,
  className = '',
  type = 'button',
  onClick,
  children,
  ...props
}) => (
  <button
    {...props}
    type={type}
    aria-label={label}
    title={props.title ?? label}
    className={`icon-btn ${variant === 'surface' ? '' : variant} ${className}`.replace(/\s+/g, ' ').trim()}
    onClick={e => { void triggerHaptic('light'); onClick?.(e); }}
  >
    {children}
    {badge && <span className="pip" aria-hidden="true" />}
  </button>
);
