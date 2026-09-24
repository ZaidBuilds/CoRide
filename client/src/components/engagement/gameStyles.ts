import type { CSSProperties } from 'react';

/** Shared look for the game panels: tokens only, so both themes work. */

export const panelTitle: CSSProperties = {
  fontSize: 'var(--fs-headline)',
  lineHeight: 'var(--lh-headline)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

/** Timer / round counter: a tonal pill with tabular numbers. */
export const timerChip: CSSProperties = {
  fontSize: 'var(--fs-meta)',
  lineHeight: 'var(--lh-meta)',
  fontWeight: 560,
  fontVariantNumeric: 'tabular-nums',
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--bg-tonal)',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  whiteSpace: 'nowrap'
};

export const gameInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 48,
  padding: '0 16px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--bg-sunken)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-primary)',
  fontSize: 16
};

/** Submit next to a game input. Pair with className "btn-secondary press". */
export const gameSubmit: CSSProperties = {
  minHeight: 48,
  minWidth: 48,
  padding: '0 16px',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  fontSize: 14,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  flexShrink: 0,
  cursor: 'pointer'
};

export const errorLine: CSSProperties = {
  fontSize: 'var(--fs-meta)',
  lineHeight: 'var(--lh-meta)',
  color: 'var(--text-primary)',
  background: 'var(--bg-sunken)',
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'inset 4px 0 0 var(--status-danger)'
};

/** A block of game content (prompt, hint, current letter) inside the game card. */
export const gameWell: CSSProperties = {
  padding: 16,
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-sunken)'
};

/** A player pill: avatar + name + score. */
export const playerPill = (highlight: boolean): CSSProperties => ({
  padding: '4px 12px 4px 4px',
  borderRadius: 'var(--radius-pill)',
  background: highlight ? 'var(--ink)' : 'var(--bg-tonal)',
  color: highlight ? 'var(--ink-inverse)' : 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 'var(--fs-meta)',
  fontWeight: 560,
  whiteSpace: 'nowrap'
});

/** Submit button look: ink (secondary) when it can send, a flat tonal pill when it can't. */
export const submitStyle = (enabled: boolean, iconOnly = false): CSSProperties => ({
  ...gameSubmit,
  ...(iconOnly ? { width: 48, padding: 0 } : {}),
  background: enabled ? 'var(--ink)' : 'var(--bg-tonal)',
  color: enabled ? 'var(--ink-inverse)' : 'var(--text-muted)',
  cursor: enabled ? 'pointer' : 'default'
});
