import React from 'react';

/**
 * Chip: pill-shaped tag or filter. Text is Label type; 36px visual, 48px hit area when tappable.
 *
 *   <Chip>Cricket</Chip>                                      static, outlined
 *   <Chip shared>Coding</Chip>                                an interest you share: Signal Lime fill
 *   <Chip selected onClick={toggle}>Music</Chip>              toggle filter (ink fill when on, aria-pressed)
 *   <Chip variant="quiet" icon={<ClockIcon size={16} />}>8:10 usual</Chip>
 *
 * Use `shared` sparingly: it's one of the few places lime is allowed.
 */
interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  shared?: boolean;
  variant?: 'outline' | 'quiet';
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const Chip: React.FC<ChipProps> = ({
  children, selected, shared, variant = 'outline', icon, onClick, disabled, className = '', style, ...aria
}) => {
  const cls = ['chip-btn', shared ? 'shared' : selected ? 'selected' : variant === 'quiet' ? 'quiet' : '', className]
    .filter(Boolean).join(' ');
  const inner = (
    <>
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={selected ?? undefined} disabled={disabled} onClick={onClick} style={style} {...aria}>
        {inner}
      </button>
    );
  }
  return <span className={cls} style={style} {...aria}>{inner}</span>;
};
