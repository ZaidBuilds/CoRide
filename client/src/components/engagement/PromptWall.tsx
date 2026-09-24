import { useState, useEffect } from 'react';
import { Clock, Send, RefreshCw } from 'lucide-react';
import type { PromptState, ReactionState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { ReactionBar } from './ReactionBar';
import { gameInput, gameSubmit, panelTitle, timerChip, errorLine } from './gameStyles';

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
        <h3 style={panelTitle}>💬 Prompt Wall</h3>
        <span style={timerChip}>
          <Clock size={12} aria-hidden="true" /> {isExpired ? 'Closed' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
      </div>

      <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-purple)', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontSize: 28 }}>{game.currentPrompt.emoji}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1.35 }}>{game.currentPrompt.text}</div>
        {game.currentPrompt.textHi && <div lang="hi" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{game.currentPrompt.textHi}</div>}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{game.currentPrompt.category.replace(/_/g, ' ')}</div>
      </div>

      {!isExpired && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={PROMPT_MAX}
              aria-label={`Your answer, up to ${PROMPT_MAX} characters`}
              placeholder="Your take… / अपना जवाब"
              style={{ ...gameInput, paddingRight: 44 }}
            />
            <span aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: input.length >= PROMPT_MAX ? 'var(--status-danger)' : 'var(--text-muted)' }}>
              {PROMPT_MAX - input.length}
            </span>
          </div>
          <button type="submit" disabled={!input.trim()} aria-label="Post answer" className="btn-primary press" style={gameSubmit}>
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      )}
      {err && <div role="alert" style={errorLine}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
          {game.submissions.length} {game.submissions.length === 1 ? 'answer' : 'answers'} · {game.players.length} joined
        </span>
        <button
          onClick={rotate}
          className="btn-secondary press"
          style={{ ...gameSubmit, fontSize: 13, borderRadius: 'var(--radius-full)' }}
        >
          <RefreshCw size={14} aria-hidden="true" /> New prompt
        </button>
      </div>

      <ul aria-label="Answers" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
        {[...game.submissions].reverse().map(s => {
          const rs = reactions[s.id];
          const counts = rs?.counts || s.reactions || {};
          const my = Object.entries(rs?.users || s.reactedUsers || {})
            .filter(([, ids]) => ids.includes(currentUser.id))
            .map(([e]) => e);
          return (
            <li key={s.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: `1px solid ${s.userId === currentUser.id ? 'var(--border-purple)' : 'var(--border-subtle)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, background: s.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>{s.pseudonym[0]}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.userId === currentUser.id ? 'You' : s.pseudonym}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{s.content}</div>
              <ReactionBar targetId={s.id} targetType="submission" roomId={roomId} counts={counts} myReactions={my} onToggle={(e) => onReaction(s.id, e)} compact />
            </li>
          );
        })}
        {game.submissions.length === 0 && (
          <li style={{ textAlign: 'center', padding: 16, fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            No answers yet — be the first.
          </li>
        )}
      </ul>
    </div>
  );
};
