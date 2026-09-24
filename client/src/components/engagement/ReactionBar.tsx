import { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { pushBackHandler } from '../../utils/nativeBridge';

/** Must match the server's allow-list in the reaction_toggle handler. */
const EMOJIS = ['❤️','😂','🔥','👏','😮','🙏','👍','☕','🎧','🚇'] as const;

interface Props {
  targetId: string;
  targetType: 'message' | 'profile' | 'submission';
  roomId?: string;
  counts?: Record<string, number>;
  myReactions?: string[]; // emojis user already used
  onToggle: (emoji: string) => void;
  compact?: boolean;
  /** Right-align (own messages). */
  alignEnd?: boolean;
  /** Start with the picker open (e.g. revealed by tapping a message). */
  defaultOpen?: boolean;
  /** Picker closed without picking (outside tap / Escape). */
  onDismiss?: () => void;
}

/**
 * Reaction chips + an add-reaction button. Every tappable thing has a 44px+
 * hit area (the visible pill sits inside a transparent button). The picker
 * opens inline under the chips rather than as a floating popover, so it can
 * never be clipped by a scrolling message list.
 */
export const ReactionBar: React.FC<Props> = ({ counts = {}, myReactions = [], onToggle, compact, alignEnd, defaultOpen = false, onDismiss }) => {
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  const pill = compact ? 26 : 30;

  // Close on outside tap / Escape; keep the opened picker in view.
  useEffect(() => {
    if (!open) return;
    (wrapRef.current?.lastElementChild as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
    const close = () => { setOpen(false); onDismiss?.(); };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    const popBack = pushBackHandler(() => { close(); return true; });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      popBack();
    };
  }, [open, onDismiss]);

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', alignItems: alignEnd ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: alignEnd ? 'flex-end' : 'flex-start', margin: '-8px -2px' }}>
        {entries.map(([emoji, c]) => {
          const mine = myReactions.includes(emoji);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggle(emoji)}
              aria-pressed={mine}
              aria-label={`${emoji} ${c} ${c === 1 ? 'reaction' : 'reactions'}${mine ? ', including yours. Tap to remove' : '. Tap to add yours'}`}
              style={hitArea}
            >
              <span style={{
                height: pill,
                padding: '0 8px',
                borderRadius: 'var(--radius-full)',
                background: mine ? 'var(--bg-accent-soft, var(--bg-surface-raised))' : 'var(--bg-surface)',
                border: `1px solid ${mine ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: compact ? 12 : 13,
                color: 'var(--text-primary)'
              }}>
                <span aria-hidden="true">{emoji}</span>
                <span style={{ fontWeight: 700, fontSize: compact ? 11 : 12 }}>{c}</span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Add reaction"
          aria-expanded={open}
          style={hitArea}
        >
          <span style={{
            width: pill,
            height: pill,
            borderRadius: '50%',
            background: open ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <SmilePlus size={compact ? 14 : 16} aria-hidden="true" />
          </span>
        </button>
      </div>
      {open && (
        <div
          role="group"
          aria-label="Pick a reaction"
          className="animate-fade-in"
          style={{
            marginTop: 8,
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 44px)',
            gap: 2,
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {EMOJIS.map(e => {
            const mine = myReactions.includes(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => { onToggle(e); setOpen(false); }}
                aria-pressed={mine}
                aria-label={`React ${e}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  background: mine ? 'var(--bg-surface)' : 'transparent',
                  border: mine ? '1px solid var(--accent-purple)' : '1px solid transparent',
                  fontSize: 22,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const hitArea: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '0 2px',
  background: 'none',
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};
