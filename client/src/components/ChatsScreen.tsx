interface ChatItem {
  id: string;
  name: string;
  avatarBg: string;
  lastMsg: string;
  time: string;
  unread?: number;
  muted?: boolean;
}

interface Props {
  friends: any[];
  onSelect: (id: string) => void;
}

export const ChatsScreen: React.FC<Props> = ({ friends, onSelect }) => {
  const realChats: ChatItem[] = friends.map((f:any)=> ({
    id: f.friendId || f.id,
    name: f.profile?.pseudonym || f.friendProfile?.pseudonym || 'Friend',
    avatarBg: f.profile?.avatarBg || f.friendProfile?.avatarBg || 'var(--accent-purple)',
    lastMsg: 'You are now connected! Say hi 👋',
    time: 'Now',
    unread: undefined,
    muted: false,
  }));

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h2 style={{ fontSize:20, fontWeight:900 }}>Chats</h2>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {realChats.length === 0 && (
          <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:12, border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            No conversations yet — connect with someone to start a chat.
          </div>
        )}
        {realChats.map(c=>(
          <div key={c.id} onClick={()=> onSelect(c.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', borderRadius:'var(--radius-lg)', background:'var(--bg-card)', border:'1px solid var(--border-card)', cursor:'pointer' }}>
            <div style={{ position:'relative' }}>
              <div style={{ width:48,height:48, borderRadius:'50%', background: c.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>
                {c.name[0]}
              </div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{c.name}</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{c.time}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.lastMsg}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:14, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ width:32,height:32, borderRadius:'50%', background:'rgba(123,93,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>🔒</div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--accent-purple-text)' }}>Your privacy matters</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>CoRide keeps your chats secure and spam-free.</div>
        </div>
      </div>
    </div>
  );
};
