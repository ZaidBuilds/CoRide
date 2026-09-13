import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../../utils/nativeBridge';

interface OfflineBannerProps {
  lastSyncTime?: Date;
  onRetry?: () => void;
  isReconnecting?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  lastSyncTime,
  onRetry,
  isReconnecting = false
}) => {
  const formattedTime = lastSyncTime
    ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'recently';

  return (
    <div
      role="status"
      aria-live="polite"
      className="offline-banner"
      style={{
        margin: '8px 0 12px',
        background: 'rgba(22, 25, 31, 0.95)',
        border: '1px solid var(--amber-500)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(217, 119, 6, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--amber-500)',
          flexShrink: 0
        }}
      >
        <WifiOff size={16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Subway Tunnel Mode
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          Showing cached co-riders ({formattedTime}) • Messages queue locally until next station
        </div>
      </div>

      {onRetry && (
        <button
          onClick={() => {
            triggerHaptic('light');
            onRetry();
          }}
          disabled={isReconnecting}
          className="press"
          style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 10px',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer'
          }}
        >
          <RefreshCw
            size={12}
            style={{
              animation: isReconnecting ? 'spin 1s linear infinite' : 'none'
            }}
          />
          {isReconnecting ? 'Syncing…' : 'Sync'}
        </button>
      )}
    </div>
  );
};
