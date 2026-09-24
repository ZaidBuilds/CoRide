/**
 * Thin wrappers over Capacitor native APIs. Every function is safe to call on
 * the web (it degrades to a web API or a no-op) and never throws.
 *
 *   triggerHaptic(type)       tactile feedback
 *   syncSystemBars(theme)     status/navigation bar icon colour + background
 *   pushBackHandler(fn)       Android hardware/gesture back — LIFO stack
 *   minimizeApp()             send the app to background (back at root)
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Proxy to the native `App` plugin WITHOUT the @capacitor/app npm package.
 * registerPlugin() only creates a bridge proxy; if the native side isn't
 * installed every call rejects ("not implemented") and we fall back to the
 * default Android behaviour (back = close the activity). Once the owner adds
 * @capacitor/app (`npm i @capacitor/app && npx cap sync android`), hardware
 * back is routed through dispatchBack() with no code changes here.
 */
interface NativeAppPlugin {
  addListener(event: 'backButton', cb: (e: { canGoBack: boolean }) => void): Promise<PluginListenerHandle>;
  minimizeApp(): Promise<void>;
  getInfo(): Promise<{ version: string; build: string }>;
}
const CapApp = registerPlugin<NativeAppPlugin>('App');

export const isNativeAndroid = Capacitor.getPlatform() === 'android';
export const isNative = Capacitor.isNativePlatform();

/** Respect the OS "reduce motion"/haptics preference proxy on the web. */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export async function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
  if (!isNative) {
    if (prefersReducedMotion()) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(20);
        else if (type === 'heavy') navigator.vibrate(35);
        else if (type === 'success') navigator.vibrate([15, 40, 15]);
        else if (type === 'warning' || type === 'error') navigator.vibrate([30, 40, 30]);
      }
    } catch { /* vibrate can throw before a user gesture */ }
    return;
  }

  try {
    if (type === 'light') await Haptics.impact({ style: ImpactStyle.Light });
    else if (type === 'medium') await Haptics.impact({ style: ImpactStyle.Medium });
    else if (type === 'heavy') await Haptics.impact({ style: ImpactStyle.Heavy });
    else if (type === 'success') await Haptics.notification({ type: NotificationType.Success });
    else if (type === 'warning') await Haptics.notification({ type: NotificationType.Warning });
    else if (type === 'error') await Haptics.notification({ type: NotificationType.Error });
  } catch { /* unsupported hardware */ }
}

/** Colours must match --bg-base in index.css. */
const BAR_BG = { light: '#ECEEEA', dark: '#0C0E11' } as const;

/**
 * Match the Android status + navigation bars to the in-app theme.
 * - SystemBars (Capacitor 8 core) sets icon contrast; the app draws
 *   edge-to-edge and pads content with --safe-* insets.
 * - StatusBar.setBackgroundColor only has an effect on pre-edge-to-edge
 *   Android (< 15); elsewhere it is a harmless no-op.
 */
export async function syncSystemBars(theme: 'light' | 'dark'): Promise<void> {
  if (!isNative) return;
  try {
    // "Dark" style = light icons, for a dark background.
    await SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  } catch { /* older native shell */ }
  if (isNativeAndroid) {
    try { await StatusBar.setBackgroundColor({ color: BAR_BG[theme] }); } catch { /* edge-to-edge: ignored */ }
  }
}

/** Kept for callers from before theme-aware bars; theme.ts now drives this. */
export async function initializeNativeApp(): Promise<void> {
  /* no-op: initTheme() → applyTheme() → syncSystemBars() */
}

// ─── Back navigation ─────────────────────────────────────────────────────────
// A LIFO stack of handlers. The top handler runs first; return true if you
// consumed the back press, false to let the next one try. After the stack,
// App.tsx's root handler runs (close App overlays → previous screen → Home
// tab); if nothing handles it the app minimises. On the web the same chain is
// driven by the browser back button (popstate) from App.tsx.
//
// Use it from any overlay/sheet/sub-screen:
//   useEffect(() => pushBackHandler(() => { onClose(); return true; }), [onClose]);
type BackHandler = () => boolean;
const backStack: BackHandler[] = [];

export function pushBackHandler(fn: BackHandler): () => void {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
}

let rootBackHandler: BackHandler | null = null;
/** App.tsx's fallback, run after every pushed handler declined. */
export function setRootBackHandler(fn: BackHandler | null): void {
  rootBackHandler = fn;
}

/** Run the stack top-down, then the root. Returns true if something handled the press. */
export function dispatchBack(): boolean {
  for (let i = backStack.length - 1; i >= 0; i--) {
    try {
      if (backStack[i]()) return true;
    } catch { /* a broken handler must not trap the user */ }
  }
  try {
    return rootBackHandler ? rootBackHandler() : false;
  } catch {
    return false;
  }
}

export async function minimizeApp(): Promise<void> {
  if (!isNativeAndroid) return;
  try { await CapApp.minimizeApp(); } catch { /* ignore */ }
}

/** "1.2.0 (7)" on native when the App plugin is present, else null. */
export async function getAppVersion(): Promise<string | null> {
  if (!isNative) return null;
  try {
    const info = await CapApp.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return null;
  }
}

let nativeBackInstalled = false;
/**
 * Route the Android hardware/gesture back button through dispatchBack().
 * Unhandled at the root → minimise (Android convention; exiting would drop
 * the live socket and room presence). Call once at startup.
 */
export function installNativeBackButton(): void {
  if (!isNativeAndroid || nativeBackInstalled) return;
  nativeBackInstalled = true;
  CapApp.addListener('backButton', () => {
    if (!dispatchBack()) void minimizeApp();
  }).catch(() => { nativeBackInstalled = false; });
}
