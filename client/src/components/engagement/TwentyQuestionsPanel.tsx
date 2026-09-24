import { useState, useEffect } from 'react';
import { CheckIcon, LightbulbIcon, QuestionIcon, XIcon } from '@phosphor-icons/react';
import type { TwentyQState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { gameInput, submitStyle, panelTitle, timerChip, errorLine, gameWell } from './gameStyles';

interface Props {
  game: TwentyQState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

/** Yes = ink, no = danger, maybe = tonal. Text always says the word too. */
const ANSWER_STYLE: Record<'yes' | 'no' | 'maybe', React.CSSProperties> = {
  yes: { background: 'var(--ink)', color: 'var(--ink-inverse)' },
  no: { background: 'var(--danger-fill)', color: '#FFFFFF' },
  maybe: { background: 'var(--bg-tonal)', color: 'var(--text-primary)' }
};

export const TwentyQuestionsPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [q, setQ] = useState('');
  const [guess, setGuess] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onErr = (p: { error?: string }) => setErr(p?.error || 'Try again.');
    socket.on('game_error', onErr);
    return () => { socket.off('game_error', onErr); };
  }, [socket]);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || !socket) return;
    socket.emit('twenty_q_ask', { roomId, userId: currentUser.id, pseudonym: currentUser.pseudonym, question: q.trim() });
    setQ(''); setErr(null);
  };
  const doGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !socket) return;
    socket.emit('twenty_q_guess', { roomId, userId: currentUser.id, guess: guess.trim() });
    setGuess(''); setErr(null);
  };

  const isFinished = game.status === 'finished';
  const winner = game.winnerId ? game.players.find(p => p.userId === game.winnerId)?.pseudonym || 'Someone' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>20 Questions</h3>
        <span style={timerChip}>
          {game.remaining} left
        </span>
      </div>

      <div style={gameWell}>
        <div className="type-meta" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <LightbulbIcon size={16} aria-hidden="true" /> Hint · {game.secretCategory}
        </div>
        <div className="type-headline" style={{ color: 'var(--text-primary)', marginTop: 6 }}>{game.secretHint}</div>
        {!isFinished && <div className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 4 }}>Ask yes or no questions. Guess any time.</div>}
      </div>

      <ol aria-label="Questions asked" aria-live="polite" style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', listStyle: 'none', margin: 0, padding: 0 }}>
        {game.asked.slice(-10).map((a, i) => (
          <li key={`${a.at}_${i}`} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div className="type-meta" style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)' }}>{a.askerName}: </span>{a.q}
            </div>
            <span
              className="type-meta"
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 600,
                flexShrink: 0,
                ...(ANSWER_STYLE[a.a] || ANSWER_STYLE.maybe)
              }}
            >
              {a.a === 'yes' ? 'Yes' : a.a === 'no' ? 'No' : 'Maybe'}
            </span>
          </li>
        ))}
        {game.asked.length === 0 && <li className="type-meta" style={{ color: 'var(--text-muted)', padding: '8px 0' }}>No questions yet. Ask the first one.</li>}
      </ol>

      {isFinished ? (
        <div role="status" style={{ ...gameWell, ...(winner ? { background: 'var(--ink)', color: 'var(--ink-inverse)' } : {}) }}>
          <div className="type-headline" style={{ color: winner ? 'var(--ink-inverse)' : 'var(--text-primary)' }}>
            {winner ? `${winner} got it: ${game.secretWord}` : `The answer was ${game.secretWord}`}
          </div>
          <div className="type-meta tnum" style={{ opacity: 0.8, marginTop: 4, color: winner ? 'var(--ink-inverse)' : 'var(--text-secondary)' }}>
            {game.guessAttempts.length} guesses · {game.asked.length}/20 asked
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={ask} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={e => setQ(e.target.value)} maxLength={80} aria-label="Ask a yes or no question" placeholder="Is it something you eat?" style={gameInput} />
            <button type="submit" disabled={!q.trim()} className="press" style={submitStyle(!!q.trim())}><QuestionIcon size={18} aria-hidden="true" /> Ask</button>
          </form>
          <form onSubmit={doGuess} style={{ display: 'flex', gap: 8 }}>
            <input value={guess} onChange={e => setGuess(e.target.value)} maxLength={30} aria-label={`Guess the ${game.secretCategory}`} placeholder={`Guess the ${game.secretCategory}`} style={gameInput} />
            <button type="submit" disabled={!guess.trim()} className="press" style={submitStyle(!!guess.trim())}>Guess</button>
          </form>
          {err && <div role="alert" style={errorLine}>{err}</div>}
          {game.guessAttempts.length > 0 && (
            <div className="type-meta" style={{ color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
              <span>Recent guesses</span>
              {game.guessAttempts.slice(-3).map((g, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}>
                  {g.guess}
                  {g.correct
                    ? <CheckIcon size={14} weight="bold" aria-label="correct" />
                    : <XIcon size={14} weight="bold" aria-label="wrong" style={{ color: 'var(--danger-text)' }} />}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
