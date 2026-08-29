import { Search, PenSquare, Mic, CheckCheck, BellOff } from 'lucide-react';
import type { UserProfile } from '../types';

interface ChatItem {
  id: string;
  name: string;
  avatarBg: string;
  lastMsg: string;
  time: string;
  unread?: number;
  isGroup?: boolean;
  isVoice?: boolean;
  verified?: boolean;
  muted?: boolean;
}

interface Props {
  user: UserProfile | null;
  friends: any[];
  onSelect: (id: string) => void;
}

export const ChatsScreen: React.FC<Props> = ({ user, friends, onSelect }) => {
  const stories = [
    { name: user ? user.pseudonym.split('_')[0] : 'Your Story', bg: user?.avatarBg || 'var(--bg-surface)', isAdd: !user, isUser: !!user, ring: '#7B5DFF' },
    { name:'Ishita', bg:'linear-gradient(135deg,#3B82F6,#06B6D4)', ring:'#3B82F6' },
    { name:'Kabir', bg:'linear-gradient(135deg,#10b981,#059669)', ring:'#10b981' },
    { name:'Mehak', bg:'linear-gradient(135deg,#F59E0B,#EF4444)', ring:'#F59E0B' },
    { name:'Rohan', bg:'linear-gradient(135deg,#EC4899,#8B5CF6)', ring:'#EC4899' },
  ];

  const chats: ChatItem[] = [
    { id:'aryana', name:'Aryan', avatarBg:'linear-gradient(135deg,#7B5DFF,#EC4899)', lastMsg:'Hey! Are we still on for the movie tonight? 🎬', time:'9:30 AM', unread:2 },
    { id:'ishita', name:'Ishita', avatarBg:'linear-gradient(135deg,#06B6D4,#3B82F6)', lastMsg:'Check out this playlist 🎧 (12 songs)', time:'9:25 AM', unread:1 },
    { id:'travel', name:'Travel Buddies', avatarBg:'#1A1A26', lastMsg:'Kabir: Let’s plan our next trip 🚇', time:'Yesterday', unread:5, isGroup:true },
    { id:'mehak', name:'Mehak', avatarBg:'linear-gradient(135deg,#F59E0B,#EF4444)', lastMsg:'Thanks for the notes! 🙌', time:'Yesterday' },
    { id:'tech', name:'Tech Hub', avatarBg:'#4F46E5', lastMsg:'Rohan: Here’s the code snippet you asked for.', time:'Mon', isGroup:true },
    { id:'rohan', name:'Rohan', avatarBg:'linear-gradient(135deg,#EC4899,#8B5CF6)', lastMsg:'Voice Note', time:'Mon', isVoice:true, unread:0 },
    { id:'kabir', name:'Kabir', avatarBg:'linear-gradient(135deg,#10b981,#059669)', lastMsg:'See you at the station 🚇', time:'Sun' },
    { id:'family', name:'Family Group', avatarBg:'#1A1A26', lastMsg:'Mom: Everyone, dinner at 8! 🍽️', time:'Sat', isGroup:true, muted:true },
  ];

  const realChats: ChatItem[] = friends.slice(0,3).map((f:any)=> ({
    id: f.friendId || f.id,
    name: f.profile?.pseudonym || f.friendProfile?.pseudonym || 'Friend',
    avatarBg: f.profile?.avatarBg || f.friendProfile?.avatarBg || '#7B5DFF',
    lastMsg: 'You are now connected! Say hi 👋',
    time: 'Now',
    unread: 1,
    isGroup: false,
    isVoice: false,
    muted: false,
  }));
  const displayChats: ChatItem[] = realChats.length ? [...realChats, ...chats] : chats;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h2 style={{ fontSize:20, fontWeight:900 }}>Chats</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ width:36,height:36, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><Search size={16}/></button>
          <button style={{ width:36,height:36, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7B5DFF' }}><PenSquare size={16}/></button>
        </div>
      </div>

      <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'8px 2px 12px', marginBottom:6 }}>
        {stories.map(s=>(
          <div key={s.name} style={{ flex:'0 0 64px', textAlign:'center' }}>
            <div style={{
              width:56,height:56, borderRadius:'50%',
              background: (s as any).isAdd ? 'var(--bg-surface)' : s.bg,
              border: (s as any).isAdd ? '1px dashed var(--border-card)' : `2px solid ${s.ring}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'white', fontWeight:800, fontSize:18, margin:'0 auto',
              position:'relative'
            }}>
              {(s as any).isAdd ? '+' : (s as any).isUser ? (user!.pseudonym[0]) : s.name[0]}
              {!(s as any).isAdd && <div style={{ position:'absolute', bottom:0, right:0, width:10,height:10, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-base)' }} />}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {displayChats.map(c=>(
          <div key={c.id} onClick={()=> onSelect(c.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', borderRadius:'var(--radius-lg)', background:'var(--bg-card)', border:'1px solid var(--border-card)', cursor:'pointer' }}>
            <div style={{ position:'relative' }}>
              <div style={{ width:48,height:48, borderRadius:'50%', background: c.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>
                {c.isGroup ? (
                  <div style={{ display:'flex', gap:2 }}>
                    <div style={{ width:20,height:20, borderRadius:'50%', background:'rgba(255,255,255,0.9)' }} />
                    <div style={{ width:20,height:20, borderRadius:'50%', background:'rgba(255,255,255,0.6)', marginLeft:-6 }} />
                  </div>
                ) : c.name[0]}
              </div>
              {!c.isGroup && <div style={{ position:'absolute', bottom:0, right:0, width:12,height:12, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-card)' }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:800, color:'white' }}>{c.name}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{c.time}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:4 }}>
                {c.isVoice && <Mic size={12} style={{ color:'var(--accent-violet)' }} />} {c.lastMsg}
                {c.muted && <BellOff size={12} style={{ marginLeft:4 }} />}
              </div>
            </div>
            {c.unread ? (
              <span style={{ minWidth:20,height:20, padding:'0 6px', borderRadius:999, background:'#7B5DFF', color:'white', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{c.unread}</span>
            ) : c.id==='rohan' ? <span style={{ fontSize:11, color:'var(--text-muted)' }}>0:18</span> : c.id==='kabir' ? <CheckCheck size={14} style={{ color:'var(--accent-violet)' }}/> : null}
          </div>
        ))}
      </div>

      <div style={{ marginTop:14, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ width:32,height:32, borderRadius:'50%', background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#7B5DFF' }}>🔒</div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'#C4B5FF' }}>Your privacy matters</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>CoRide keeps your chats secure and spam-free.</div>
        </div>
      </div>
    </div>
  );
};
