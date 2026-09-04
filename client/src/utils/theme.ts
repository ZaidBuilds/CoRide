/**
 * Theme control. The palette itself lives in index.css via light-dark(), so all
 * this has to do is set `color-scheme` — which is what `data-theme` on <html>
 * switches. No palette is duplicated in JS.
 */

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'coride:theme';

/** Background the browser chrome (status bar, address bar) should match. */
const THEME_COLOR = { light: '#F2F2F7', dark: '#08080F' } as const;

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** What the user actually sees right now, resolving 'system' against the OS. */
export function resolvedTheme(theme: Theme = getTheme()): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolvedTheme(theme)]);
}

export function setTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/** Call once before first paint so the app never flashes the wrong palette. */
export function initTheme() {
  applyTheme(getTheme());
  // Keep the chrome colour correct if the OS flips while we're on 'system'.
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system');
    });
}
