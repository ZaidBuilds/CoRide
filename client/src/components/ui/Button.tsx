import React from 'react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * Button: every action button in the app. Always a pill, always ≥ 48px to touch.
 *
 *   <Button onClick={join}>Join room</Button>                  primary: Signal Lime fill, ink text. ONE per screen.
 *   <Button variant="secondary">Change station</Button>        ink fill (inverts in dark). Strong but not the hero.
 *   <Button variant="tonal" icon={<BellIcon />}>Notify me</Button>  quiet grey fill. Most in-card actions.
 *   <Button variant="ghost">Skip for now</Button>              text only, for escape hatches.
 *   <Button variant="danger">Block</Button>                    Report / Block / Delete only.
 *   <Button isLoading>Saving</Button>                          spinner + aria-busy, clicks ignored.
 *
 * Icons: Phosphor at 20px (regular weight); `icon` leads, `iconEnd` trails.
 * Default `type` is "submit" like a native button; pass type="button" in forms.
 * size: sm (40px visual, 48px hit area) · md (48px) · lg (56px, onboarding/footer CTAs).
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  /** Leading icon (Phosphor, ~20px). */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. an arrow on "Continue". */
  iconEnd?: React.ReactNode;
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: { background: 'var(--signal)', color: 'var(--ink-fixed)' },
  secondary: { background: 'var(--ink)', color: 'var(--ink-inverse)' },
  tonal: { background: 'var(--bg-tonal)', color: 'var(--text-primary)' },
  ghost: { background: 'transparent', color: 'var(--text-primary)' },
  danger: { background: 'var(--danger-fill)', color: '#FFFFFF' },
};

const SIZE: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { minHeight: 40, padding: '8px 16px', fontSize: 14, lineHeight: '18px', gap: 6 },
  md: { minHeight: 48, padding: '12px 22px', fontSize: 15, lineHeight: '20px', gap: 8 },
  lg: { minHeight: 56, padding: '16px 26px', fontSize: 17, lineHeight: '22px', gap: 10 },
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
      className={`press ${size === 'sm' ? 'touch-expand ' : ''}${variant === 'ghost' ? 'btn-ghost-underline ' : ''}${className}`.trim()}
      style={{
        ...VARIANT[variant],
        // Disabled: a flat grey pill (a dimmed lime reads as a muddy olive).
        ...(disabled && variant !== 'ghost' ? { background: 'var(--bg-tonal)', color: 'var(--text-muted)' } : {}),
        ...SIZE[size],
        border: 'none',
        width: fullWidth ? '100%' : undefined,
        borderRadius: 'var(--radius-pill)',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: inert ? 'default' : 'pointer',
        opacity: disabled && variant === 'ghost' ? 0.5 : 1,
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
          {icon && <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
          {children}
          {iconEnd && <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>{iconEnd}</span>}
        </>
      )}
    </button>
  );
};
