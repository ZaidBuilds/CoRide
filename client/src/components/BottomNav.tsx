import { Home, Users, MessageCircle, User, ScanQrCode } from 'lucide-react';

export type NavView = 'home' | 'people' | 'chats' | 'profile' | 'connect' | 'station' | 'train' | 'friends' | 'chat';

interface Props {
  active: NavView;
  onNavigate: (v: NavView) => void;
  unreadChats?: number;
}

export const BottomNav: React.FC<Props> = ({ active, onNavigate, unreadChats = 0 }) => {
  const isPeopleActive = active === 'people' || active === 'station' || active === 'train';
  const isChatsActive = active === 'chats' || active === 'chat' || active === 'friends' || active === 'connect';
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button className={`bottom-nav-item ${active === 'home' ? 'active' : ''}`} aria-current={active === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}>
        <Home />
        <span>Home</span>
      </button>

      <button className={`bottom-nav-item ${isPeopleActive ? 'active' : ''}`} aria-current={isPeopleActive ? 'page' : undefined} onClick={() => onNavigate('people')}>
        <Users />
        <span>People</span>
      </button>

      <button
        onClick={() => onNavigate('people')}
        className="bottom-nav-scan"
        aria-label="Scan / Discover"
        title="Discover"
      >
        <ScanQrCode size={28} />
      </button>

      <button
        className={`bottom-nav-item ${isChatsActive ? 'active' : ''}`}
        aria-current={isChatsActive ? 'page' : undefined}
        aria-label={unreadChats > 0 ? `Chats, ${unreadChats} unread` : 'Chats'}
        onClick={() => onNavigate('chats')}
        style={{ position:'relative' }}
      >
        <MessageCircle />
        <span>Chats</span>
        {unreadChats > 0 && (
          <span aria-hidden="true" style={{ position:'absolute', top:2, right:18, minWidth:16, height:16, padding:'0 4px', borderRadius:999, background:'#EF4444', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadChats > 9 ? '9+' : unreadChats}</span>
        )}
      </button>

      <button className={`bottom-nav-item ${active === 'profile' ? 'active' : ''}`} aria-current={active === 'profile' ? 'page' : undefined} onClick={() => onNavigate('profile')}>
        <User />
        <span>Profile</span>
      </button>
    </nav>
  );
};
