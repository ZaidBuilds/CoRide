/**
 * Theme control.
 *
 * The palette lives in index.css: dark on `:root`, light under
 * `:root[data-theme="light"]`. This module always writes the RESOLVED theme to
 * <html data-theme> (so "system" becomes "light" or "dark" by asking the OS)
 * and keeps the browser chrome + Android system bars in step with it.
 *
 * index.html runs the same resolution inline before first paint; keep the
 * storage key and colours below in sync with that script.
 */
import { syncSystemBars } from './nativeBridge';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'coride:theme';

/** Screen background per theme — must match --bg-base in index.css. */
export const THEME_BG = { light: '#F4F5F8', dark: '#0B0D12' } as const;

const listeners = new Set<(resolved: 'light' | 'dark') => void>();

function readStored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function getTheme(): Theme {
  const stored = readStored();
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** What the user actually sees right now, resolving 'system' against the OS. */
export function resolvedTheme(theme: Theme = getTheme()): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  const resolved = resolvedTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_BG[resolved]);
  void syncSystemBars(resolved);
  listeners.forEach(fn => fn(resolved));
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch { /* private mode — still apply for this session */ }
  applyTheme(theme);
}

/** Subscribe to resolved-theme changes (e.g. to re-tint a canvas). Returns an unsubscribe. */
export function onThemeChange(fn: (resolved: 'light' | 'dark') => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Call once before first render. */
export function initTheme() {
  applyTheme(getTheme());
  // Follow the OS live while the preference is 'system'.
  window
    .matchMedia?.('(prefers-color-scheme: light)')
    .addEventListener?.('change', () => {
      if (getTheme() === 'system') applyTheme('system');
    });
}
