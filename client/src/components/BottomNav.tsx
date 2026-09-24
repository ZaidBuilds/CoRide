import { Home, Users, MessageCircle, User, Route } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { triggerHaptic } from '../utils/nativeBridge';

/**
 * Primary navigation — Material 3 navigation bar with five equal destinations.
 * Each tab is a top-level screen (no back button on those screens); App.tsx
 * maps sub-screens (room, chat thread, safety centre…) onto their parent tab.
 */
export type NavView = 'home' | 'people' | 'chats' | 'profile' | 'connect' | 'station' | 'train' | 'friends' | 'chat' | 'liveTracking';

interface Props {
  active: NavView;
  onNavigate: (v: NavView) => void;
  unreadChats?: number;
}

type Tab = { id: NavView; label: string; icon: LucideIcon; match: NavView[] };

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: Home, match: ['home'] },
  { id: 'people', label: 'People', icon: Users, match: ['people', 'station', 'train'] },
  { id: 'liveTracking', label: 'Journey', icon: Route, match: ['liveTracking'] },
  { id: 'chats', label: 'Chats', icon: MessageCircle, match: ['chats', 'chat', 'friends', 'connect'] },
  { id: 'profile', label: 'Profile', icon: User, match: ['profile'] },
];

export const BottomNav: React.FC<Props> = ({ active, onNavigate, unreadChats = 0 }) => (
  <nav className="bottom-nav" aria-label="Primary">
    {TABS.map(({ id, label, icon: Icon, match }) => {
      const isActive = match.includes(active);
      const unread = id === 'chats' && unreadChats > 0 ? unreadChats : 0;
      return (
        <button
          key={id}
          type="button"
          className={`bottom-nav-item ${isActive ? 'active' : ''}`.trim()}
          aria-current={isActive ? 'page' : undefined}
          aria-label={unread ? `${label}, ${unread} unread` : undefined}
          onClick={() => {
            void triggerHaptic('light');
            onNavigate(id);
          }}
        >
          <span className="nav-indicator" aria-hidden="true">
            <Icon strokeWidth={isActive ? 2.4 : 2} />
          </span>
          <span aria-hidden={unread ? true : undefined}>{label}</span>
          {unread > 0 && (
            <span className="badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      );
    })}
  </nav>
);
