import type { ContextResult } from '../types';
import { Radio } from 'lucide-react';

interface Props {
  context: ContextResult | null;
}

/**
 * Shows the detected line/direction and how sure the detector is. The
 * percentage is the server's real confidence score; the words next to it say
 * what that means so nobody has to interpret a bare number.
 */
export const ContextConfidenceBadge: React.FC<Props> = ({ context }) => {
  if (!context) return null;

  const pct = Math.round(Math.max(0, Math.min(1, context.confidence)) * 100);
  const level = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
  const tone = {
    high: { color: 'var(--success-text)', bg: 'var(--success-container)', word: 'Likely' },
    mid: { color: 'var(--warning-text)', bg: 'var(--warning-container)', word: 'Unsure' },
    low: { color: 'var(--danger-text)', bg: 'var(--danger-container)', word: 'Guess' },
  }[level];

  const towards = (context.direction || '').replace(/^Towards\s+/i, '');
  const summary = [context.lineName, towards && `towards ${towards}`].filter(Boolean).join(' ');

  return (
    <div
      className="confidence-badge"
      style={{ background: tone.bg, color: tone.color, maxWidth: '100%' }}
      title={context.reason}
      aria-label={`Detected ${summary || 'your line'}, ${pct}% confidence`}
    >
      <Radio size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {summary || 'Detecting line…'}
      </span>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {tone.word} · {pct}%
      </span>
    </div>
  );
};
