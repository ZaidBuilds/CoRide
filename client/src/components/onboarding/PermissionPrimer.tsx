import React from 'react';
import { MapPin, ShieldCheck, ArrowRight, ListFilter } from 'lucide-react';
import { Button } from '../ui/Button';

interface PermissionPrimerProps {
  onAllowLocation: () => void;
  onChooseManually: () => void;
}

export const PermissionPrimer: React.FC<PermissionPrimerProps> = ({
  onAllowLocation,
  onChooseManually
}) => {
  return (
    <div
      className="animate-fade-in"
      style={{
        padding: '24px 16px',
        maxWidth: 420,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}
    >
      {/* Icon cluster */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.14)',
          border: '2px solid rgba(37, 99, 235, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--signal-400)',
          marginBottom: 16
        }}
      >
        <MapPin size={34} />
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        Suggest Nearest Station
      </h2>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
        CoRide uses your device location while the app is open to auto-suggest which Delhi Metro station concourse or platform you are entering.
      </p>

      {/* Privacy Guarantee Box */}
      <div
        style={{
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          textAlign: 'left',
          marginBottom: 24,
          display: 'flex',
          gap: 12
        }}
      >
        <ShieldCheck size={20} style={{ color: 'var(--mint-500)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>
            Privacy Guarantee
          </strong>
          No background tracking. Coordinates are converted to a station bucket and never broadcast to strangers.
        </div>
      </div>

      {/* Actions */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          icon={<ArrowRight size={18} />}
          onClick={onAllowLocation}
        >
          Enable Location Auto-Detect
        </Button>

        <Button
          variant="secondary"
          fullWidth
          size="md"
          icon={<ListFilter size={16} />}
          onClick={onChooseManually}
        >
          Choose Station Manually (15s)
        </Button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
        Manual selection is always 100% available without penalty.
      </p>
    </div>
  );
};
