import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon, CircleHalfIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { getTheme, setTheme, onThemeChange, type Theme } from '../utils/theme';
import { triggerHaptic } from '../utils/nativeBridge';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const META: Record<Theme, { icon: Icon; label: string; next: string }> = {
  system: { icon: CircleHalfIcon, label: 'Theme: match device', next: 'light' },
  light: { icon: SunIcon, label: 'Theme: light', next: 'dark' },
  dark: { icon: MoonIcon, label: 'Theme: dark', next: 'match device' },
};

/**
 * 48px icon button that cycles system → light → dark. The accessible name
 * states the current value and what a tap does. Stays in sync if the theme
 * changes elsewhere. variant="plain" for use in a header.
 */
export const ThemeToggle: React.FC<{ variant?: 'surface' | 'plain' | 'tonal' }> = ({ variant = 'surface' }) => {
  const [theme, setLocal] = useState<Theme>(getTheme);
  useEffect(() => onThemeChange(() => setLocal(getTheme())), []);
  const { icon: Icon, label, next } = META[theme];

  const cycle = () => {
    void triggerHaptic('light');
    const value = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(value);
    setLocal(value);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label}. Switch to ${next}`}
      title={label}
      className={`icon-btn ${variant === 'surface' ? '' : variant}`.trim()}
    >
      <Icon size={22} aria-hidden="true" />
    </button>
  );
};
