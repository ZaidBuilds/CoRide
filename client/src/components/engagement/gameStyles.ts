import type { CSSProperties } from 'react';

/** Shared look for the game panels — tokens only, so both themes work. */

export const panelTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--text-primary)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6
};

export const timerChip: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  whiteSpace: 'nowrap'
};

export const gameInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontSize: 16
};

export const gameSubmit: CSSProperties = {
  minHeight: 48,
  minWidth: 48,
  padding: '0 14px',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flexShrink: 0
};

export const errorLine: CSSProperties = {
  fontSize: 13,
  color: 'var(--status-danger)',
  background: 'var(--bg-surface)',
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--status-danger)'
};
