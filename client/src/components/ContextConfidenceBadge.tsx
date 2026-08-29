import type { ContextResult } from '../types';
import { Radio } from 'lucide-react';

interface Props {
  context: ContextResult | null;
}

export const ContextConfidenceBadge: React.FC<Props> = ({ context }) => {
  if (!context) return null;

  const pct = Math.round(context.confidence * 100);
  const isHigh = pct >= 70;
  const isMid = pct >= 40 && pct < 70;

  const color = isHigh ? 'var(--accent-emerald)' : isMid ? 'var(--accent-amber)' : 'var(--accent-rose)';
  const bg = isHigh ? 'rgba(16,185,129,0.12)' : isMid ? 'rgba(245,158,11,0.12)' : 'rgba(244,63,94,0.12)';
  const border = isHigh ? 'rgba(16,185,129,0.3)' : isMid ? 'rgba(245,158,11,0.3)' : 'rgba(244,63,94,0.3)';

  return (
    <div
      className="confidence-badge"
      style={{ background: bg, color, border: `1px solid ${border}` }}
      title={context.reason}
    >
      <Radio size={12} />
      <span>{context.lineName} → {context.direction.replace('Towards ', '')}</span>
      <span style={{
        padding: '1px 6px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(0,0,0,0.3)',
        fontWeight: 800,
        fontSize: 10
      }}>
        {pct}%
      </span>
    </div>
  );
};
