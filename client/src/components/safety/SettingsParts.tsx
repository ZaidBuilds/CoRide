import type { ReactNode } from 'react';

/* Shared settings-list pieces for Profile, Safety Centre and Friends. */

/** 40px tonal squircle holding a settings icon. */
export function IconTile({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-squircle)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: danger ? 'var(--danger-container)' : 'var(--bg-tonal)',
        color: danger ? 'var(--danger-text)' : 'var(--text-primary)',
      }}
    >
      {children}
    </span>
  );
}

/** Section label above a ListGroup. */
export function GroupLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="type-label" style={{ color: 'var(--text-secondary)', margin: '0 4px 8px' }}>
      {children}
    </h2>
  );
}

