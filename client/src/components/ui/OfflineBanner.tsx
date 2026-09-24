import React from 'react';
import { WifiSlashIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * OfflineBanner: shown while the live connection is down (tunnels, basements).
 * A surface card with an amber stub. Say what still works; never fake a time.
 * App.tsx renders the app-wide one; don't stack another on the same screen.
 *
 *   <OfflineBanner onRetry={reconnect} isReconnecting={status === 'connecting'} />
 */
interface OfflineBannerProps {
  /** When the app last had live data. Omit if unknown. */
  lastSyncTime?: Date;
  onRetry?: () => void;
  isReconnecting?: boolean;
  /** Override the default explanatory line. */
  detail?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  lastSyncTime,
  onRetry,
  isReconnecting = false,
  detail,
}) => {
  const since = lastSyncTime
    ? ` Last updated ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    : '';

  return (
    <div role="status" aria-live="polite" className="offline-banner">
      <WifiSlashIcon size={22} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="type-label" style={{ color: 'var(--text-primary)' }}>
          {isReconnecting ? 'Reconnecting' : "You're offline"}
        </div>
        <div className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
          {detail ?? `Live updates are paused. Messages you send are saved and go out when you reconnect.${since}`}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={() => { void triggerHaptic('light'); onRetry(); }}
          disabled={isReconnecting}
          className="link-btn"
          aria-label="Retry connection"
          style={{ flexShrink: 0, textDecoration: 'none' }}
        >
          <ArrowClockwiseIcon size={18} aria-hidden="true" style={{ animation: isReconnecting ? 'spin 1s linear infinite' : 'none' }} />
          Retry
        </button>
      )}
    </div>
  );
};
