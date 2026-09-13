import React from 'react';
import { triggerHaptic } from '../../utils/nativeBridge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  onClick,
  style,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    triggerHaptic('light');
    onClick?.(e);
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, var(--signal-500), var(--signal-600))',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: 'var(--shadow-sm)'
        };
      case 'secondary':
        return {
          background: 'var(--bg-surface-raised)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)'
        };
      case 'danger':
        return {
          background: 'var(--status-danger)',
          color: '#FFFFFF',
          border: 'none',
          boxShadow: 'var(--shadow-sm)'
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: 'none'
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { minHeight: 40, minWidth: 48, padding: '8px 16px', fontSize: 13, lineHeight: '20px' };
      case 'lg':
        return { minHeight: 56, padding: '16px 28px', fontSize: 16, lineHeight: '24px' };
      case 'md':
      default:
        return { minHeight: 48, padding: '12px 20px', fontSize: 14, lineHeight: '20px' }; // 48dp standard touch target
    }
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      onClick={handleClick}
      className={`press ${className}`}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all var(--dur-micro) var(--ease-enter)',
        ...style
      }}
    >
      {isLoading ? (
        <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};
