import { useEffect, useState } from 'react';
import { Sun, Moon, SunMoon } from 'lucide-react';
import { getTheme, setTheme, onThemeChange, type Theme } from '../utils/theme';
import { triggerHaptic } from '../utils/nativeBridge';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const META: Record<Theme, { icon: typeof Sun; label: string; next: string }> = {
  system: { icon: SunMoon, label: 'Theme: match device', next: 'light' },
  light: { icon: Sun, label: 'Theme: light', next: 'dark' },
  dark: { icon: Moon, label: 'Theme: dark', next: 'match device' },
};

/**
 * 48px icon button that cycles system → light → dark. The accessible name
 * states the current value and what a tap does, not just "toggle". Stays in
 * sync if the theme is changed elsewhere (another ThemeToggle, settings).
 */
export const ThemeToggle: React.FC = () => {
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
    <button type="button" onClick={cycle} aria-label={`${label}. Switch to ${next}`} title={label} className="icon-btn">
      <Icon size={20} aria-hidden="true" />
    </button>
  );
};
