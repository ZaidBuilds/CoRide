import { useState } from 'react';
import { TravelerCard } from './TravelerCard';
import { ProfileDrawer } from './ProfileDrawer';
import { ContextConfidenceBadge } from './ContextConfidenceBadge';
import type { ContextRoom, ContextResult, UserProfile, RankedTraveler } from '../types';
import { MapPin, Train, Users, Sparkles } from 'lucide-react';

interface Props {
  room: ContextRoom;
  context: ContextResult | null;
  currentUser: UserProfile;
  friendIds: string[];
  ranked?: RankedTraveler[];
  vibe?: RankedTraveler[];
  onConnect: (targetUserId: string) => void;
  onBlock: (targetUserId: string) => void;
  onReport: (targetUserId: string, reason: string) => void;
  onOpenChat: () => void;
  onProfileOpen?: (targetUserId: string) => void;
}

export const DiscoveryScreen: React.FC<Props> = ({
  room,
  context,
  currentUser,
  friendIds,
  ranked,
  vibe,
  onConnect,
  onBlock,
  onReport,
  onOpenChat,
  onProfileOpen
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const handleTap = (u: UserProfile) => {
    setSelectedUser(u);
    onProfileOpen?.(u.id);
  };

  const presenceCounts = room.presence || { active: 0, nearby: 0, other: 0, total: 0 };

  // Smart ranking if available, else presence sort
  const rankedMap = new Map<string, RankedTraveler>((ranked || []).map(r => [r.profile.id, r]));
  const sortedUsers = (() => {
    if (ranked && ranked.length) {
      // ranked already sorted by score
      const ids = ranked.map(r => r.profile.id);
      const byId = new Map(room.users.map(u => [u.id, u]));
      const ordered = ids.map(id => byId.get(id)).filter(Boolean) as UserProfile[];
      // append any missing (e.g., seeds not ranked due to filter)
      const missing = room.users.filter(u => !ids.includes(u.id));
      return [...ordered, ...missing];
    }
    return [...(room.users || [])].sort((a, b) => {
      const order = { active: 0, nearby: 1, other: 2 };
      const aT = order[a.presenceTier || 'other'] ?? 2;
      const bT = order[b.presenceTier || 'other'] ?? 2;
      return aT - bT;
    });
  })();

  return (
    <div className="animate-fade-in">
      {/* Context Header */}
      <div className="glass-panel" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div className="context-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {room.type === 'station' ? (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)'
                  }}>
                    <MapPin size={18} />
                  </div>
                ) : (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(99,102,241,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-indigo)'
                  }}>
                    <Train size={18} />
                  </div>
                )}

                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                    {room.type === 'station' ? room.stationName : `${room.lineName} → ${room.direction?.replace('Towards ', '')}`}
                  </h2>
                  {room.type === 'train' && room.scheduleLabel && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      {room.scheduleLabel} service
                    </p>
                  )}
                </div>
              </div>

              {context && <ContextConfidenceBadge context={context} />}
            </div>

            {/* Total count */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                {room.userCount || sortedUsers.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                travelers {room.type === 'station' ? 'around' : 'onboard'}
              </div>
            </div>
          </div>

          {/* Presence Tier Summary */}
          <div className="presence-bar" style={{ marginTop: 12 }}>
            <div className="tier">
              <div className="presence-dot active" />
              <span style={{ color: 'var(--presence-active)' }}>{presenceCounts.active} active</span>
            </div>
            <div className="tier">
              <div className="presence-dot nearby" />
              <span style={{ color: 'var(--presence-nearby)' }}>{presenceCounts.nearby} nearby</span>
            </div>
            <div className="tier">
              <div className="presence-dot other" />
              <span style={{ color: 'var(--presence-other)' }}>{presenceCounts.other} other</span>
            </div>
          </div>
        </div>

        {/* People you may vibe with — network effect */}
        {vibe && vibe.length > 0 && (
          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(99,102,241,0.06))', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={12} /> People you may vibe with
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.22)' }}>{vibe.length} picks</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vibe.map(r => (
                <TravelerCard
                  key={`vibe-${r.profile.id}`}
                  user={r.profile}
                  isMe={r.profile.id === currentUser.id}
                  mutualTags={r.mutualTags}
                  mutualCount={r.mutualCount}
                  trustBadge={r.trustBadge}
                  trustTier={r.trustTier}
                  rankedScore={Math.round(r.score)}
                  vibeTagline={(r.profile as any).vibeTagline}
                  onTap={() => handleTap(r.profile)}
                  onConnect={() => onConnect(r.profile.id)}
                  onBlock={() => onBlock(r.profile.id)}
                  onReport={() => onReport(r.profile.id, 'General concern')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Traveler Cards — smart ranked */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedUsers.map(user => {
            const r = rankedMap.get(user.id);
            return (
              <TravelerCard
                key={user.id}
                user={user}
                isMe={user.id === currentUser.id}
                mutualTags={r?.mutualTags}
                mutualCount={r?.mutualCount}
                trustBadge={r?.trustBadge}
                trustTier={r?.trustTier}
                rankedScore={r ? Math.round(r.score) : undefined}
                vibeTagline={(user as any).vibeTagline}
                onTap={() => handleTap(user)}
                onConnect={() => onConnect(user.id)}
                onBlock={() => onBlock(user.id)}
                onReport={() => onReport(user.id, 'General concern')}
              />
            );
          })}

          {/* "More travelers" hint */}
          {(room.userCount || 0) > sortedUsers.length && (
            <div style={{
              textAlign: 'center',
              padding: '12px',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 600
            }}>
              + {(room.userCount || 0) - sortedUsers.length} more travelers in this {room.type === 'station' ? 'station' : 'train'}
            </div>
          )}
        </div>

        {/* Chat CTA */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button className="btn-primary" onClick={onOpenChat} style={{ padding: '10px 24px' }}>
            <Users size={14} />
            Open {room.type === 'station' ? 'Station' : 'Train'} Chat
          </button>
        </div>
      </div>

      {/* Profile Drawer */}
      {selectedUser && (
        <ProfileDrawer
          user={selectedUser}
          isMe={selectedUser.id === currentUser.id}
          isFriend={friendIds.includes(selectedUser.id)}
          onClose={() => setSelectedUser(null)}
          onConnect={() => { onConnect(selectedUser.id); setSelectedUser(null); }}
          onBlock={() => { onBlock(selectedUser.id); setSelectedUser(null); }}
          onReport={(reason) => { onReport(selectedUser.id, reason); setSelectedUser(null); }}
          onMessage={() => { setSelectedUser(null); }}
        />
      )}
    </div>
  );
};
