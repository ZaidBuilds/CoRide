import { useState } from 'react';
import { MessageCircle, Send, ArrowLeft, Users, ShieldCheck, Sparkles } from 'lucide-react';
import type { DirectMessage, UserProfile } from '../types';

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

export const FriendsTab: React.FC<Props> = ({
  friends,
  currentUser,
  activeDMs,
  onSelectFriend,
  selectedFriend,
  onSendDM
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedFriend) return;
    onSendDM(selectedFriend.friendId, inputText.trim());
    setInputText('');
  };

  if (selectedFriend) {
    const filteredDMs = activeDMs.filter(
      dm =>
        (dm.senderId === currentUser.id && dm.receiverId === selectedFriend.friendId) ||
        (dm.senderId === selectedFriend.friendId && dm.receiverId === currentUser.id)
    );

    return (
      <div className="glass-panel animate-fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 140px)',
        maxHeight: 700,
        overflow: 'hidden'
      }}>
        {/* DM Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--bg-elevated)'
        }}>
          <button
            onClick={() => onSelectFriend(null)}
            aria-label="Back to friends list"
            className="tap-target"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: selectedFriend.friendProfile.avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'white'
            }}
          >
            {selectedFriend.friendProfile.pseudonym.charAt(0)}
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedFriend.friendProfile.pseudonym}
              <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Connected on {selectedFriend.connectedAtLine || 'Metro'} • {selectedFriend.connectedAtStation || 'Commute'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <span style={{
              fontSize: 11,
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16,185,129,0.1)',
              color: 'var(--accent-emerald)',
              border: '1px solid rgba(16,185,129,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Sparkles size={12} />
              You are now connected! This chat persists after your commute.
            </span>
          </div>

          {filteredDMs.map(dm => {
            const isMe = dm.senderId === currentUser.id;
            return (
              <div
                key={dm.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  gap: 8
                }}
              >
                <div className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                  {dm.content}
                  <div style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                    {new Date(dm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 8
        }}>
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            aria-label={`Message ${selectedFriend.friendProfile.pseudonym}`}
            placeholder={`Message ${selectedFriend.friendProfile.pseudonym}...`}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: 16
            }}
          />
          <button type="submit" className="btn-primary" aria-label="Send message" style={{ padding: '10px 14px' }}>
            <Send size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: 20, minHeight: 400 }}>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          Metro Friends
          <span style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16,185,129,0.12)',
            color: 'var(--accent-emerald)',
            border: '1px solid rgba(16,185,129,0.25)',
            fontWeight: 700
          }}>
            {friends.length}
          </span>
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          People you connected with during your commutes
        </p>
      </div>

      {friends.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            color: 'var(--text-muted)'
          }}>
            <Users size={28} />
          </div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            No connections yet
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
            Discover travelers on the Station or Train tab and send connection requests. Accepted connections appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {friends.map(friend => (
            <div
              key={friend.id}
              onClick={() => onSelectFriend(friend)}
              className="traveler-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    background: friend.friendProfile.avatarBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'white'
                  }}
                >
                  {friend.friendProfile.pseudonym.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap:'wrap' }}>
                    {friend.friendProfile.pseudonym}
                    <span style={{ fontSize:11, padding:'2px 6px', borderRadius:999, background: (friend.friendProfile as any).trustTier==='verified' ? 'rgba(168,85,247,0.15)' : 'rgba(16,185,129,0.12)', border:'1px solid var(--border-subtle)', color: (friend.friendProfile as any).trustTier==='trusted' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                      {(friend.friendProfile as any).trustBadge || 'Regular'}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>K {(friend.friendProfile as any).karmaScore || 100}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:200 }}>
                    {friend.friendProfile.interestTags?.join(' · ') || 'Metro commuter'} {(friend.friendProfile as any).vibeTagline ? `• ${(friend.friendProfile as any).vibeTagline}` : ''}
                  </div>
                  {friend.friendProfile.bio && <div style={{ fontSize:11, color:'var(--text-secondary)', fontStyle:'italic', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{friend.friendProfile.bio}</div>}
                </div>
              </div>

              <div style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99,102,241,0.1)',
                color: 'var(--accent-purple-text)'
              }}>
                <MessageCircle size={18} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
