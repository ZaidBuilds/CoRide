import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const CarriageFeedSkeleton: React.FC = () => {
  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <span className="sr-only">Loading travelers</span>
      {[0, 1, 2].map((idx) => {
        const delay = idx * 150;
        return (
          <div
            key={idx}
            aria-hidden="true"
            className="traveler-card"
            style={{
              padding: '14px',
              gap: 12,
              cursor: 'default',
              pointerEvents: 'none'
            }}
          >
            {/* 48dp Avatar Placeholder */}
            <Skeleton
              width={52}
              height={52}
              borderRadius="50%"
              delayMs={delay}
              style={{ flexShrink: 0 }}
            />

            {/* Middle Content Placeholders */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Name & Badge Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Skeleton width={110} height={16} borderRadius={4} delayMs={delay + 50} />
                <Skeleton width={70} height={18} borderRadius={999} delayMs={delay + 75} />
              </div>

              {/* Bio / Commute Route Row */}
              <Skeleton width="75%" height={12} borderRadius={4} delayMs={delay + 100} />

              {/* Tags Row */}
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <Skeleton width={56} height={20} borderRadius={999} delayMs={delay + 125} />
                <Skeleton width={64} height={20} borderRadius={999} delayMs={delay + 150} />
              </div>
            </div>

            {/* 48dp Connect Action Placeholder */}
            <Skeleton
              width={48}
              height={48}
              borderRadius="50%"
              delayMs={delay + 200}
              style={{ flexShrink: 0 }}
            />
          </div>
        );
      })}
    </div>
  );
};
