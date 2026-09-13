import { Home, Users, MessageCircle, User, Map } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';

export type NavView = 'home' | 'people' | 'chats' | 'profile' | 'connect' | 'station' | 'train' | 'friends' | 'chat' | 'liveTracking';

interface Props {
  active: NavView;
  onNavigate: (v: NavView) => void;
  unreadChats?: number;
}

export const BottomNav: React.FC<Props> = ({ active, onNavigate, unreadChats = 0 }) => {
  const isPeopleActive = active === 'people' || active === 'station' || active === 'train';
  const isChatsActive = active === 'chats' || active === 'chat' || active === 'friends' || active === 'connect';
  const isMapActive = active === 'liveTracking';

  const nav = (v: NavView) => {
    triggerHaptic('light');
    onNavigate(v);
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button className={`bottom-nav-item ${active === 'home' ? 'active' : ''}`} aria-current={active === 'home' ? 'page' : undefined} onClick={() => nav('home')}>
        <Home />
        <span>Home</span>
      </button>

      <button className={`bottom-nav-item ${isPeopleActive ? 'active' : ''}`} aria-current={isPeopleActive ? 'page' : undefined} onClick={() => nav('people')}>
        <Users />
        <span>People</span>
      </button>

      <button
        onClick={() => nav('liveTracking')}
        className={`bottom-nav-scan ${isMapActive ? 'active' : ''}`}
        aria-label="Live Metro Map & Tracking"
        title="Live Metro Map"
      >
        <Map size={26} />
      </button>

      <button
        className={`bottom-nav-item ${isChatsActive ? 'active' : ''}`}
        aria-current={isChatsActive ? 'page' : undefined}
        aria-label={unreadChats > 0 ? `Chats, ${unreadChats} unread` : 'Chats'}
        onClick={() => nav('chats')}
        style={{ position:'relative' }}
      >
        <MessageCircle />
        <span>Chats</span>
        {unreadChats > 0 && (
          <span aria-hidden="true" style={{ position:'absolute', top:2, right:18, minWidth:16, height:16, padding:'0 4px', borderRadius:999, background:'#EF4444', color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadChats > 9 ? '9+' : unreadChats}</span>
        )}
      </button>

      <button className={`bottom-nav-item ${active === 'profile' ? 'active' : ''}`} aria-current={active === 'profile' ? 'page' : undefined} onClick={() => nav('profile')}>
        <User />
        <span>Profile</span>
      </button>
    </nav>
  );
};
