import { NavigationArrowIcon, HandPointingIcon, ClockCounterClockwiseIcon, CalendarDotsIcon } from '@phosphor-icons/react';
import type { ContextResult } from '../types';
import type { LocationContext } from '../hooks/useLocationContext';
import { describeContext } from '../utils/commuteContext';

interface Props {
  context: ContextResult | LocationContext | null;
}

const SOURCE_ICON = {
  gps: NavigationArrowIcon,
  manual: HandPointingIcon,
  last_checkin: ClockCounterClockwiseIcon,
  schedule: CalendarDotsIcon,
  none: NavigationArrowIcon,
} as const;

/**
 * One quiet line that says which signal placed you and how sure it is:
 * "GPS · ±20 m · Likely", "Your pick", "Near Karol Bagh? · Unsure".
 * A neutral tonal pill; only the small dot carries the status colour.
 * The percentage stays in the accessible name and the tooltip, not the chrome.
 */
export const ContextConfidenceBadge: React.FC<Props> = ({ context }) => {
  if (!context) return null;
  const ctx = context as LocationContext;
  const source = ctx.source ?? 'gps';
  const pct = Math.round(Math.max(0, Math.min(1, ctx.confidence)) * 100);
  const d = describeContext(ctx);
  const manual = source === 'manual';
  const level = manual || pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
  const tone = {
    high: { dot: 'var(--status-ok)', word: manual ? '' : 'Likely' },
    mid: { dot: 'var(--status-warn)', word: 'Unsure' },
    low: { dot: 'var(--status-danger)', word: 'Guess' },
  }[level];
  const Icon = SOURCE_ICON[source] ?? NavigationArrowIcon;
  const text = [d.needsConfirm && source !== 'none' ? d.headline : null, d.meta, tone.word || null].filter(Boolean).join(' · ');

  return (
    <div
      className="confidence-badge"
      style={{ background: 'var(--bg-tonal)', color: 'var(--text-secondary)', maxWidth: '100%' }}
      title={ctx.reason}
      role="note"
      aria-label={`${d.headline}. ${d.meta}${manual ? '' : `, ${pct}% confidence`}`}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
      <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span className="tnum" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
};
