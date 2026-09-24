import { useState, useEffect } from 'react';
import { ArrowsClockwiseIcon, ClockIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import { Avatar } from '../ui/Avatar';
import type { PromptState, ReactionState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { ReactionBar } from './ReactionBar';
import { gameInput, gameSubmit, submitStyle, panelTitle, timerChip, errorLine, gameWell } from './gameStyles';

interface Props {
  game: PromptState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
  reactions: Record<string, ReactionState>;
  onReaction: (targetId: string, emoji: string) => void;
}

const PROMPT_MAX = 40;
const secondsTo = (t: number) => Math.max(0, Math.floor((t - Date.now()) / 1000));

export const PromptWall: React.FC<Props> = ({ game, currentUser, socket, roomId, reactions, onReaction }) => {
  const [input, setInput] = useState('');
  const [secs, setSecs] = useState(() => secondsTo(game.expiresAt));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSecs(secondsTo(game.expiresAt)), 700);
    return () => clearInterval(id);
  }, [game.expiresAt, game.currentPrompt.id]);

  useEffect(() => {
    if (!socket) return;
    const h = (p: { error?: string }) => setErr(p?.error || 'Try again.');
    socket.on('game_error', h);
    return () => { socket.off('game_error', h); };
  }, [socket]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('prompt_submit', { roomId, user: currentUser, content: input.trim() });
    setInput(''); setErr(null);
  };

  const rotate = () => {
    if (!socket) return;
    socket.emit('prompt_rotate', { roomId });
  };

  const isExpired = game.status === 'finished' || secs <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={panelTitle}>Prompt Wall</h3>
        <span style={timerChip}>
          <ClockIcon size={14} aria-hidden="true" /> {isExpired ? 'Closed' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
      </div>

      <div style={gameWell}>
        <div className="type-meta" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{game.currentPrompt.category.replace(/_/g, ' ')}</div>
        <div className="type-headline" style={{ color: 'var(--text-primary)' }}>{game.currentPrompt.text}</div>
        {game.currentPrompt.textHi && <div lang="hi" className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{game.currentPrompt.textHi}</div>}
      </div>

      {!isExpired && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={PROMPT_MAX}
              aria-label={`Your answer, up to ${PROMPT_MAX} characters`}
              placeholder="Your take / अपना जवाब"
              style={{ ...gameInput, paddingRight: 48 }}
            />
            <span aria-hidden="true" className="type-meta tnum" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 560, color: input.length >= PROMPT_MAX ? 'var(--danger-text)' : 'var(--text-muted)' }}>
              {PROMPT_MAX - input.length}
            </span>
          </div>
          <button type="submit" disabled={!input.trim()} aria-label="Post answer" className="press" style={submitStyle(!!input.trim(), true)}>
            <PaperPlaneRightIcon size={20} aria-hidden="true" />
          </button>
        </form>
      )}
      {err && <div role="alert" style={errorLine}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>
          {game.submissions.length} {game.submissions.length === 1 ? 'answer' : 'answers'} · {game.players.length} joined
        </span>
        <button
          type="button"
          onClick={rotate}
          className="btn-tonal press"
          style={{ ...gameSubmit, minHeight: 40, fontSize: 14 }}
        >
          <ArrowsClockwiseIcon size={16} aria-hidden="true" /> New prompt
        </button>
      </div>

      <ul aria-label="Answers" style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
        {[...game.submissions].reverse().map((s, i) => {
          const rs = reactions[s.id];
          const counts = rs?.counts || s.reactions || {};
          const my = Object.entries(rs?.users || s.reactedUsers || {})
            .filter(([, ids]) => ids.includes(currentUser.id))
            .map(([e]) => e);
          const mine = s.userId === currentUser.id;
          return (
            <li key={s.id} style={{ padding: '12px 0 4px', borderTop: i ? '1px solid var(--border-subtle)' : undefined, display: 'flex', gap: 10 }}>
              <Avatar name={s.pseudonym} seed={s.userId} bg={s.avatarBg} size={32} you={mine} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="type-label" style={{ color: 'var(--text-primary)' }}>{mine ? 'You' : s.pseudonym}</span>
                  <span className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="type-body" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{s.content}</div>
                <div style={{ marginTop: 6 }}>
                  <ReactionBar targetId={s.id} targetType="submission" roomId={roomId} counts={counts} myReactions={my} onToggle={(e) => onReaction(s.id, e)} compact />
                </div>
              </div>
            </li>
          );
        })}
        {game.submissions.length === 0 && (
          <li className="type-meta" style={{ padding: '8px 0', color: 'var(--text-muted)' }}>
            No answers yet. Be the first.
          </li>
        )}
      </ul>
    </div>
  );
};
