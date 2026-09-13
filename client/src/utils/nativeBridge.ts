import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const isNativeAndroid = Capacitor.getPlatform() === 'android';
export const isNative = Capacitor.isNativePlatform();

/**
 * Physical tactile haptics for mobile actions (button presses, game answers, friend waves).
 * Gracefully degrades to web vibration API or no-op on desktop browsers.
 */
export async function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
  if (!isNative) {
    // Web Vibration fallback if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(30);
      else if (type === 'heavy') navigator.vibrate(50);
      else if (type === 'success') navigator.vibrate([20, 50, 20]);
    }
    return;
  }

  try {
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (type === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (type === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
    }
  } catch (err) {
    // Silent catch on unsupported hardware
  }
}

/**
 * Configure OLED black native status bar matching the dark transit theme.
 */
export async function initializeNativeApp(): Promise<void> {
  if (!isNative) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#070a12' });
  } catch (err) {
    console.warn('Status bar configuration error', err);
  }
}
