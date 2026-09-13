import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
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
}) => {
  return (
    <div
      {...props}
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--ink-700)',
        animationDelay: `${delayMs}ms`,
        ...style
      }}
    />
  );
};
