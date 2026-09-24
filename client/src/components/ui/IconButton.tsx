import React from 'react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * IconButton — a 48×48 circular button for header actions (back, close, more).
 * `label` is REQUIRED: it becomes the accessible name (icon-only buttons are
 * otherwise silent to TalkBack).
 *
 *   <IconButton label="Back" onClick={onBack}><ArrowLeft size={20} /></IconButton>
 *   <IconButton label="More options" variant="plain"><MoreVertical size={20} /></IconButton>
 *   <IconButton label="Notifications" badge>…</IconButton>   // small unread pip
 */
interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  /** 'surface' (default) has a filled circle; 'plain' is transparent until pressed. */
  variant?: 'surface' | 'plain';
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
    className={`icon-btn ${variant === 'plain' ? 'plain' : ''} ${className}`.trim()}
    onClick={e => { void triggerHaptic('light'); onClick?.(e); }}
  >
    {children}
    {badge && <span className="pip" aria-hidden="true" />}
  </button>
);
