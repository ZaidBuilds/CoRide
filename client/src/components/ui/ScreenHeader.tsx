import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from './IconButton';

/**
 * ScreenHeader — sticky top app bar for a screen inside the app shell.
 * Spans edge-to-edge under the status bar (uses the .app-header class, which
 * cancels the shell padding and adds the safe-area inset).
 *
 *   <ScreenHeader title="Saved commutes" onBack={goBack} />
 *   <ScreenHeader title="Chats" subtitle="3 friends" actions={<ThemeToggle />} />
 *
 * Top-level tab screens omit `onBack` (Android back / the tab bar handle it).
 */
interface ScreenHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBack, backLabel = 'Back', actions }) => (
  <header className="app-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
      {onBack && (
        <IconButton label={backLabel} variant="plain" onClick={onBack} style={{ marginLeft: -8 }}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 className="type-heading" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {subtitle && <p className="type-caption" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
  </header>
);
