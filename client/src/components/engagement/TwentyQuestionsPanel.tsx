import { useState, useEffect } from 'react';
import { HelpCircle, Lightbulb, Timer } from 'lucide-react';
import type { TwentyQState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';

interface Props {
  game: TwentyQState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

export const TwentyQuestionsPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [q, setQ] = useState('');
  const [guess, setGuess] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onErr = (p: any) => setErr(p.error);
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
    setGuess('');
  };

  const isFinished = game.status === 'finished';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          ❓ 20 Questions
        </h3>
        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: isFinished ? 'rgba(244,63,94,0.12)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Timer size={11} /> {game.remaining} left
        </span>
      </div>

      <div style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(236,72,153,0.08))', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Lightbulb size={12} /> {game.secretCategory} • Hint
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>{game.secretHint}</div>
        {!isFinished && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Ask yes/no questions • Guess anytime</div>}
      </div>

      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
        {game.asked.slice(-10).map((a,i) => (
          <div key={i} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>{a.askerName}: </span>{a.q}
            </div>
            <span style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: 11,
              fontWeight: 800,
              background: a.a==='yes' ? 'rgba(34,197,94,0.14)' : a.a==='no' ? 'rgba(244,63,94,0.12)' : 'rgba(234,179,8,0.12)',
              color: a.a==='yes' ? 'var(--presence-active)' : a.a==='no' ? '#fda4af' : 'var(--accent-amber)',
              border: '1px solid var(--border-subtle)',
              flexShrink: 0
            }}>
              {a.a.toUpperCase()}
            </span>
          </div>
        ))}
        {game.asked.length===0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No questions yet — be first!</div>}
      </div>

      {isFinished ? (
        <div style={{ padding: 12, borderRadius: 'var(--radius-lg)', background: game.winnerId ? 'rgba(34,197,94,0.12)' : 'rgba(244,63,94,0.1)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>
            {game.winnerId ? `🎉 ${game.players.find(p=>p.userId===game.winnerId)?.pseudonym || 'Someone'} won!` : `Secret was: ${game.secretWord}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{game.guessAttempts.length} guesses • {game.asked.length}/20 asked</div>
        </div>
      ) : (
        <>
          <form onSubmit={ask} style={{ display: 'flex', gap: 6 }}>
            <input value={q} onChange={e=>setQ(e.target.value)} maxLength={80} placeholder="Ask yes/no? e.g. Is it food?" style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 12 }} />
            <button type="submit" className="btn-primary" style={{ padding: '9px 12px', fontSize: 12 }}><HelpCircle size={14} /> Ask</button>
          </form>
          <form onSubmit={doGuess} style={{ display: 'flex', gap: 6 }}>
            <input value={guess} onChange={e=>setGuess(e.target.value)} maxLength={30} placeholder={`Guess the ${game.secretCategory}…`} style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 12 }} />
            <button type="submit" className="btn-secondary" style={{ padding: '9px 12px', fontSize: 12 }}>Guess</button>
          </form>
          {err && <div style={{ fontSize: 11, color: '#fda4af' }}>{err}</div>}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
            {game.guessAttempts.slice(-2).map((g,i)=> <span key={i} style={{ margin: '0 6px' }}>{g.guess} {g.correct?'✅':'❌'}</span>)}
          </div>
        </>
      )}
    </div>
  );
};
