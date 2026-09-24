import React from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { IconButton } from './IconButton';

/**
 * ScreenHeader: sticky top bar for a screen inside the app shell. Solid
 * concrete (no blur), spans edge to edge under the status bar (.app-header).
 *
 *   <ScreenHeader title="Saved commutes" onBack={goBack} />                  pushed screen: Title type
 *   <ScreenHeader title="Chats" size="large" actions={<ThemeToggle />} />   tab root: condensed Display type
 *   <ScreenHeader title="Rajiv Chowk" subtitle="3 riders here" onBack={…} />
 *
 * Tab roots omit `onBack` (Android back and the tab bar handle it).
 */
interface ScreenHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  /** 'large' uses the condensed Display face for top-level tab screens. */
  size?: 'default' | 'large';
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBack, backLabel = 'Back', actions, size = 'default' }) => (
  <header className="app-header">
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
      {onBack && (
        <IconButton label={backLabel} variant="plain" onClick={onBack} style={{ marginLeft: -12 }}>
          <ArrowLeftIcon size={24} aria-hidden="true" />
        </IconButton>
      )}
      <div style={{ minWidth: 0 }}>
        <h1
          className={size === 'large' ? 'type-display' : 'type-title'}
          style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {title}
        </h1>
        {subtitle && <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>{actions}</div>}
  </header>
);
