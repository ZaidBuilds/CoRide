import React from 'react';

/**
 * Skeleton — placeholder block for content that is loading. Prefer skeletons
 * shaped like the real layout over spinners for lists and cards. Decorative:
 * hidden from screen readers — put `aria-busy="true"` on the region that is
 * loading (or a visually-hidden "Loading…" label) instead.
 *
 *   <Skeleton width={120} height={16} />
 *   <Skeleton width={48} height={48} borderRadius="50%" delayMs={150} />
 *
 * Pulse stops under prefers-reduced-motion.
 */
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  /** Stagger the pulse so a list doesn't throb in unison. */
  delayMs?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 'var(--radius-sm)',
  delayMs = 0,
  style,
  className = '',
  ...props
}) => (
  <div
    aria-hidden="true"
    {...props}
    className={`skeleton-pulse ${className}`.trim()}
    style={{ width, height, borderRadius, animationDelay: `${delayMs}ms`, flexShrink: 0, ...style }}
  />
);
