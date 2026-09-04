import { Gamepad2, Sparkles, Users, Zap } from 'lucide-react';
import type { EngagementSnapshot } from '../../types/engagement';
import type { UserProfile, ContextRoom } from '../../types';
import type { Socket } from 'socket.io-client';
import { WordChainPanel } from './WordChainPanel';
import { TwentyQuestionsPanel } from './TwentyQuestionsPanel';
import { TriviaPanel } from './TriviaPanel';
import { PromptWall } from './PromptWall';
import { ReactionBar } from './ReactionBar';

type GameCard = { type: 'word_chain' | 'twenty_q' | 'trivia' | 'prompt'; label: string; hindi: string; icon: any; desc: string; time: string; players: string; color: string };

const CARDS: GameCard[] = [
  { type: 'word_chain', label: 'Word Chain', hindi: 'शब्द श्रृंखला', icon: '🔤', desc: 'Last letter → new word', time: '2-4m', players: '2-8', color: 'var(--accent-emerald)' },
  { type: 'twenty_q', label: '20 Questions', hindi: '20 सवाल', icon: '❓', desc: 'Guess the secret', time: '3-5m', players: '2-6', color: 'var(--accent-amber)' },
  { type: 'trivia', label: 'Fast Trivia', hindi: 'त्वरित प्रश्न', icon: '⚡', desc: '5 Qs • 15s each', time: '2m', players: '1-8', color: 'var(--accent-violet)' },
  { type: 'prompt', label: 'Prompt Wall', hindi: 'विचार दीवार', icon: '💬', desc: 'Share in 40 chars', time: '4m', players: '2+', color: 'var(--accent-pink)' }
];

interface Props {
  room: ContextRoom;
  snapshot: EngagementSnapshot | null;
  currentUser: UserProfile;
  socket: Socket | null;
  onReaction: (targetId: string, emoji: string, targetType: 'message' | 'profile' | 'submission', roomId?: string) => void;
}

export const EngagementHub: React.FC<Props> = ({ room, snapshot, currentUser, socket, onReaction }) => {
  const active = snapshot?.activeGame || null;
  // const [filter] kept for future
  // const [filter] = useState<'all'|'active'>('all');

  const create = (type: GameCard['type']) => {
    if (!socket) return;
    socket.emit('create_game', { roomId: room.id, type, user: currentUser });
  };
  const join = () => {
    if (!socket || !active) return;
    socket.emit('join_game', { roomId: room.id, user: currentUser });
  };
  const isInGame = active?.players.some(p => p.userId === currentUser.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Activity + leaderboard strip */}
      {snapshot && snapshot.leaderboard.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><TrophyMini /> Top</span>
          {snapshot.leaderboard.slice(0,5).map(p => (
            <span key={p.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: p.userId===currentUser.id ? 'rgba(99,102,241,0.18)' : 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: p.avatarBg, display: 'inline-block' }} />{p.pseudonym} {p.score}
            </span>
          ))}
        </div>
      )}

      {/* Quick reaction to room — shared activity */}
      <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Zap size={12} style={{ color: 'var(--accent-amber)' }} /> Quick react to room
        </div>
        <ReactionBar
          targetId={room.id}
          targetType="profile"
          roomId={room.id}
          counts={snapshot?.reactions[room.id]?.counts || {}}
          myReactions={Object.entries(snapshot?.reactions[room.id]?.users || {}).filter(([_,ids]:any)=> (ids as string[]).includes(currentUser.id)).map(([e])=>e)}
          onToggle={(emoji)=> onReaction(room.id, emoji, 'profile', room.id)}
        />
        {snapshot?.activityFeed.slice(0,3).map(a => (
          <div key={a.id} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>• {a.text}</div>
        ))}
      </div>

      {!active ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gamepad2 size={16} style={{ color: 'var(--accent-purple-text)' }} /> Games
              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(99,102,241,0.12)', color: 'var(--accent-purple-text)', border: '1px solid rgba(99,102,241,0.2)' }}>retention support</span>
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{room.userCount} in room</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}> &lt;30s to learn • &lt;5m per session • Tap to start — works with 2+ </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CARDS.map(c => (
              <button
                key={c.type}
                onClick={() => create(c.type)}
                style={{
                  textAlign: 'left',
                  padding: 12,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface)',
                  border: `1px solid ${c.color}22`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color, opacity: 0.9 }} />
                <div style={{ fontSize: 22 }}>{c.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.hindi}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{c.desc}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Users size={10}/> {c.players}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TimerMini/> {c.time}</span>
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
            <Sparkles size={14} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: 1 }} />
            <span><strong>Tip:</strong> Games are ice-breakers — not the product. Best when chat feels awkward. 2 min is enough.</span>
          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ padding: 14, borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--presence-active)', boxShadow: '0 0 6px var(--presence-active)' }} />
              {active.type.replace('_',' ')} • {active.players.length} playing
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {!isInGame && <button onClick={join} style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)', background: 'var(--accent-indigo)', color: 'white', border: 'none', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Join</button>}
              <button
                onClick={() => { if (socket) socket.emit('leave_game', { roomId: room.id, userId: currentUser.id }); }}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-full)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11 }}
              >
                Leave
              </button>
            </div>
          </div>

          {active.type === 'word_chain' && <WordChainPanel game={active as any} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'twenty_q' && <TwentyQuestionsPanel game={active as any} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'trivia' && <TriviaPanel game={active as any} currentUser={currentUser} socket={socket} roomId={room.id} />}
          {active.type === 'prompt' && <PromptWall game={active as any} currentUser={currentUser} socket={socket} roomId={room.id} reactions={snapshot?.reactions || {}} onReaction={(tid, emoji)=> onReaction(tid, emoji, 'submission', room.id)} />}
        </div>
      )}
    </div>
  );
};

function TimerMini(){ return <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />; }
function TrophyMini(){ return <span>🏆</span>; }
