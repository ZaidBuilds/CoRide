import { useState, useEffect } from 'react';
import { Send, Timer, Trophy, Clock } from 'lucide-react';
import type { WordChainState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';

interface Props {
  game: WordChainState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

export const WordChainPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState(game.turnDurationSeconds);

  const isMyTurn = game.currentTurnUserId === currentUser.id;
  const turnPlayer = game.players.find(p => p.userId === game.currentTurnUserId);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - game.turnStartedAt) / 1000;
      setSecsLeft(Math.max(0, game.turnDurationSeconds - Math.floor(elapsed)));
    }, 500);
    return () => clearInterval(id);
  }, [game.turnStartedAt, game.turnDurationSeconds, game.currentWord]);

  useEffect(() => {
    if (!socket) return;
    const onErr = (p: any) => setError(p.error);
    socket.on('game_error', onErr);
    return () => { socket.off('game_error', onErr); };
  }, [socket]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('word_chain_submit', { roomId, userId: currentUser.id, word: input.trim() });
    setInput('');
    setError(null);
  };

  const needLetter = game.currentWord.charAt(game.currentWord.length - 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔤 Word Chain <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>— last letter → new word</span>
        </h3>
        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} /> {game.roundNumber} • {secsLeft}s
        </span>
      </div>

      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(99,102,241,0.08))',
        border: '1px solid var(--border-subtle)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {isMyTurn ? 'Your turn — starts with' : `${turnPlayer?.pseudonym || 'Next'}'s turn — starts with`}
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.08em', margin: '6px 0' }}>
          {needLetter.toUpperCase()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          from <strong style={{ color: 'var(--text-primary)' }}>{game.currentWord}</strong> • used {game.usedWords.length}
        </div>
        <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
          <div style={{ width: `${(secsLeft / game.turnDurationSeconds) * 100}%`, height: '100%', background: secsLeft < 5 ? 'var(--accent-rose)' : 'var(--accent-emerald)', transition: 'width 0.5s linear' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {game.players.map(p => (
          <div key={p.userId} style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-full)',
            background: p.userId === game.currentTurnUserId ? 'rgba(99,102,241,0.18)' : 'var(--bg-surface)',
            border: `1px solid ${p.userId === game.currentTurnUserId ? 'rgba(99,102,241,0.35)' : 'var(--border-subtle)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: p.userId === game.currentTurnUserId ? 'var(--accent-indigo)' : 'var(--text-secondary)'
          }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: p.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>{p.pseudonym[0]}</span>
            {p.pseudonym}
            <span style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 6px', borderRadius: 999, fontSize: 11 }}>{p.score}</span>
            <span style={{ opacity: 0.7 }}>♥{(game as any).lives[p.userId] ?? 3}</span>
          </div>
        ))}
      </div>

      {game.lastScorer && (
        <div style={{ fontSize: 11, color: 'var(--presence-active)', background: 'rgba(34,197,94,0.08)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.22)' }}>
          <Trophy size={12} style={{ display: 'inline', marginRight: 4 }} />
          {game.players.find(p=>p.userId===game.lastScorer!.userId)?.pseudonym} scored +{game.lastScorer.points} with <strong>{game.lastScorer.word}</strong>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          placeholder={isMyTurn ? `Word starting with ${needLetter}…` : `Waiting for ${turnPlayer?.pseudonym}…`}
          disabled={!isMyTurn}
          aria-label={`Word starting with ${needLetter}`}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: isMyTurn ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.06em',
            opacity: isMyTurn ? 1 : 0.6
          }}
        />
        <button type="submit" disabled={!isMyTurn || !input.trim()} aria-label="Submit word" className="btn-primary" style={{ padding: '10px 16px' }}>
          <Send size={16} />
        </button>
      </form>
      {error && <div role="alert" style={{ fontSize: 11, color: 'var(--accent-rose-text)', background: 'rgba(244,63,94,0.08)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(244,63,94,0.2)' }}>{error}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        {game.usedWords.slice(-6).join(' → ')}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
        <Timer size={10} /> 15s per turn • 3 lives • {game.players.length} players
      </div>
    </div>
  );
};
