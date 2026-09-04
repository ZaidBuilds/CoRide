import { useState } from 'react';
import { Sun, Moon, SunMoon } from 'lucide-react';
import { getTheme, setTheme, type Theme } from '../utils/theme';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const META: Record<Theme, { icon: typeof Sun; label: string }> = {
  system: { icon: SunMoon, label: 'Theme: match device' },
  light: { icon: Sun, label: 'Theme: light' },
  dark: { icon: Moon, label: 'Theme: dark' },
};

/** Cycles system → light → dark. Announces the new value, not just "toggle". */
export const ThemeToggle: React.FC = () => {
  const [theme, setLocal] = useState<Theme>(getTheme);
  const { icon: Icon, label } = META[theme];

  const next = () => {
    const value = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(value);
    setLocal(value);
  };

  return (
    <button onClick={next} aria-label={label} title={label} className="icon-btn">
      <Icon size={18} />
    </button>
  );
};
