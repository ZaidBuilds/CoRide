import { useState, useEffect } from 'react';
import { Send, Timer, Trophy, Clock, Heart } from 'lucide-react';
import type { WordChainState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { gameInput, gameSubmit, panelTitle, timerChip, errorLine } from './gameStyles';

interface Props {
  game: WordChainState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

function secondsLeft(game: WordChainState): number {
  const elapsed = (Date.now() - game.turnStartedAt) / 1000;
  return Math.max(0, game.turnDurationSeconds - Math.floor(elapsed));
}

export const WordChainPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState(() => secondsLeft(game));

  const isMyTurn = game.currentTurnUserId === currentUser.id;
  const turnPlayer = game.players.find(p => p.userId === game.currentTurnUserId);
  const finished = game.status === 'finished';

  useEffect(() => {
    const id = setInterval(() => setSecsLeft(secondsLeft(game)), 500);
    return () => clearInterval(id);
  }, [game]);

  useEffect(() => {
    if (!socket) return;
    const onErr = (p: { error?: string }) => setError(p?.error || 'Try another word.');
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
  const pct = game.turnDurationSeconds ? (secsLeft / game.turnDurationSeconds) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>🔤 Word Chain</h3>
        {!finished && (
          <span style={timerChip} aria-label={`Round ${game.roundNumber}, ${secsLeft} seconds left`}>
            <Clock size={12} aria-hidden="true" /> Round {game.roundNumber} · {secsLeft}s
          </span>
        )}
      </div>

      {finished ? (
        <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>🏁 Chain complete</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {game.usedWords.length} words · last word <strong style={{ color: 'var(--text-primary)' }}>{game.currentWord}</strong>
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {isMyTurn ? 'Your turn — starts with' : `${turnPlayer?.pseudonym || 'Next'}'s turn — starts with`}
          </div>
          <div aria-live="polite" style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.08em', margin: '6px 0' }}>
            {needLetter.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            from <strong style={{ color: 'var(--text-primary)' }}>{game.currentWord}</strong> · {game.usedWords.length} used
          </div>
          <div aria-hidden="true" style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: secsLeft < 5 ? 'var(--status-danger)' : 'var(--status-success)', transition: 'width 0.5s linear' }} />
          </div>
        </div>
      )}

      <ul aria-label="Players" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
        {game.players.map(p => {
          const turn = !finished && p.userId === game.currentTurnUserId;
          return (
            <li key={p.userId} style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface)',
              border: `1px solid ${turn ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: turn ? 'var(--accent-text)' : 'var(--text-secondary)'
            }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 6, background: p.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>{p.pseudonym[0]}</span>
              {p.pseudonym}
              <span style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 999, fontSize: 11 }}>{p.score}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }} aria-label={`${game.lives?.[p.userId] ?? 3} lives`}>
                <Heart size={11} aria-hidden="true" />{game.lives?.[p.userId] ?? 3}
              </span>
            </li>
          );
        })}
      </ul>

      {game.lastScorer && (
        <div style={{ fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--status-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={14} aria-hidden="true" style={{ color: 'var(--status-success)', flexShrink: 0 }} />
          <span>
            {game.players.find(p => p.userId === game.lastScorer!.userId)?.pseudonym || 'Someone'} scored +{game.lastScorer.points} with <strong>{game.lastScorer.word}</strong>
          </span>
        </div>
      )}

      {!finished && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder={isMyTurn ? `Word starting with ${needLetter.toUpperCase()}…` : `Waiting for ${turnPlayer?.pseudonym || 'next player'}…`}
            disabled={!isMyTurn}
            maxLength={30}
            autoCapitalize="characters"
            autoComplete="off"
            aria-label={`Word starting with ${needLetter}`}
            style={{ ...gameInput, fontWeight: 700, letterSpacing: '0.06em', opacity: isMyTurn ? 1 : 0.6 }}
          />
          <button type="submit" disabled={!isMyTurn || !input.trim()} aria-label="Submit word" className="btn-primary press" style={gameSubmit}>
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      )}
      {error && <div role="alert" style={errorLine}>{error}</div>}
      {game.usedWords.length > 1 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', overflowWrap: 'anywhere' }}>
          {game.usedWords.slice(-6).join(' → ')}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
        <Timer size={11} aria-hidden="true" /> {game.turnDurationSeconds}s per turn · 3 lives · {game.players.length} {game.players.length === 1 ? 'player' : 'players'}
      </div>
    </div>
  );
};
