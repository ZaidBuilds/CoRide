import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowCounterClockwiseIcon, ChatTextIcon, LightningIcon, QuestionIcon, SignOutIcon, TextAaIcon, TimerIcon, TrophyIcon, UsersIcon
} from '@phosphor-icons/react';
import type { EngagementSnapshot, GameType } from '../../types/engagement';
import type { UserProfile, ContextRoom } from '../../types';
import type { Socket } from 'socket.io-client';
import { WordChainPanel } from './WordChainPanel';
import { TwentyQuestionsPanel } from './TwentyQuestionsPanel';
import { TriviaPanel } from './TriviaPanel';
import { PromptWall } from './PromptWall';
import { ReactionBar } from './ReactionBar';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type GameCard = { type: GameType; label: string; hindi: string; icon: ReactNode; desc: string; time: string; players: string };

const CARDS: GameCard[] = [
  { type: 'word_chain', label: 'Word Chain', hindi: 'शब्द श्रृंखला', icon: <TextAaIcon size={22} />, desc: 'Last letter starts the next word', time: '2–4 min', players: '2–8' },
  { type: 'twenty_q', label: '20 Questions', hindi: '20 सवाल', icon: <QuestionIcon size={22} />, desc: 'Yes or no questions to guess the secret', time: '3–5 min', players: '2–6' },
  { type: 'trivia', label: 'Fast Trivia', hindi: 'त्वरित प्रश्न', icon: <LightningIcon size={22} />, desc: '5 questions, 15s each', time: '2 min', players: '1–8' },
  { type: 'prompt', label: 'Prompt Wall', hindi: 'विचार दीवार', icon: <ChatTextIcon size={22} />, desc: 'Answer a prompt in 40 characters', time: '4 min', players: '2+' }
];

const GAME_LABEL: Record<GameType, string> = {
  word_chain: 'Word Chain',
  twenty_q: '20 Questions',
  trivia: 'Fast Trivia',
  prompt: 'Prompt Wall'
};

/** No engagement_updated within this window after "start" → show an error. */
const START_TIMEOUT_MS = 6000;

interface Props {
  room: ContextRoom;
  snapshot: EngagementSnapshot | null;
  currentUser: UserProfile;
  socket: Socket | null;
  onReaction: (targetId: string, emoji: string, targetType: 'message' | 'profile' | 'submission', roomId?: string) => void;
}

