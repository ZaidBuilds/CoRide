import { useEffect, useState } from 'react';
import { Clock, Trophy, Check, X } from 'lucide-react';
import type { TriviaState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { panelTitle, timerChip, errorLine } from './gameStyles';

interface Props {
  game: TriviaState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

const secondsTo = (t: number) => Math.max(0, Math.floor((t - Date.now()) / 1000));

export const TriviaPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [secs, setSecs] = useState(() => secondsTo(game.currentEndsAt));
  const [err, setErr] = useState<string | null>(null);
  const q = game.questions[game.currentIndex];
  const chosen = game.answers[currentUser.id];
  const hasAnswered = chosen !== undefined && chosen !== null;

  useEffect(() => {
    const id = setInterval(() => setSecs(secondsTo(game.currentEndsAt)), 400);
    return () => clearInterval(id);
  }, [game.currentEndsAt, game.currentIndex]);

  useEffect(() => {
    if (!socket) return;
    const onErr = (p: { error?: string }) => setErr(p?.error || null);
    socket.on('game_error', onErr);
    return () => { socket.off('game_error', onErr); };
  }, [socket]);

  const answer = (idx: number) => {
    if (hasAnswered || !socket) return;
    setErr(null);
    socket.emit('trivia_answer', { roomId, userId: currentUser.id, choice: idx });
  };

  if (game.status === 'finished') {
    const sorted = [...game.players].sort((a, b) => (game.scores[b.userId] || 0) - (game.scores[a.userId] || 0));
    return (
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ ...panelTitle, justifyContent: 'center', fontSize: 16 }}>🏁 Trivia finished</h3>
        <ol style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', padding: 0 }}>
          {sorted.map((p, i) => (
            <li key={p.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: `1px solid ${i === 0 ? 'var(--status-warning)' : 'var(--border-subtle)'}`, color: 'var(--text-primary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, background: p.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>{i + 1}</span>
                {p.pseudonym}{p.userId === currentUser.id ? ' (you)' : ''}
              </span>
              <span style={{ fontWeight: 900 }}>{game.scores[p.userId] || 0}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (!q) return <div role="status" style={{ padding: 12, color: 'var(--text-muted)' }}>Loading question…</div>;

  const progress = ((game.currentIndex + 1) / game.questions.length) * 100;
  const reveal = game.reveals.find(r => r.qIndex === game.currentIndex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>⚡ Fast Trivia</h3>
        <span style={{ ...timerChip, ...(secs < 5 ? { color: 'var(--status-danger)', borderColor: 'var(--status-danger)' } : {}) }}>
          <Clock size={12} aria-hidden="true" /> Q {game.currentIndex + 1}/{game.questions.length} · {secs}s
        </span>
      </div>
      <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-purple)', transition: 'width 0.3s' }} />
      </div>

      <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{q.text}</div>
        {q.textHi && <div lang="hi" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{q.textHi}</div>}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{q.category}</div>
      </div>

      <div role="group" aria-label="Answers" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          const isChosen = chosen === i;
          const isCorrect = !!reveal && reveal.correct === i;
          const isWrongChosen = isChosen && !!reveal && reveal.correct !== i;
          const border = isCorrect ? 'var(--status-success)' : isWrongChosen ? 'var(--status-danger)' : isChosen ? 'var(--accent-purple)' : 'var(--border-subtle)';
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={hasAnswered || !!reveal}
              aria-pressed={isChosen}
              className="press"
              style={{
                textAlign: 'left',
                minHeight: 48,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: isChosen ? 'var(--bg-surface-raised)' : 'var(--bg-elevated)',
                border: `${isChosen || isCorrect ? 2 : 1}px solid ${border}`,
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: hasAnswered || reveal ? 'default' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>{String.fromCharCode(65 + i)}. {opt}</span>
              {isCorrect && <Check size={18} aria-label="Correct answer" style={{ color: 'var(--status-success)', flexShrink: 0 }} />}
              {isWrongChosen && <X size={18} aria-label="Wrong" style={{ color: 'var(--status-danger)', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
      {hasAnswered && !reveal && (
        <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Locked in — answer revealed when the timer ends.</div>
      )}
      {err && <div role="alert" style={errorLine}>{err}</div>}

      <ul aria-label="Players" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
        {game.players.map(p => {
          const answered = game.answers[p.userId] !== null && game.answers[p.userId] !== undefined;
          return (
            <li key={p.userId} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', border: `1px solid ${answered ? 'var(--status-success)' : 'var(--border-subtle)'}`, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: p.avatarBg, display: 'inline-block' }} />
              {p.pseudonym} · {game.scores[p.userId] || 0}
              <span className="sr-only">{answered ? ', answered' : ', thinking'}</span>
              <span aria-hidden="true">{answered ? '✓' : '…'}</span>
            </li>
          );
        })}
      </ul>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Trophy size={11} aria-hidden="true" /> 15s per question · {game.questions.length} questions · {game.players.length} playing
      </div>
    </div>
  );
};
