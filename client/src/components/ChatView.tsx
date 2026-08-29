import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ArrowLeft, Shield, MoreVertical, Users, Train, X, Gamepad2 } from 'lucide-react';
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
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const hasTypedRef = useRef(false);

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth'}); }, [room.messages, typingUsers]);

  const handleTyping = useCallback((val:string)=>{
    if (!socket) return;
    if (val.trim().length>1 && !hasTypedRef.current){ hasTypedRef.current=true; socket.emit('typing_start', { roomId: room.id, user: currentUser }); }
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(()=>{ hasTypedRef.current=false; socket.emit('typing_stop', { roomId: room.id, userId: currentUser.id }); },1500);
  }, [socket, room.id, currentUser]);

  const handleSend = (e:React.FormEvent)=>{
    e.preventDefault();
    if (!input.trim()) return;
    if (socket) socket.emit('typing_stop', { roomId: room.id, userId: currentUser.id });
    hasTypedRef.current=false; if(typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    onSendMessage(input.trim()); setInput('');
  };

  const otherTyping = (typingUsers||[]).filter(u=>u.userId!==currentUser.id);
  const stopsLeft = 8;
  const online = room.userCount || room.users.length;
  const nearby = room.presence?.nearby ?? 3;

  return (
    <div className="glass-panel animate-fade-in" style={{ position:'relative', display:'flex', flexDirection:'column', height:'calc(100vh - 72px)', maxHeight: 800, overflow:'hidden', background:'#12121A', border:'1px solid var(--border-card)', borderRadius:'var(--radius-xl)' }}>
      {/* Header — Figma 04 */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:12, background:'rgba(19,19,30,0.9)' }}>
        <button onClick={onBack} style={{ width:32,height:32, borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'white', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {room.lineName} <span style={{ opacity:0.6 }}>•</span> {(room.direction?.replace('Towards ','') || 'Noida Bound').split(' ')[0]} Bound
          </div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:1 }}>{room.stationName} → Mandi House</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-secondary)', fontWeight:700 }}>
            <Users size={14}/> {online}
          </span>
          <button style={{ width:32,height:32, borderRadius:'50%', background:'transparent', border:'none', color:'var(--text-muted)' }}><MoreVertical size={18}/></button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ margin: '10px 12px 0', padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-secondary)' }}>
          <Train size={16} style={{ color:'var(--accent-violet)' }} />
          <div>
            <div style={{ fontWeight:700, color:'white', fontSize:12 }}>{stopsLeft} stops left</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>to Noida Sec 18</div>
          </div>
        </div>
        <div style={{ textAlign:'center', fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center', color:'white', fontWeight:700 }}>
            <span style={{ width:7,height:7, borderRadius:'50%', background:'var(--presence-active)', display:'inline-block' }} /> {online} online
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{nearby} nearby</div>
        </div>
        <button style={{ padding:'6px 10px', borderRadius:999, background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.28)', color:'#C4B5FF', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
          <Users size={12}/> Room Info
        </button>
      </div>

      {/* Pinned */}
      {showPinned && (
        <div style={{ margin:'10px 12px 0', padding:'10px 12px', borderRadius:'var(--radius-lg)', background:'rgba(123,93,255,0.10)', border:'1px solid rgba(123,93,255,0.18)', display:'flex', gap:8, alignItems:'flex-start' }}>
          <span style={{ color:'#8B5CF6', marginTop:2 }}>📌</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#C4B5FF' }}>Room pinned</div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>Be respectful and keep the vibe fun! No abuse, no spam, no personal info.</div>
          </div>
          <button onClick={()=>setShowPinned(false)} style={{ background:'none', border:'none', color:'var(--text-muted)' }}><X size={14}/></button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:14 }}>
        {room.messages.map(msg=>{
          const isMe = msg.senderId === currentUser.id;
          if (msg.isSystem) {
            const isGame = (msg as any).type==='game_alert';
            return (
              <div key={msg.id} style={{
                alignSelf:'center',
                background: isGame ? 'rgba(123,93,255,0.12)' : 'transparent',
                border: isGame ? '1px solid rgba(123,93,255,0.18)' : 'none',
                color: isGame ? '#C4B5FF' : 'var(--text-muted)',
                fontSize:11, padding: isGame ? '6px 12px' : '4px 12px', borderRadius:999, textAlign:'center'
              }}>
                {msg.content}
              </div>
            );
          }
          const isAdmin = msg.senderPseudonym === 'CosmicTiger_44';
          return (
            <div key={msg.id} style={{ display:'flex', gap:10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
              <div style={{
                width:36,height:36, borderRadius:'50%',
                background: isMe ? 'linear-gradient(135deg, #7B5DFF, #EC4899)' : msg.senderAvatarBg,
                display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:12, flexShrink:0,
                border:'2px solid rgba(255,255,255,0.06)'
              }}>
                {isMe ? currentUser.pseudonym[0] : msg.senderPseudonym[0]}
              </div>
              <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', gap:6, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)' }}>
                  <span style={{ fontWeight:700, color:'var(--text-primary)', fontSize:12 }}>{isMe ? 'You' : msg.senderPseudonym}</span>
                  {isAdmin && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(123,93,255,0.18)', color:'#C4B5FF', border:'1px solid rgba(123,93,255,0.28)' }}>Admin</span>}
                  <span style={{ fontSize:10 }}>{new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                  {isMe && <span style={{ color:'#7B5DFF' }}>✓✓</span>}
                </div>
                <div style={{
                  padding:'10px 14px', borderRadius: isMe ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                  background: isMe ? '#7B5DFF' : 'var(--bg-surface)',
                  border: isMe ? 'none' : '1px solid var(--border-subtle)',
                  color: isMe ? 'white' : 'var(--text-primary)',
                  fontSize:13, lineHeight:1.4
                }}>
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

      {/* FAB Play Game */}
      <button style={{
        position:'absolute', right:16, bottom:78,
        width:56,height:56, borderRadius:'50%',
        background:'linear-gradient(135deg, #1A1033, #2A1A5E)', border:'2px solid #7B5DFF',
        color:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        boxShadow:'0 8px 24px rgba(0,0,0,0.45)', fontSize:10, fontWeight:700
      }}>
        <Gamepad2 size={18}/> Play Game
      </button>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding:'12px', borderTop:'1px solid var(--border-subtle)', display:'flex', gap:8, background:'var(--bg-elevated)', alignItems:'center' }}>
        <button type="button" style={{ width:36,height:36, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span>
        </button>
        <input
          value={input}
          onChange={e=>{ setInput(e.target.value); handleTyping(e.target.value); }}
          placeholder="Type a message..."
          style={{ flex:1, padding:'10px 14px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'white', fontSize:13, outline:'none' }}
        />
        <button type="button" style={{ width:36,height:36, borderRadius:'50%', background:'transparent', border:'none', color:'var(--text-muted)', fontSize:18 }}>☺</button>
        <button type="submit" style={{ width:36,height:36, borderRadius:'50%', background:'#7B5DFF', border:'none', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Send size={16}/>
        </button>
      </form>

      <div style={{ padding:'6px 0 2px', textAlign:'center', fontSize:10, color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
        <Shield size={10}/> Ephemeral • Clears after commute • {room.messages.length}
      </div>
    </div>
  );
};
