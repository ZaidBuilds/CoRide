import React, { useState } from 'react';
import { Bell, Share2, Clock, Check, Train } from 'lucide-react';
import { Button } from './Button';
import { triggerHaptic } from '../../utils/nativeBridge';

interface EmptyStateProps {
  lineName?: string;
  stationName?: string;
  direction?: string;
  onBrowseOtherLines?: () => void;
  onEnablePush?: () => void;
  pushEnabled?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  lineName = 'Blue Line',
  stationName = 'Rajiv Chowk',
  direction = 'Towards Noida',
  onBrowseOtherLines,
  onEnablePush,
  pushEnabled = false
}) => {
  const [copied, setCopied] = useState(false);
  const [notified, setNotified] = useState(pushEnabled);

  const handleShare = async () => {
    triggerHaptic('medium');
    const shareText = `🚇 I'm on Delhi Metro ${lineName} at ${stationName} (${direction}). Boarding soon? Join my carriage room on CoRide!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CoRide — Live Metro Carriage',
          text: shareText,
          url: window.location.origin
        });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(`${shareText} ${window.location.origin}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNotifyToggle = () => {
    triggerHaptic('light');
    setNotified(!notified);
    onEnablePush?.();
  };

  return (
    <div className="empty-state-card animate-fade-in" style={{ margin: '14px 0' }}>
      {/* Hero Icon */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'rgba(37, 99, 235, 0.14)',
        border: '2px solid rgba(37, 99, 235, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--signal-400)',
        fontSize: 28
      }}>
        <Train size={32} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          You're the first on this service!
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4, maxWidth: 300 }}>
          {lineName} • {stationName} ({direction}). The carriage room is live — co-travelers board at upcoming stations.
        </p>
      </div>

      {/* Actionable CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 4 }}>
        <Button
          variant="primary"
          fullWidth
          icon={notified ? <Check size={16} /> : <Bell size={16} />}
          onClick={handleNotifyToggle}
        >
          {notified ? 'Boarding Alerts Active ✓' : 'Notify me when someone boards'}
        </Button>

        <Button
          variant="secondary"
          fullWidth
          icon={copied ? <Check size={16} /> : <Share2 size={16} />}
          onClick={handleShare}
        >
          {copied ? 'Link Copied to Clipboard!' : 'Invite a co-commuter / share'}
        </Button>
      </div>

      {/* Peak commute rush insight */}
      <div style={{
        width: '100%',
        maxWidth: 320,
        background: 'var(--bg-canvas)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
        textAlign: 'left'
      }}>
        <Clock size={16} style={{ color: 'var(--amber-500)', flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block' }}>Next Peak Commute Window</strong>
          07:30 – 10:30 & 17:00 – 20:30 IST • 50+ commuters average
        </div>
      </div>

      {onBrowseOtherLines && (
        <button
          onClick={onBrowseOtherLines}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 4
          }}
        >
          Explore other metro lines →
        </button>
      )}
    </div>
  );
};
