import { useState } from 'react';

const EMOJIS = ['❤️','😂','🔥','👏','😮','🙏','👍','☕','🎧','🚇'] as const;

interface Props {
  targetId: string;
  targetType: 'message' | 'profile' | 'submission';
  roomId?: string;
  counts?: Record<string, number>;
  myReactions?: string[]; // emojis user already used
  onToggle: (emoji: string) => void;
  compact?: boolean;
}

export const ReactionBar: React.FC<Props> = ({ counts = {}, myReactions = [], onToggle, compact }) => {
  const [open, setOpen] = useState(false);
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const hasReactions = total > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {hasReactions && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([emoji, c]) => (
            <button
              key={emoji}
              onClick={() => onToggle(emoji)}
              style={{
                padding: compact ? '2px 6px' : '4px 8px',
                borderRadius: 'var(--radius-full)',
                background: myReactions.includes(emoji) ? 'rgba(99,102,241,0.22)' : 'var(--bg-surface)',
                border: `1px solid ${myReactions.includes(emoji) ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)'}`,
                fontSize: compact ? 11 : 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontWeight: 700, fontSize: compact ? 10 : 11 }}>{c}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: compact ? 22 : 26,
            height: compact ? 22 : 26,
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer'
          }}
          title="React"
        >
          +
        </button>
        {open && (
          <div style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 6,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            width: 180,
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => { onToggle(e); setOpen(false); }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: myReactions.includes(e) ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: '1px solid transparent',
                  fontSize: 18,
                  cursor: 'pointer'
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
