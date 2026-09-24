import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ArrowLeft, Users } from 'lucide-react';
import type { DirectMessage, UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { triggerHaptic } from '../utils/nativeBridge';

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
 * returned — no placeholder badges or karma when a field is missing.
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
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 140px - var(--safe-bottom))',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => onSelectFriend(null)} aria-label="Back to friends" className="icon-btn">
            <ArrowLeft size={20} />
          </button>
          <Avatar name={name} bg={selectedFriend.friendProfile?.avatarBg} size={40} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </h2>
            {where && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Met on {where}</p>
            )}
          </div>
        </div>

        <div role="log" aria-live="polite" aria-label={`Messages with ${name}`} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {thread.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: 'auto 0' }}>
              You’re connected. Say hello to {name}.
            </p>
          )}
          {thread.map(dm => {
            const isMe = dm.senderId === currentUser.id;
            return (
              <div key={dm.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                  {dm.content}
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
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
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            aria-label={`Message ${name}`}
            placeholder={`Message ${name}`}
            maxLength={500}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '0 16px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: 16
            }}
          />
          <button
            type="submit"
            className="icon-btn"
            aria-label="Send message"
            disabled={!inputText.trim()}
            style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--text-on-accent)', opacity: inputText.trim() ? 1 : 0.5 }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <h1 className="display" style={{ fontSize: 28, lineHeight: '34px', color: 'var(--text-primary)', margin: '4px 4px 4px' }}>
        Metro friends
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 4px 16px' }}>
        {friends.length === 0 ? 'People you connect with on your commute' : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}
      </p>

      {friends.length === 0 ? (
        <div className="empty-state-card">
          <Users size={32} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>No Metro friends yet</h2>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0, maxWidth: 300 }}>
            Send a request to someone in your station room. Once they accept, you can chat here.
          </p>
        </div>
      ) : (
        <ul className="list-group" style={{ listStyle: 'none', padding: 0 }}>
          {friends.map((friend, i) => {
            const p = friend.friendProfile;
            const name = nameOf(p);
            const tags = (p?.interestTags || [])
              .map(id => INTEREST_TAXONOMY.find(t => t.id === id)?.label)
              .filter(Boolean)
              .slice(0, 3)
              .join(' · ');
            const sub = p?.vibeTagline || p?.bio || tags;
            return (
              <li key={friend.id} style={{ listStyle: 'none', borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                <button
                  type="button"
                  className="list-row"
                  onClick={() => { triggerHaptic('light'); onSelectFriend(friend); }}
                  aria-label={`Open chat with ${name}${friend.unreadCount > 0 ? `, ${friend.unreadCount} unread` : ''}`}
                  style={{ minHeight: 72, cursor: 'pointer' }}
                >
                  <Avatar name={name} bg={p?.avatarBg} size={48} />
                  <span className="row-text">
                    <span className="row-title">{name}</span>
                    {sub && <span className="row-sub">{sub}</span>}
                  </span>
                  {friend.unreadCount > 0 ? (
                    <span aria-hidden="true" style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: 'var(--accent)', color: 'var(--text-on-accent)', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {friend.unreadCount > 9 ? '9+' : friend.unreadCount}
                    </span>
                  ) : (
                    <MessageCircle size={20} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

function Avatar({ name, bg, size }: { name: string; bg?: string; size: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: '50%', background: bg || 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, fontSize: size * 0.38
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
