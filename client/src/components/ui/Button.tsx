import React from 'react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * Button — the app's standard action button (pill shape, ≥ 48px tall).
 *
 *   <Button onClick={save}>Save</Button>                      primary (brand fill)
 *   <Button variant="secondary" icon={<X size={16}/>}>Cancel</Button>
 *   <Button variant="tonal">…</Button>                          brand-tinted, lower emphasis
 *   <Button variant="ghost" size="sm">Skip</Button>             text-only
 *   <Button variant="danger">Block</Button>                     destructive only (Report/Block/Delete)
 *   <Button isLoading>Saving…</Button>                           spinner + aria-busy, click ignored
 *
 * Use ONE primary per screen. Like a native <button>, the default `type` is
 * "submit" — pass type="button" when it sits inside a <form> but must not submit.
 * Fires a light haptic on press.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  /** Leading icon (≈16–18px lucide icon). */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. an arrow on a "Continue" button. */
  iconEnd?: React.ReactNode;
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: { background: 'var(--accent)', color: 'var(--text-on-accent)', border: '1px solid transparent' },
  secondary: { background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
  tonal: { background: 'var(--accent-container)', color: 'var(--accent-text)', border: '1px solid transparent' },
  ghost: { background: 'transparent', color: 'var(--accent-text)', border: '1px solid transparent' },
  danger: { background: 'var(--danger-fill)', color: '#FFFFFF', border: '1px solid transparent' },
};

// sm is 40px visually (M3 standard); .touch-expand grows its hit area to 48px.
const SIZE: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { minHeight: 40, padding: '8px 16px', fontSize: 13, lineHeight: '20px' },
  md: { minHeight: 48, padding: '12px 20px', fontSize: 14, lineHeight: '20px' },
  lg: { minHeight: 56, padding: '16px 24px', fontSize: 16, lineHeight: '24px' },
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  iconEnd,
  className = '',
  disabled,
  onClick,
  style,
  ...props
}) => {
  const inert = disabled || isLoading;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (inert) return;
    void triggerHaptic('light');
    onClick?.(e);
  };

  return (
    <button
      {...props}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={isLoading || undefined}
      onClick={handleClick}
      className={`press ${size === 'sm' ? 'touch-expand ' : ''}${className}`.trim()}
      style={{
        ...VARIANT[variant],
        ...SIZE[size],
        width: fullWidth ? '100%' : undefined,
        borderRadius: 'var(--radius-pill)',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: inert ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}
          />
          <span className="sr-only">Loading</span>
        </>
      ) : (
        <>
          {icon}
          {children}
          {iconEnd}
        </>
      )}
    </button>
  );
};
