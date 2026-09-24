import { useEffect, useState } from 'react';
import { CheckIcon, ClockIcon, XIcon } from '@phosphor-icons/react';
import { Avatar } from '../ui/Avatar';
import type { TriviaState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { panelTitle, timerChip, errorLine, gameWell, playerPill } from './gameStyles';

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
      <div>
        <h3 style={panelTitle}>Trivia finished</h3>
        <ol style={{ marginTop: 12, display: 'flex', flexDirection: 'column', listStyle: 'none', padding: 0 }}>
          {sorted.map((p, i) => {
            const me = p.userId === currentUser.id;
            return (
              <li key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '6px 0', borderTop: i ? '1px solid var(--border-subtle)' : undefined, color: 'var(--text-primary)' }}>
                <span className="type-label tnum" style={{ width: 20, color: 'var(--text-muted)' }}>{i + 1}</span>
                <Avatar name={p.pseudonym} seed={p.userId} bg={p.avatarBg} size={32} you={me} />
                <span className="type-label" style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{me ? 'You' : p.pseudonym}</span>
                <span className="type-headline tnum">{game.scores[p.userId] || 0}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (!q) return <div role="status" className="type-meta" style={{ padding: 12, color: 'var(--text-muted)' }}>Loading question</div>;

  const progress = ((game.currentIndex + 1) / game.questions.length) * 100;
  const reveal = game.reveals.find(r => r.qIndex === game.currentIndex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>Fast Trivia</h3>
        <span style={{ ...timerChip, ...(secs < 5 ? { background: 'var(--danger-fill)', color: '#FFFFFF' } : {}) }}>
          <ClockIcon size={14} aria-hidden="true" /> Q {game.currentIndex + 1}/{game.questions.length} · {secs}s
        </span>
      </div>
      <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--bg-tonal)', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ink)', transition: 'width var(--dur-slow) var(--ease-standard)' }} />
      </div>

      <div style={gameWell}>
        <div className="type-meta" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{q.category}</div>
        <div className="type-headline" style={{ color: 'var(--text-primary)', fontSize: 17, lineHeight: '23px' }}>{q.text}</div>
        {q.textHi && <div lang="hi" className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{q.textHi}</div>}
      </div>

      <div role="group" aria-label="Answers" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          const isChosen = chosen === i;
          const isCorrect = !!reveal && reveal.correct === i;
          const isWrongChosen = isChosen && !!reveal && reveal.correct !== i;
          const fill: React.CSSProperties = isCorrect
            ? { background: 'var(--signal)', color: 'var(--ink-fixed)', borderColor: 'var(--signal)' }
            : isWrongChosen
              ? { background: 'var(--danger-fill)', color: '#FFFFFF', borderColor: 'var(--danger-fill)' }
              : isChosen
                ? { background: 'var(--ink)', color: 'var(--ink-inverse)', borderColor: 'var(--ink)' }
                : { background: 'transparent', color: 'var(--text-primary)', borderColor: 'var(--border-strong)' };
          const dim = !!reveal && !isCorrect && !isChosen;
          return (
            <button
              key={i}
              type="button"
              onClick={() => answer(i)}
              disabled={hasAnswered || !!reveal}
              aria-pressed={isChosen}
              className="press"
              style={{
                textAlign: 'left',
                minHeight: 48,
                padding: '10px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid',
                ...fill,
                opacity: dim ? 0.5 : 1,
                fontSize: 15,
                fontWeight: 560,
                cursor: hasAnswered || reveal ? 'default' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span><span style={{ opacity: 0.6, marginRight: 8 }}>{String.fromCharCode(65 + i)}</span>{opt}</span>
              {isCorrect && <CheckIcon size={18} weight="bold" aria-label="Correct answer" style={{ flexShrink: 0 }} />}
              {isWrongChosen && <XIcon size={18} weight="bold" aria-label="Wrong" style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
      {hasAnswered && !reveal && (
        <div role="status" className="type-meta" style={{ color: 'var(--text-secondary)' }}>Locked in. The answer shows when the timer ends.</div>
      )}
      {err && <div role="alert" style={errorLine}>{err}</div>}

      <ul aria-label="Players" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
        {game.players.map(p => {
          const answered = game.answers[p.userId] !== null && game.answers[p.userId] !== undefined;
          return (
            <li key={p.userId} style={playerPill(false)}>
              <Avatar name={p.pseudonym} seed={p.userId} bg={p.avatarBg} size={24} />
              {p.userId === currentUser.id ? 'You' : p.pseudonym}
              <span className="tnum" style={{ opacity: 0.72 }}>{game.scores[p.userId] || 0}</span>
              <span className="sr-only">{answered ? ', answered' : ', thinking'}</span>
              {answered
                ? <CheckIcon size={14} weight="bold" aria-hidden="true" style={{ color: 'var(--success-text)' }} />
                : <ClockIcon size={14} aria-hidden="true" style={{ opacity: 0.6 }} />}
            </li>
          );
        })}
      </ul>
      <div className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>
        15s per question · {game.questions.length} questions · {game.players.length} playing
      </div>
    </div>
  );
};
