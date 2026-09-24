import { useEffect, useState } from 'react';
import { Gamepad2, Users, Zap, Timer, Trophy, LogOut, RotateCcw } from 'lucide-react';
import type { EngagementSnapshot, GameType } from '../../types/engagement';
import type { UserProfile, ContextRoom } from '../../types';
import type { Socket } from 'socket.io-client';
import { WordChainPanel } from './WordChainPanel';
import { TwentyQuestionsPanel } from './TwentyQuestionsPanel';
import { TriviaPanel } from './TriviaPanel';
import { PromptWall } from './PromptWall';
import { ReactionBar } from './ReactionBar';

type GameCard = { type: GameType; label: string; hindi: string; icon: string; desc: string; time: string; players: string; color: string };

// Line colours double as game accents — they're defined for both themes.
const CARDS: GameCard[] = [
  { type: 'word_chain', label: 'Word Chain', hindi: 'शब्द श्रृंखला', icon: '🔤', desc: 'Last letter → new word', time: '2–4 min', players: '2–8', color: 'var(--line-green)' },
  { type: 'twenty_q', label: '20 Questions', hindi: '20 सवाल', icon: '❓', desc: 'Guess the secret', time: '3–5 min', players: '2–6', color: 'var(--line-yellow)' },
  { type: 'trivia', label: 'Fast Trivia', hindi: 'त्वरित प्रश्न', icon: '⚡', desc: '5 questions · 15s each', time: '2 min', players: '1–8', color: 'var(--line-violet)' },
  { type: 'prompt', label: 'Prompt Wall', hindi: 'विचार दीवार', icon: '💬', desc: 'Share in 40 characters', time: '4 min', players: '2+', color: 'var(--line-pink)' }
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
    const t = setTimeout(() => fail('No response — check your connection and try again.'), START_TIMEOUT_MS);
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

  return (
    <section aria-label="Room activities" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Leaderboard strip */}
      {snapshot && snapshot.leaderboard.length > 0 && (
        <div
          aria-label="Top players in this room"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Trophy size={13} aria-hidden="true" /> Top
          </span>
          {snapshot.leaderboard.slice(0, 5).map(p => (
            <span
              key={p.userId}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)',
                border: `1px solid ${p.userId === currentUser.id ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-primary)'
              }}
            >
              <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: p.avatarBg, display: 'inline-block' }} />
              {p.pseudonym} <span style={{ color: 'var(--text-muted)' }}>{p.score}</span>
            </span>
          ))}
        </div>
      )}

      {/* Quick reaction to the room */}
      <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Zap size={14} aria-hidden="true" style={{ color: 'var(--status-warning)' }} /> React to the room
        </div>
        <ReactionBar
          targetId={room.id}
          targetType="profile"
          roomId={room.id}
          counts={snapshot?.reactions[room.id]?.counts || {}}
          myReactions={myRoomReactions}
          onToggle={(emoji) => onReaction(room.id, emoji, 'profile', room.id)}
        />
        {snapshot?.activityFeed.slice(-3).reverse().map(a => (
          <div key={a.id} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>• {a.text}</div>
        ))}
      </div>

      {!showingGame ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              <Gamepad2 size={17} aria-hidden="true" style={{ color: 'var(--accent-text)' }} /> Quick games
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{room.userCount} in room</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '-6px 0 0' }}>
            Ice-breakers for when the chat is quiet. Learn in seconds, done in a few minutes.
          </p>

          {!connected && (
            <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              Games need a live connection. Reconnecting…
            </div>
          )}
          {startError && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--status-danger)', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--status-danger)' }}>
              {startError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CARDS.map(c => {
              const isStarting = starting === c.type;
              return (
                <button
                  key={c.type}
                  onClick={() => create(c.type)}
                  disabled={!connected || !!starting}
                  aria-label={`Start ${c.label}: ${c.desc}, ${c.players} players, about ${c.time}`}
                  aria-busy={isStarting || undefined}
                  className="press"
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    minHeight: 132,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    cursor: !connected || starting ? 'default' : 'pointer',
                    opacity: !connected || (starting && !isStarting) ? 0.55 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color }} />
                  <span aria-hidden="true" style={{ fontSize: 22 }}>{c.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{isStarting ? 'Starting…' : c.label}</span>
                  <span lang="hi" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.hindi}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{c.desc}</span>
                  <span aria-hidden="true" style={{ display: 'flex', gap: 8, marginTop: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Users size={11} /> {c.players}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Timer size={11} /> {c.time}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ padding: 14, borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden="true"
                style={{ width: 7, height: 7, borderRadius: '50%', background: active.status === 'finished' ? 'var(--presence-other)' : 'var(--presence-active)' }}
              />
              {active.status === 'finished' ? 'Finished' : 'Live'} · {active.players.length} playing
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {active.status === 'finished' ? (
                <button onClick={() => setDismissedGameId(active.gameId)} className="btn-primary press" style={gameBtn}>
                  <RotateCcw size={15} aria-hidden="true" /> New game
                </button>
              ) : (
                <>
                  {!isInGame && (
                    <button onClick={join} disabled={!connected} className="btn-primary press" style={gameBtn}>
                      Join
                    </button>
                  )}
                  {isInGame && (
                    <button onClick={leave} className="btn-secondary press" style={gameBtn} aria-label={`Leave ${GAME_LABEL[active.type]}`}>
                      <LogOut size={15} aria-hidden="true" /> Leave
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {active.type === 'word_chain' && <WordChainPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'twenty_q' && <TwentyQuestionsPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'trivia' && <TriviaPanel game={active} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'prompt' && <PromptWall game={active} currentUser={currentUser} socket={socket} roomId={room.id} reactions={snapshot?.reactions || {}} onReaction={(tid, emoji) => onReaction(tid, emoji, 'submission', room.id)} />}
        </div>
      )}
    </section>
  );
};

const gameBtn: React.CSSProperties = {
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 'var(--radius-full)',
  fontWeight: 800,
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer'
};
