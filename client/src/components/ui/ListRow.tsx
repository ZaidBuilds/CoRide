import React from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';

/**
 * ListRow + ListGroup: settings-style rows on one surface card, hairlines
 * between rows (never a border around each row). ≥ 56px tall.
 *
 *   <ListGroup>
 *     <ListRow leading={<BookmarkSimpleIcon size={22} />} title="Saved commutes" subtitle="2 routes" onClick={open} navigable />
 *     <ListRow leading={<Avatar name={f.name} seed={f.id} size={40} />} title={f.name} subtitle="Blue Line · 8:10" trailing={<Chip>Friend</Chip>} />
 *     <ListRow title="Delete account" danger onClick={confirm} />
 *   </ListGroup>
 *
 * With `onClick` the row is a <button>; otherwise a plain <div>.
 */
interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Show a caret (pushes to another screen). */
  navigable?: boolean;
  danger?: boolean;
  /** Let title/subtitle wrap instead of truncating. */
  wrap?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  title, subtitle, leading, trailing, onClick, navigable, danger, wrap, className = '', ...aria
}) => {
  const cls = ['list-row', danger ? 'danger' : '', onClick ? 'press-row' : '', className].filter(Boolean).join(' ');
  const ws = wrap ? { whiteSpace: 'normal' as const } : undefined;
  const body = (
    <>
      {leading && <span className="row-lead" aria-hidden="true">{leading}</span>}
      <span className="row-text">
        <span className="row-title" style={ws}>{title}</span>
        {subtitle && <span className="row-sub" style={ws}>{subtitle}</span>}
      </span>
      {(trailing || navigable) && (
        <span className="row-trail">
          {trailing}
          {navigable && <CaretRightIcon size={18} aria-hidden="true" />}
        </span>
      )}
    </>
  );
  return onClick
    ? <button type="button" className={cls} onClick={onClick} style={{ cursor: 'pointer' }} {...aria}>{body}</button>
    : <div className={cls} {...aria}>{body}</div>;
};

export const ListGroup: React.FC<{ children: React.ReactNode; label?: string; className?: string; style?: React.CSSProperties }> = ({ children, label, className = '', style }) => (
  <div className={`list-group ${className}`.trim()} role={label ? 'group' : undefined} aria-label={label} style={style}>
    {children}
  </div>
);
