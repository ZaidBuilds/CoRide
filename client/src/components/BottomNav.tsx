import { HouseIcon, UsersThreeIcon, PathIcon, ChatsCircleIcon, UserIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { triggerHaptic } from '../utils/nativeBridge';

/**
 * Primary navigation: five equal destinations on a flat surface bar.
 * Active tab: Phosphor `fill` weight on a Signal Lime pill (ink icon), label in
 * primary text. Inactive: `regular` weight, muted. Unread count sits on Chats.
 * Each tab is a top-level screen; App.tsx maps sub-screens onto their parent tab.
 */
export type NavView = 'home' | 'people' | 'chats' | 'profile' | 'connect' | 'station' | 'train' | 'friends' | 'chat' | 'liveTracking';

interface Props {
  active: NavView;
  onNavigate: (v: NavView) => void;
  unreadChats?: number;
}

type Tab = { id: NavView; label: string; icon: Icon; match: NavView[] };

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: HouseIcon, match: ['home'] },
  { id: 'people', label: 'People', icon: UsersThreeIcon, match: ['people', 'station', 'train'] },
  { id: 'liveTracking', label: 'Journey', icon: PathIcon, match: ['liveTracking'] },
  { id: 'chats', label: 'Chats', icon: ChatsCircleIcon, match: ['chats', 'chat', 'friends', 'connect'] },
  { id: 'profile', label: 'Profile', icon: UserIcon, match: ['profile'] },
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
            <Icon weight={isActive ? 'fill' : 'regular'} />
          </span>
          <span aria-hidden={unread ? true : undefined}>{label}</span>
          {unread > 0 && (
            <span className="badge tnum" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      );
    })}
  </nav>
);
