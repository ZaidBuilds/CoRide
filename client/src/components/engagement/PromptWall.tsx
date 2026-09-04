import { useState, useEffect } from 'react';
import { Clock, Send } from 'lucide-react';
import type { PromptState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';
import { ReactionBar } from './ReactionBar';

interface Props {
  game: PromptState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
  reactions: Record<string, any>;
  onReaction: (targetId: string, emoji: string) => void;
}

export const PromptWall: React.FC<Props> = ({ game, currentUser, socket, roomId, reactions, onReaction }) => {
  const [input, setInput] = useState('');
  const [secs, setSecs] = useState(Math.max(0, Math.floor((game.expiresAt - Date.now())/1000)));
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, Math.floor((game.expiresAt - Date.now())/1000))), 700);
    return () => clearInterval(id);
  }, [game.expiresAt, game.currentPrompt.id]);

  useEffect(() => {
    if (!socket) return;
    const h = (p:any)=> setErr(p.error);
    socket.on('game_error', h);
    return ()=> { socket.off('game_error', h); };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>💬 Prompt Wall</h3>
        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: isExpired ? 'rgba(244,63,94,0.12)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {isExpired ? 'Closed' : `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`}
        </span>
      </div>

      <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(99,102,241,0.08))', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <div style={{ fontSize: 28 }}>{game.currentPrompt.emoji}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6, lineHeight: 1.3 }}>{game.currentPrompt.text}</div>
        {game.currentPrompt.textHi && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{game.currentPrompt.textHi}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{game.currentPrompt.category.replace('_',' ')}</div>
      </div>

      {!isExpired && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} maxLength={40} aria-label="Your answer" placeholder="Your take in 40 chars… / अपना जवाब" style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 16 }} />
          <button type="submit" aria-label="Post answer" className="btn-primary" style={{ padding: '10px 14px' }}><Send size={14} /></button>
        </form>
      )}
      {err && <div role="alert" style={{ fontSize: 11, color: 'var(--accent-rose-text)' }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{game.submissions.length} sharings • {game.players.length} joined</span>
        <button onClick={rotate} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}>↻ New prompt</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
        {[...game.submissions].reverse().map(s => {
          const rs = reactions[s.id] || { counts: s.reactions || {}, total: 0 };
          const my = Object.entries(rs.users || {}).filter(([_, ids]: any) => (ids as string[]).includes(currentUser.id)).map(([e])=>e);
          return (
            <div key={s.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: s.userId===currentUser.id ? 'rgba(99,102,241,0.10)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: s.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 800 }}>{s.pseudonym[0]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.pseudonym}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>{s.content}</div>
              <ReactionBar targetId={s.id} targetType="submission" roomId={roomId} counts={rs.counts} myReactions={my} onToggle={(e)=>onReaction(s.id, e)} compact />
            </div>
          );
        })}
        {game.submissions.length===0 && <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>No sharings yet — be first! 🚀</div>}
      </div>
    </div>
  );
};
