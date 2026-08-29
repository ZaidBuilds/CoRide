import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ArrowLeft, Shield, UserCheck } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { ContextRoom, UserProfile } from '../types';
import { ReactionBar } from './engagement/ReactionBar';

interface Props {
  room: ContextRoom;
  currentUser: UserProfile;
  onSendMessage: (content: string) => void;
  onBack: () => void;
  socket?: Socket | null;
  typingUsers?: { userId: string; pseudonym: string }[];
  reactions?: Record<string, { counts: Record<string, number>; users: Record<string, string[]>; total: number }>;
  onReaction?: (targetId: string, emoji: string) => void;
}

export const ChatView: React.FC<Props> = ({
  room,
  currentUser,
  onSendMessage,
  onBack,
  socket,
  typingUsers,
  reactions,
  onReaction
}) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasTypedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.messages, typingUsers]);

  const handleTyping = useCallback((val: string) => {
    if (!socket) return;
    if (val.trim().length > 1 && !hasTypedRef.current) {
      hasTypedRef.current = true;
      socket.emit('typing_start', { roomId: room.id, user: currentUser });
    }
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      hasTypedRef.current = false;
      socket.emit('typing_stop', { roomId: room.id, userId: currentUser.id });
    }, 1500);
  }, [socket, room.id, currentUser]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (socket) socket.emit('typing_stop', { roomId: room.id, userId: currentUser.id });
    hasTypedRef.current = false;
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    onSendMessage(input.trim());
    setInput('');
  };

  const ephemeralMins = room.type === 'train' ? 25 : 45;
  const otherTyping = (typingUsers || []).filter(u => u.userId !== currentUser.id);

  return (
    <div className="glass-panel animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 100px)',
      maxHeight: 800,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-elevated)'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex'
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {room.type === 'station' ? `${room.stationName} Chat` : `${room.lineName} · ${room.scheduleLabel || 'Train'}`}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {room.userCount || room.users.length} travelers • Ephemeral (auto-clears)
          </p>
        </div>
      </div>

      {/* Transition / ephemeral header */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(99,102,241,0.06)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 11,
        color: 'var(--text-secondary)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserCheck size={12} />
          {room.userCount} live • Expires in ~{ephemeralMins} min
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{room.stationName}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {room.messages.map(msg => {
          const isMe = msg.senderId === currentUser.id;

          if (msg.isSystem) {
            const isTransition = (msg as any).type === 'transition_alert';
            return (
              <div key={msg.id} className="chat-bubble system" style={isTransition ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 'var(--radius-md)', padding: '6px 12px', color: 'var(--accent-indigo)', fontWeight: 600 } : undefined}>
                {isTransition ? `↔ ${msg.content}` : msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                flexDirection: isMe ? 'row-reverse' : 'row'
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: msg.senderAvatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0
                }}
              >
                {msg.senderPseudonym.charAt(0)}
              </div>

              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 3,
                  textAlign: isMe ? 'right' : 'left',
                  paddingLeft: 4,
                  paddingRight: 4
                }}>
                  {isMe ? 'You' : msg.senderPseudonym}
                </div>

                <div className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                  {msg.content}
                </div>
                {onReaction && (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <ReactionBar
                      targetId={msg.id}
                      targetType="message"
                      roomId={room.id}
                      counts={reactions?.[msg.id]?.counts || {}}
                      myReactions={Object.entries(reactions?.[msg.id]?.users || {}).filter(([,ids]: any) => (ids as string[]).includes(currentUser.id)).map(([e])=>e)}
                      onToggle={(emoji) => onReaction(msg.id, emoji)}
                      compact
                    />
                  </div>
                )}

                <div style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginTop: 3,
                  textAlign: isMe ? 'right' : 'left',
                  paddingLeft: 4,
                  paddingRight: 4
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping.length > 0 && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 14px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontStyle: 'italic'
          }}>
            {otherTyping.map(u => u.pseudonym).join(', ')} typing…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Ephemeral notice */}
      <div style={{
        padding: '4px 16px',
        textAlign: 'center',
        fontSize: 10,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4
      }}>
        <Shield size={10} />
        Ephemeral • Clears after {ephemeralMins} min • {room.messages.length} messages
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 8
      }}>
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); handleTyping(e.target.value); }}
          placeholder="Say something..."
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none'
          }}
        />
        <button type="submit" className="btn-primary" style={{ padding: '10px 14px' }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
