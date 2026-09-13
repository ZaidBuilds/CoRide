import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ArrowLeft, Shield, Users, X } from 'lucide-react';
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

export const ChatView: React.FC<Props> = ({ room, currentUser, onSendMessage, onBack, socket, typingUsers, reactions, onReaction }) => {
  const [input, setInput] = useState('');
  const [showPinned, setShowPinned] = useState(true);
  // Optimistic sends rendered instantly and dropped the moment the server's
  // copy arrives (new_message) or the ack confirms it — the chat stays
  // responsive even while the round-trip is in flight.
  const [pending, setPending] = useState<{ id: string; content: string; ts: number }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const typingStartRef = useRef<number | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const hasTypedRef = useRef(false);

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth'}); }, [room.messages, typingUsers, pending]);

  // Drop a pending bubble once its server-confirmed copy lands in room.messages.
  useEffect(() => {
    const last = room.messages[room.messages.length - 1];
    if (last && !last.isSystem && last.senderId === currentUser.id) {
      setPending(prev => {
        const next = prev.filter(p => p.content !== last.content);
        return next.length === prev.length ? prev : next;
      });
    }
  }, [room.messages, currentUser.id]);

  // message_ack clears the matching pending bubble (belt-and-braces for the
  // dedupe above; also proves the ack path end-to-end).
  useEffect(() => {
    if (!socket) return;
    const onAck = (msg: { id?: string; content?: string }) => {
      if (!msg?.content) return;
      setPending(prev => prev.filter(p => p.content !== msg.content));
    };
    socket.on('message_ack', onAck);
    return () => { socket.off('message_ack', onAck); };
  }, [socket]);

  // Typing indicator: 1s debounce before announcing, 3s of silence before
  // the stop — flickers once on a fast typist's first keystroke, not per key.
  const stopTyping = useCallback(() => {
    hasTypedRef.current = false;
    if (typingStartRef.current) { window.clearTimeout(typingStartRef.current); typingStartRef.current = null; }
    if (typingStopRef.current) { window.clearTimeout(typingStopRef.current); typingStopRef.current = null; }
    socket?.emit('typing_stop', { roomId: room.id, userId: currentUser.id });
  }, [socket, room.id, currentUser.id]);

  const handleTyping = useCallback((val: string) => {
    if (!socket) return;
    if (val.trim().length > 1 && !hasTypedRef.current) {
      hasTypedRef.current = true;
      typingStartRef.current = window.setTimeout(() => {
        socket.emit('typing_start', { roomId: room.id, user: currentUser });
      }, 1000);
    }
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(stopTyping, 3000);
  }, [socket, room.id, currentUser, stopTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    stopTyping();
    onSendMessage(content);
    setPending(prev => [...prev, { id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, content, ts: Date.now() }]);
    setInput('');
  };

  // Clear any lingering typing timers on unmount.
  useEffect(() => () => { if (typingStartRef.current) window.clearTimeout(typingStartRef.current); if (typingStopRef.current) window.clearTimeout(typingStopRef.current); }, []);

  const otherTyping = (typingUsers || []).filter(u => u.userId !== currentUser.id);
  const online = room.userCount || room.users.length;

  return (
    <div className="glass-panel animate-fade-in" style={{ position:'relative', display:'flex', flexDirection:'column', height:'calc(100vh - 72px)', maxHeight: 800, overflow:'hidden', background:'var(--bg-elevated)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)' }}>
      {/* Header — Figma 04 */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:12, background:'var(--glass-bg)' }}>
        <button onClick={onBack} aria-label="Back" className="icon-btn">
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {room.lineName} <span style={{ opacity:0.6 }}>•</span> {(room.direction?.replace('Towards ','') || 'Noida Bound').split(' ')[0]} Bound
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:1 }}>{room.stationName} → Mandi House</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-secondary)', fontWeight:700 }}>
            <Users size={14}/> {online}
          </span>
        </div>
      </div>

      {/* Pinned */}
      {showPinned && (
        <div style={{ margin:'10px 12px 0', padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'rgba(123,93,255,0.10)', border:'1px solid rgba(123,93,255,0.18)', display:'flex', gap:8, alignItems:'flex-start' }}>
          <span style={{ color:'var(--accent-purple-text)', marginTop:2 }}>📌</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--accent-purple-text)' }}>Room pinned</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>Be respectful and keep the vibe fun! No abuse, no spam, no personal info.</div>
          </div>
          <button onClick={()=>setShowPinned(false)} aria-label="Dismiss pinned message" className="tap-target" style={{ background:'none', border:'none', color:'var(--text-muted)' }}><X size={14}/></button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:14 }}>
        {/* Optimistic sends — shown dimmed until the server confirms. */}
        {pending.map(p => (
          <div key={p.id} style={{ display:'flex', gap:10, flexDirection:'row-reverse', alignItems:'flex-start', opacity:0.55 }}>
            <div style={{
              width:36,height:36, borderRadius:'50%',
              background:'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))',
              display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:12, flexShrink:0,
              border:'2px solid rgba(255,255,255,0.06)'
            }}>
              {currentUser.pseudonym[0]}
            </div>
            <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)' }}>
                <span style={{ fontWeight:700, color:'var(--text-primary)', fontSize:12 }}>You</span>
                <span style={{ fontSize:11 }}>{new Date(p.ts).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="chat-bubble outgoing" style={{ maxWidth:'100%' }}>
                {p.content}
              </div>
            </div>
          </div>
        ))}
        {room.messages.map(msg=>{
          const isMe = msg.senderId === currentUser.id;
          if (msg.isSystem) {
            const isGame = (msg as any).type==='game_alert';
            return (
              <div key={msg.id} className="chat-bubble system" style={{
                alignSelf:'center', borderRadius:999,
                ...(isGame ? {
                  background:'rgba(123,93,255,0.12)',
                  border:'1px solid rgba(123,93,255,0.18)',
                  color:'var(--accent-purple-text)'
                } : {})
              }}>
                {msg.content}
              </div>
            );
          }
          return (
            <div key={msg.id} style={{ display:'flex', gap:10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
              <div style={{
                width:36,height:36, borderRadius:'50%',
                background: isMe ? 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))' : msg.senderAvatarBg,
                display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:12, flexShrink:0,
                border:'2px solid rgba(255,255,255,0.06)'
              }}>
                {isMe ? currentUser.pseudonym[0] : msg.senderPseudonym[0]}
              </div>
              <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', gap:6, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)' }}>
                  <span style={{ fontWeight:700, color:'var(--text-primary)', fontSize:12 }}>{isMe ? 'You' : msg.senderPseudonym}</span>
                  <span style={{ fontSize:11 }}>{new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <div
                  className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}
                  /* the column above already caps width at 72%; the class's own
                     78% would narrow the bubble inside it */
                  style={{ maxWidth:'100%' }}
                >
                  {msg.content}
                </div>
                {onReaction && (
                  <ReactionBar
                    targetId={msg.id}
                    targetType="message"
                    roomId={room.id}
                    counts={reactions?.[msg.id]?.counts || {}}
                    myReactions={Object.entries(reactions?.[msg.id]?.users || {}).filter(([,ids]:any)=> (ids as string[]).includes(currentUser.id)).map(([e])=>e)}
                    onToggle={(emoji)=> onReaction(msg.id, emoji)}
                  />
                )}
              </div>
            </div>
          );
        })}
        {otherTyping.length>0 && (
          <div style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', borderRadius:'var(--radius-lg)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', alignSelf:'flex-start' }}>
            <div style={{ display:'flex', gap:3 }}>
              <span style={{ width:6,height:6, borderRadius:'50%', background:'var(--text-muted)', animation:'pulseGlow 1s infinite' }} />
              <span style={{ width:6,height:6, borderRadius:'50%', background:'var(--text-muted)', animation:'pulseGlow 1s infinite 0.2s' }} />
              <span style={{ width:6,height:6, borderRadius:'50%', background:'var(--text-muted)', animation:'pulseGlow 1s infinite 0.4s' }} />
            </div>
            <span style={{ fontSize:12, color:'var(--text-secondary)', fontStyle:'italic' }}>{otherTyping.map(u=>u.pseudonym).join(', ')} is typing...</span>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding:'12px', borderTop:'1px solid var(--border-subtle)', display:'flex', gap:8, background:'var(--bg-elevated)', alignItems:'center' }}>
        <input
          value={input}
          onChange={e=>{ setInput(e.target.value); handleTyping(e.target.value); }}
          aria-label="Type a message"
          placeholder="Type a message..."
          style={{ flex:1, padding:'10px 14px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:16 }}
        />
        <button type="submit" aria-label="Send message" className="press" style={{ width:44,height:44, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))', border:'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Send size={16}/>
        </button>
      </form>

      <div style={{ padding:'6px 0 2px', textAlign:'center', fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
        <Shield size={10}/> Ephemeral • Clears after commute • {room.messages.length}
      </div>
    </div>
  );
};
