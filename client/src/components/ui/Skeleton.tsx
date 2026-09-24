import React from 'react';

/**
 * Skeleton: placeholder shaped like the content that is loading. Prefer these
 * over spinners for lists and cards. Decorative (aria-hidden); mark the loading
 * region with aria-busy="true" or a visually hidden "Loading" label.
 *
 *   <Skeleton width={120} height={16} />
 *   <Skeleton width={48} height={48} borderRadius="var(--radius-squircle)" delayMs={150} />  // avatar
 *   <Skeleton height={96} borderRadius="var(--radius-card)" />                               // card
 *
 * Uses --bg-tonal; the pulse stops under prefers-reduced-motion.
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
