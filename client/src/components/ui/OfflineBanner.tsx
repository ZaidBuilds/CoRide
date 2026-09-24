import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../../utils/nativeBridge';

/**
 * OfflineBanner — shown while the live connection is down (e.g. in a tunnel).
 * Keep it honest: say what still works. App.tsx renders the app-wide one; don't
 * stack another on the same screen.
 *
 *   <OfflineBanner onRetry={reconnect} isReconnecting={status === 'connecting'} />
 */
interface OfflineBannerProps {
  /** When the app last had live data. Omit if unknown — never fake it. */
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
      <WifiOff size={18} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="type-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {isReconnecting ? 'Reconnecting…' : "You're offline"}
        </div>
        <div className="type-caption" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
          {detail ?? `Live updates are paused. Direct messages you send are saved and delivered when you reconnect.${since}`}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={() => { void triggerHaptic('light'); onRetry(); }}
          disabled={isReconnecting}
          className="link-btn"
          aria-label="Retry connection"
          style={{ flexShrink: 0 }}
        >
          <RefreshCw size={16} aria-hidden="true" style={{ animation: isReconnecting ? 'spin 1s linear infinite' : 'none' }} />
          Retry
        </button>
      )}
    </div>
  );
};
