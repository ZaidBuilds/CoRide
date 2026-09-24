import { useEffect, useRef, useState } from 'react';
import { ChatCircleIcon, PaperPlaneRightIcon, ArrowLeftIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { DirectMessage, UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { triggerHaptic } from '../utils/nativeBridge';
import { Avatar } from './ui/Avatar';
import { IconButton } from './ui/IconButton';
import { ScreenHeader } from './ui/ScreenHeader';
import { EmptyState } from './ui/EmptyState';
import { ListGroup, ListRow } from './ui/ListRow';

export interface MetroFriend {
  id: string;
  friendId: string;
  friendProfile: UserProfile;
  connectedAtLine: string;
  connectedAtStation: string;
  createdAt: number;
  unreadCount: number;
}

interface Props {
  friends: MetroFriend[];
  currentUser: UserProfile;
  activeDMs: DirectMessage[];
  onSelectFriend: (friend: MetroFriend | null) => void;
  selectedFriend: MetroFriend | null;
  onSendDM: (receiverId: string, content: string) => void;
}

const nameOf = (p: UserProfile | undefined) => p?.pseudonym || p?.username?.replace(/^@/, '') || 'Commuter';

/**
 * Metro friends list with an inline 1:1 thread. Shows only what the server
 * returned: no placeholder badges or karma when a field is missing.
 */
export const FriendsTab: React.FC<Props> = ({
  friends,
  currentUser,
  activeDMs,
  onSelectFriend,
  selectedFriend,
  onSendDM
}) => {
  const [inputText, setInputText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const thread = selectedFriend
    ? activeDMs.filter(
        dm =>
          (dm.senderId === currentUser.id && dm.receiverId === selectedFriend.friendId) ||
          (dm.senderId === selectedFriend.friendId && dm.receiverId === currentUser.id)
      )
    : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedFriend) return;
    triggerHaptic('light');
    onSendDM(selectedFriend.friendId, text);
    setInputText('');
  };

  if (selectedFriend) {
    const name = nameOf(selectedFriend.friendProfile);
    const where = [selectedFriend.connectedAtLine, selectedFriend.connectedAtStation].filter(Boolean).join(' · ');

    return (
      <div
        className="animate-fade-in card"
        style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px - var(--safe-bottom))', padding: 0, overflow: 'hidden' }}
      >
        <div style={{ padding: '8px 12px 8px 4px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton label="Back to friends" variant="plain" onClick={() => onSelectFriend(null)}>
            <ArrowLeftIcon size={24} aria-hidden="true" />
          </IconButton>
          <Avatar name={name} seed={selectedFriend.friendId} bg={selectedFriend.friendProfile?.avatarBg} size={40} />
          <div style={{ minWidth: 0 }}>
            <h2 className="type-headline" style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </h2>
            {where && <p className="type-meta" style={{ color: 'var(--text-muted)' }}>Met on {where}</p>}
          </div>
        </div>

        <div role="log" aria-live="polite" aria-label={`Messages with ${name}`} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {thread.length === 0 && (
            <p className="type-body" style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto 0' }}>
              You're connected. Say hello to {name}.
            </p>
          )}
          {thread.map(dm => {
            const isMe = dm.senderId === currentUser.id;
            return (
              <div key={dm.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                  {dm.content}
                  <div className="tnum" style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                    {new Date(dm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSend} style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            aria-label={`Message ${name}`}
            placeholder={`Message ${name}`}
            maxLength={500}
            style={{ flex: 1, borderRadius: 'var(--radius-pill)', padding: '0 16px' }}
          />
          <IconButton
            type="submit"
            label="Send message"
            disabled={!inputText.trim()}
            style={{ background: inputText.trim() ? 'var(--ink)' : 'var(--bg-tonal)', color: inputText.trim() ? 'var(--ink-inverse)' : 'var(--text-muted)' }}
          >
            <PaperPlaneRightIcon size={22} aria-hidden="true" />
          </IconButton>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <ScreenHeader
        title="Metro friends"
        size="large"
        subtitle={friends.length === 0 ? 'People you connect with on your commute' : <span className="tnum">{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</span>}
      />

      {friends.length === 0 ? (
        <EmptyState
          icon={<UsersThreeIcon size={24} />}
          title="No Metro friends yet"
          description="Send a request to someone in your station room. Once they accept, you can chat here."
        />
      ) : (
        <ListGroup className="stagger">
          {friends.map(friend => {
            const p = friend.friendProfile;
            const name = nameOf(p);
            const tags = (p?.interestTags || [])
              .map(id => INTEREST_TAXONOMY.find(t => t.id === id)?.label)
              .filter(Boolean)
              .slice(0, 3)
              .join(' · ');
            const sub = p?.vibeTagline || p?.bio || tags;
            return (
              <ListRow
                key={friend.id}
                onClick={() => { triggerHaptic('light'); onSelectFriend(friend); }}
                aria-label={`Open chat with ${name}${friend.unreadCount > 0 ? `, ${friend.unreadCount} unread` : ''}`}
                leading={<Avatar name={name} seed={friend.friendId} bg={p?.avatarBg} size={48} />}
                title={name}
                subtitle={sub || undefined}
                trailing={friend.unreadCount > 0 ? (
                  <span className="tnum" style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 'var(--radius-pill)', background: 'var(--signal)', color: 'var(--ink-fixed)', fontSize: 12, fontWeight: 650, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {friend.unreadCount > 9 ? '9+' : friend.unreadCount}
                  </span>
                ) : (
                  <ChatCircleIcon size={22} aria-hidden="true" />
                )}
              />
            );
          })}
        </ListGroup>
      )}
    </div>
  );
};
