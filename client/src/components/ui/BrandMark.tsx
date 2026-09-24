import React from 'react';

/**
 * BrandMark: the CoRide logo (geometry from src/assets/brand/mark.svg).
 * Two riders on one route: parallel track arcs forming a C, ending at a station.
 * Always Signal Lime tile + ink strokes; never recolour it.
 *
 *   <BrandMark size={40} />                 decorative (aria-hidden)
 *   <BrandMark size={56} title="CoRide" />  announced as an image
 *   <BrandMark size={28} wordmark />        mark + "CoRide" wordmark
 */
interface BrandMarkProps {
  size?: number;
  title?: string;
  wordmark?: boolean;
  style?: React.CSSProperties;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 40, title, wordmark = false, style }) => {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0, ...(wordmark ? {} : style) }}
    >
      <rect width="64" height="64" rx="18" fill="#C8F031" />
      <path d="M44 17.6A18 18 0 1 0 44 46.4" fill="none" stroke="#111418" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M40.6 24.5A10.5 10.5 0 1 0 40.6 39.5" fill="none" stroke="#111418" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="47" cy="32" r="5" fill="#111418" />
    </svg>
  );
  if (!wordmark) return svg;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32), ...style }}>
      {svg}
      <span style={{ fontSize: Math.round(size * 0.78), lineHeight: 1, fontWeight: 700, fontStretch: '85%', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
        CoRide
      </span>
    </span>
  );
};
