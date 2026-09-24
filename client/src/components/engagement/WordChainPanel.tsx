import { useState, useEffect } from 'react';
import { ClockIcon, HeartIcon, PaperPlaneRightIcon, TimerIcon, TrophyIcon } from '@phosphor-icons/react';
import { Avatar } from '../ui/Avatar';
import type { WordChainState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { gameInput, submitStyle, panelTitle, timerChip, errorLine, gameWell, playerPill } from './gameStyles';

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

  const lastScorerName = game.lastScorer ? game.players.find(p => p.userId === game.lastScorer!.userId)?.pseudonym || 'Someone' : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>Word Chain</h3>
        {!finished && (
          <span style={{ ...timerChip, ...(secsLeft < 5 ? { background: 'var(--danger-fill)', color: '#FFFFFF' } : {}) }} aria-label={`Round ${game.roundNumber}, ${secsLeft} seconds left`}>
            <ClockIcon size={14} aria-hidden="true" /> Round {game.roundNumber} · {secsLeft}s
          </span>
        )}
      </div>

      {finished ? (
        <div style={gameWell}>
          <div className="type-headline" style={{ color: 'var(--text-primary)' }}>Chain complete</div>
          <div className="type-meta tnum" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {game.usedWords.length} words. Last word <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{game.currentWord}</strong>
          </div>
        </div>
      ) : (
        <div style={{ ...gameWell, textAlign: 'center' }}>
          <div className="type-meta" style={{ color: 'var(--text-secondary)' }}>
            {isMyTurn ? 'Your turn. Starts with' : `${turnPlayer?.pseudonym || 'Next'}'s turn. Starts with`}
          </div>
          <div aria-live="polite" className="type-display" style={{ fontSize: 48, lineHeight: '52px', color: 'var(--text-primary)', margin: '4px 0' }}>
            {needLetter.toUpperCase()}
          </div>
          <div className="type-meta tnum" style={{ color: 'var(--text-secondary)' }}>
            from <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{game.currentWord}</strong> · {game.usedWords.length} used
          </div>
          <div aria-hidden="true" style={{ marginTop: 12, height: 4, borderRadius: 2, background: 'var(--bg-tonal)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: secsLeft < 5 ? 'var(--status-danger)' : 'var(--ink)', transition: 'width 0.5s linear' }} />
          </div>
        </div>
      )}

      <ul aria-label="Players" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
        {game.players.map(p => {
          const turn = !finished && p.userId === game.currentTurnUserId;
          const lives = game.lives?.[p.userId] ?? 3;
          return (
            <li key={p.userId} style={playerPill(turn)} aria-current={turn || undefined}>
              <Avatar name={p.pseudonym} seed={p.userId} bg={p.avatarBg} size={24} />
              {p.userId === currentUser.id ? 'You' : p.pseudonym}
              <span className="tnum" style={{ opacity: 0.72 }}>{p.score}</span>
              <span className="tnum" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: 0.72 }} aria-label={`${lives} lives`}>
                <HeartIcon size={12} aria-hidden="true" />{lives}
              </span>
            </li>
          );
        })}
      </ul>

      {game.lastScorer && (
        <div className="type-meta" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrophyIcon size={16} aria-hidden="true" style={{ color: 'var(--success-text)', flexShrink: 0 }} />
          <span>
            {lastScorerName} scored <span className="tnum">+{game.lastScorer.points}</span> with <strong style={{ fontWeight: 600 }}>{game.lastScorer.word}</strong>
          </span>
        </div>
      )}

      {!finished && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder={isMyTurn ? `Word starting with ${needLetter.toUpperCase()}` : `Waiting for ${turnPlayer?.pseudonym || 'next player'}`}
            disabled={!isMyTurn}
            maxLength={30}
            autoCapitalize="characters"
            autoComplete="off"
            aria-label={`Word starting with ${needLetter}`}
            style={{ ...gameInput, fontWeight: 600, letterSpacing: '0.06em', opacity: isMyTurn ? 1 : 0.6 }}
          />
          <button type="submit" disabled={!isMyTurn || !input.trim()} aria-label="Submit word" className="press" style={submitStyle(isMyTurn && !!input.trim(), true)}>
            <PaperPlaneRightIcon size={20} aria-hidden="true" />
          </button>
        </form>
      )}
      {error && <div role="alert" style={errorLine}>{error}</div>}
      {game.usedWords.length > 1 && (
        <div className="type-meta" style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
          {game.usedWords.slice(-6).join(' · ')}
        </div>
      )}
      <div className="type-meta tnum" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <TimerIcon size={14} aria-hidden="true" /> {game.turnDurationSeconds}s per turn · 3 lives · {game.players.length} {game.players.length === 1 ? 'player' : 'players'}
      </div>
    </div>
  );
};
