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

  const color = isHigh ? '#6EE7B7' : isMid ? '#FDE68A' : '#FDA4AF';
  const bg = isHigh ? 'rgba(16,185,129,0.12)' : isMid ? 'rgba(234,179,8,0.10)' : 'rgba(244,63,94,0.10)';
  const border = isHigh ? 'rgba(16,185,129,0.22)' : isMid ? 'rgba(234,179,8,0.18)' : 'rgba(244,63,94,0.18)';

  return (
    <div
      className="confidence-badge"
      style={{ background: bg, color, border: `1px solid ${border}`, backdropFilter:'blur(8px)' }}
      title={context.reason}
    >
      <Radio size={11} />
      <span style={{ fontWeight:800 }}>{context.lineName} → {context.direction.replace('Towards ', '').split(' ')[0]}</span>
      <span style={{
        padding:'2px 6px',
        borderRadius:999,
        background:'rgba(0,0,0,0.24)',
        fontWeight:800,
        fontSize:11,
        border:'1px solid rgba(255,255,255,0.06)'
      }}>
        {pct}%
      </span>
    </div>
  );
};