export const EngagementHub: React.FC<Props> = ({ room, snapshot, currentUser, socket, onReaction }) => {
  const active = snapshot?.activeGame || null;
  const [starting, setStarting] = useState<GameType | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // After a game finishes, the server keeps its final state around for a
  // while; this lets the player go back to the picker straight away.
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(null);
  const connected = !!socket?.connected;

  const showingGame = active && !(active.status === 'finished' && active.gameId === dismissedGameId);
  const isInGame = !!active?.players.some(p => p.userId === currentUser.id);

  // Resolve a pending "start": success = a game shows up; failure = the
  // server replies with an error, or nothing arrives in time.
  const [prevActiveId, setPrevActiveId] = useState(active?.gameId);
  if (active?.gameId !== prevActiveId) {
    setPrevActiveId(active?.gameId);
    if (starting && active && active.status !== 'finished') setStarting(null);
  }
  useEffect(() => {
    if (!starting || !socket) return;
    const fail = (msg: string) => { setStarting(null); setStartError(msg); };
    const onErr = (p: { error?: string }) => fail(p?.error || "Couldn't start the game.");
    const onMod = (p: { message?: string }) => fail(p?.message || 'Slow down a little and try again.');
    socket.on('error_message', onErr);
    socket.on('moderation_action', onMod);
    const t = setTimeout(() => fail('No response. Check your connection and try again.'), START_TIMEOUT_MS);
    return () => {
      clearTimeout(t);
      socket.off('error_message', onErr);
      socket.off('moderation_action', onMod);
    };
  }, [starting, socket]);

  const create = (type: GameType) => {
    if (!socket || !connected || starting) return;
    setStartError(null);
    setStarting(type);
    socket.emit('create_game', { roomId: room.id, type, user: currentUser });
  };
  const join = () => {
    if (!socket || !active) return;
    socket.emit('join_game', { roomId: room.id, user: currentUser });
  };
  const leave = () => {
    if (!socket) return;
    socket.emit('leave_game', { roomId: room.id, userId: currentUser.id });
  };

  const myRoomReactions = Object.entries(snapshot?.reactions[room.id]?.users || {})
    .filter(([, ids]) => ids.includes(currentUser.id))
    .map(([e]) => e);

  const liveGame = active && active.status !== 'finished';

  return (
    <section aria-label="Room activities" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Leaderboard strip */}
      {snapshot && snapshot.leaderboard.length > 0 && (
        <div
          aria-label="Top players in this room"
          role="group"
          style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}
        >
          <span className="type-meta" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <TrophyIcon size={16} aria-hidden="true" /> Top
          </span>
          {snapshot.leaderboard.slice(0, 5).map(p => {
            const me = p.userId === currentUser.id;
            return (
              <span
                key={p.userId}
                className="type-label"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 4px', borderRadius: 'var(--radius-pill)',
                  background: me ? 'var(--ink)' : 'var(--bg-surface)',
                  color: me ? 'var(--ink-inverse)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap', flexShrink: 0
                }}
              >
                <Avatar name={p.pseudonym} seed={p.userId} bg={p.avatarBg} size={24} />
                {me ? 'You' : p.pseudonym}
                <span className="tnum" style={{ opacity: 0.72 }}>{p.score}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Quick reaction to the room */}
      <Card padding="12px 16px">
        <div className="type-label" style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
          React to the room
        </div>
        <ReactionBar
          targetId={room.id}
          targetType="profile"
          roomId={room.id}
          counts={snapshot?.reactions[room.id]?.counts || {}}
          myReactions={myRoomReactions}
          onToggle={(emoji) => onReaction(room.id, emoji, 'profile', room.id)}
        />
        {snapshot && snapshot.activityFeed.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: '8px 0 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {snapshot.activityFeed.slice(-3).reverse().map(a => (
              <li key={a.id} className="type-meta" style={{ color: 'var(--text-muted)' }}>{a.text}</li>
            ))}
          </ul>
        )}
      </Card>

      {!showingGame ? (
        <>
          <p className="type-meta" style={{ color: 'var(--text-secondary)' }}>
            Ice-breakers for a quiet ride. Learn in seconds, done in a few minutes.
            {room.userCount > 0 && <span className="tnum"> {room.userCount} here now.</span>}
          </p>

          {!connected && (
            <div role="status" className="type-meta" style={{ color: 'var(--text-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', boxShadow: 'inset 4px 0 0 var(--status-warn)' }}>
              Games need a live connection. Reconnecting.
            </div>
          )}
          {startError && (
            <div role="alert" className="type-meta" style={{ color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', boxShadow: 'inset 4px 0 0 var(--status-danger)' }}>
              {startError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CARDS.map(c => {
              const isStarting = starting === c.type;
              const inert = !connected || !!starting;
              return (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => create(c.type)}
                  disabled={inert}
                  aria-label={`Start ${c.label}: ${c.desc}, ${c.players} players, about ${c.time}`}
                  aria-busy={isStarting || undefined}
                  className="card pressable"
                  style={{
                    textAlign: 'left',
                    minHeight: 148,
                    border: 'none',
                    color: 'var(--text-primary)',
                    font: 'inherit',
                    cursor: inert ? 'default' : 'pointer',
                    opacity: !connected || (starting && !isStarting) ? 0.5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-squircle)', marginBottom: 10,
                      background: isStarting ? 'var(--ink)' : 'var(--bg-tonal)',
                      color: isStarting ? 'var(--ink-inverse)' : 'var(--text-primary)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {c.icon}
                  </span>
                  <span className="type-label" style={{ fontSize: 15 }}>{isStarting ? 'Starting' : c.label}</span>
                  <span lang="hi" className="type-meta" style={{ color: 'var(--text-muted)' }}>{c.hindi}</span>
                  <span className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{c.desc}</span>
                  <span aria-hidden="true" className="type-meta tnum" style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UsersIcon size={14} /> {c.players}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TimerIcon size={14} /> {c.time}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <span className="type-meta tnum" style={{ fontWeight: 560, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {liveGame
                ? <span className="live-dot pulse" aria-hidden="true" />
                : <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' }} />}
              {liveGame ? 'Live' : 'Finished'} · {active.players.length} playing
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {active.status === 'finished' ? (
                <Button type="button" variant="secondary" size="sm" icon={<ArrowCounterClockwiseIcon size={18} />} onClick={() => setDismissedGameId(active.gameId)}>
                  New game
                </Button>
              ) : (
                <>
                  {!isInGame && (
                    <Button type="button" variant="secondary" size="sm" onClick={join} disabled={!connected}>
                      Join
                    </Button>
                  )}
                  {isInGame && (
                    <Button type="button" variant="tonal" size="sm" icon={<SignOutIcon size={18} />} onClick={leave} aria-label={`Leave ${GAME_LABEL[active.type]}`}>
                      Leave
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {active.type === 'word_chain' && <WordChainPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'twenty_q' && <TwentyQuestionsPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'trivia' && <TriviaPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'prompt' && <PromptWall game={active} currentUser={currentUser} socket={socket} roomId={room.id} reactions={snapshot?.reactions || {}} onReaction={(tid, emoji) => onReaction(tid, emoji, 'submission', room.id)} />}
        </Card>
      )}
    </section>
  );
};
