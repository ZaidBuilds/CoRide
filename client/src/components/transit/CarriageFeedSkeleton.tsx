import React from 'react';
import { Skeleton } from '../ui/Skeleton';

/**
 * Loading placeholder for the rider feed, shaped like the rider card
 * (DESIGN §5): surface card with a line stub, squircle avatar, name and
 * tagline, interest chips, one pill action. Inherits --line from the screen.
 */
export const CarriageFeedSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <span className="sr-only">Loading riders</span>
      {[0, 1, 2].map((idx) => {
        const delay = idx * 150;
        return (
          <div
            key={idx}
            aria-hidden="true"
            className="card has-stub"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, opacity: 1 - idx * 0.18 }}
          >
            <Skeleton width={48} height={48} borderRadius="var(--radius-squircle)" delayMs={delay} />

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
              <Skeleton width="46%" height={16} delayMs={delay + 50} />
              <Skeleton width="78%" height={12} delayMs={delay + 100} />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <Skeleton width={64} height={28} borderRadius="var(--radius-pill)" delayMs={delay + 125} />
                <Skeleton width={72} height={28} borderRadius="var(--radius-pill)" delayMs={delay + 150} />
              </div>
            </div>

            <Skeleton width={92} height={40} borderRadius="var(--radius-pill)" delayMs={delay + 200} style={{ alignSelf: 'center' }} />
          </div>
        );
      })}
    </div>
  );
};
