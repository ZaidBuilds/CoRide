import { useState, useEffect } from 'react';
import { HelpCircle, Lightbulb, Timer } from 'lucide-react';
import type { TwentyQState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { gameInput, gameSubmit, panelTitle, timerChip, errorLine } from './gameStyles';

interface Props {
  game: TwentyQState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

const ANSWER_COLOR: Record<'yes' | 'no' | 'maybe', string> = {
  yes: 'var(--status-success)',
  no: 'var(--status-danger)',
  maybe: 'var(--status-warning)'
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
        <h3 style={panelTitle}>❓ 20 Questions</h3>
        <span style={timerChip}>
          <Timer size={12} aria-hidden="true" /> {game.remaining} questions left
        </span>
      </div>

      <div style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Lightbulb size={13} aria-hidden="true" /> {game.secretCategory} · hint
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{game.secretHint}</div>
        {!isFinished && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Ask yes/no questions · guess anytime</div>}
      </div>

      <ol aria-label="Questions asked" aria-live="polite" style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
        {game.asked.slice(-10).map((a, i) => (
          <li key={`${a.at}_${i}`} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>{a.askerName}: </span>{a.q}
            </div>
            <span style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 800,
              background: 'var(--bg-elevated)',
              color: ANSWER_COLOR[a.a] || 'var(--text-secondary)',
              border: `1px solid ${ANSWER_COLOR[a.a] || 'var(--border-subtle)'}`,
              flexShrink: 0
            }}>
              {a.a.toUpperCase()}
            </span>
          </li>
        ))}
        {game.asked.length === 0 && <li style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No questions yet — ask the first one.</li>}
      </ol>

      {isFinished ? (
        <div role="status" style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: `1px solid ${winner ? 'var(--status-success)' : 'var(--border-subtle)'}`, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>
            {winner ? `🎉 ${winner} got it — ${game.secretWord}!` : `The answer was ${game.secretWord}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{game.guessAttempts.length} guesses · {game.asked.length}/20 asked</div>
        </div>
      ) : (
        <>
          <form onSubmit={ask} style={{ display: 'flex', gap: 8 }}>
            <input value={q} onChange={e => setQ(e.target.value)} maxLength={80} aria-label="Ask a yes or no question" placeholder="Is it something you eat?" style={gameInput} />
            <button type="submit" disabled={!q.trim()} className="btn-primary press" style={gameSubmit}><HelpCircle size={16} aria-hidden="true" /> Ask</button>
          </form>
          <form onSubmit={doGuess} style={{ display: 'flex', gap: 8 }}>
            <input value={guess} onChange={e => setGuess(e.target.value)} maxLength={30} aria-label={`Guess the ${game.secretCategory}`} placeholder={`Guess the ${game.secretCategory}…`} style={gameInput} />
            <button type="submit" disabled={!guess.trim()} className="btn-secondary press" style={gameSubmit}>Guess</button>
          </form>
          {err && <div role="alert" style={errorLine}>{err}</div>}
          {game.guessAttempts.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Recent guesses: {game.guessAttempts.slice(-3).map(g => `${g.guess} ${g.correct ? '✓' : '✗'}`).join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
};
