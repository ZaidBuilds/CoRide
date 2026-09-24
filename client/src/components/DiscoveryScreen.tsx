import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserCheck, Radar, Share2, Check } from 'lucide-react';
import { TravelerCard } from './TravelerCard';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions, type RequestState } from './ProfileSheetActions';
import { ReportSheet } from './ReportSheet';
import { Button } from './ui/Button';
import { CarriageFeedSkeleton } from './transit/CarriageFeedSkeleton';
import type { ContextRoom, ContextResult, UserProfile, RankedTraveler, RoomPresenceTraveler } from '../types';

interface Props {
  room: ContextRoom;
  context: ContextResult | null;
  currentUser: UserProfile;
  friendIds: string[];
  ranked?: RankedTraveler[];
  vibe?: RankedTraveler[];
  isLoading?: boolean;
  onConnect: (targetUserId: string) => void;
  onBlock: (targetUserId: string) => void;
  onReport: (targetUserId: string, reason: string) => void;
  onProfileOpen?: (targetUserId: string) => void;
}

type Filter = 'all' | 'nearby' | 'friends';

function shortDirection(dir?: string): string {
  return (dir || '').replace(/^Towards\s+/i, '').trim();
}

function intersect(a: string[] = [], b: string[] = []): string[] {
  const set = new Set(b);
  return a.filter(t => set.has(t));
}

function toPresenceTraveler(u: UserProfile): RoomPresenceTraveler {
  return {
    id: u.id,
    username: u.username,
    pseudonym: u.pseudonym,
    avatarId: u.avatarId,
    avatarBg: u.avatarBg,
    interestTags: u.interestTags,
    bio: u.bio || '',
    trustTier: u.trustTier,
    presenceState: 'active'
  };
}

/**
 * People — "who can I meet?". Everything here comes from the live room and the
 * ranking endpoints; nothing is invented. Best matches (shared interests) come
 * first, then everyone else in the room, narrowed by the filter tabs.
 */
export const DiscoveryScreen: React.FC<Props> = ({
  room,
  context,
  currentUser,
  friendIds,
  ranked,
  vibe,
  isLoading = false,
  onConnect,
  onBlock,
  onProfileOpen
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [requested, setRequested] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const handleTap = (u: UserProfile) => { setSelectedUser(u); onProfileOpen?.(u.id); };
  const sendRequest = (id: string) => {
    onConnect(id);
    setRequested(prev => new Set(prev).add(id));
  };
  const blockUser = (id: string) => {
    onBlock(id);
    setHidden(prev => new Set(prev).add(id));
  };

  const friendSet = useMemo(() => new Set(friendIds), [friendIds]);
  const rankedMap = useMemo(() => new Map<string, RankedTraveler>((ranked || []).map(r => [r.profile.id, r])), [ranked]);

  // Everyone in the room except you and anyone you've blocked, best-ranked first.
  const people: UserProfile[] = useMemo(() => {
    const seen = new Set<string>([currentUser.id]);
    const users = (room.users || []).filter(u => {
      if (seen.has(u.id) || hidden.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    if (ranked && ranked.length) {
      const pos = new Map(ranked.map((r, i) => [r.profile.id, i]));
      return [...users].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
    }
    const order: Record<string, number> = { active: 0, nearby: 1, other: 2 };
    return [...users].sort((a, b) => (order[a.presenceTier || 'other'] ?? 2) - (order[b.presenceTier || 'other'] ?? 2));
  }, [room.users, ranked, currentUser.id, hidden]);

  const nearbyList = useMemo(() => people.filter(u => u.presenceTier === 'active' || u.presenceTier === 'nearby'), [people]);
  const friendList = useMemo(() => people.filter(u => friendSet.has(u.id)), [people, friendSet]);

  // Best matches: only people actually in the room with at least one shared interest.
  const matches = useMemo(() => {
    const inRoom = new Set(people.map(p => p.id));
    return (vibe || []).filter(r => inRoom.has(r.profile.id) && (r.mutualCount || 0) > 0);
  }, [vibe, people]);
  const matchIds = useMemo(() => new Set(matches.map(m => m.profile.id)), [matches]);

  const list = filter === 'friends' ? friendList
    : filter === 'nearby' ? nearbyList
      : people.filter(u => !matchIds.has(u.id));

  const sharedFor = (u: UserProfile) => rankedMap.get(u.id)?.mutualTags ?? intersect(currentUser.interestTags, u.interestTags);
  const cardState = (id: string) => (friendSet.has(id) ? 'friends' : requested.has(id) ? 'sent' : 'idle') as 'idle' | 'sent' | 'friends';
  const sheetState = (id: string): RequestState =>
    id === currentUser.id ? 'self' : friendSet.has(id) ? 'already-friends' : requested.has(id) ? 'sent' : 'idle';

  const lineName = room.lineName || context?.lineName || 'Metro';
  const lineColor = room.lineColor || context?.lineColor || 'var(--accent-purple)';
  const stationName = room.stationName || context?.stationName || '';
  const dir = shortDirection(room.direction || context?.direction);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: people.length },
    { id: 'nearby', label: 'Nearby', count: nearbyList.length },
    { id: 'friends', label: 'Friends', count: friendList.length }
  ];

  const invite = async () => {
    const text = `I'm on the ${lineName}${stationName ? ` at ${stationName}` : ''}. Join me on CoRide to meet people on your commute.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CoRide', text, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const renderCard = (u: UserProfile, mutual?: string[]) => {
    const r = rankedMap.get(u.id);
    return (
      <TravelerCard
        key={u.id}
        user={u}
        isMe={false}
        mutualTags={mutual ?? sharedFor(u)}
        trustBadge={r?.trustBadge ?? u.trustBadge}
        trustTier={r?.trustTier ?? u.trustTier}
        vibeTagline={u.vibeTagline}
        isFriend={friendSet.has(u.id)}
        activeRoomId={room.id}
        requestState={cardState(u.id)}
        onTap={() => handleTap(u)}
        onConnect={() => sendRequest(u.id)}
      />
    );
  };

  const emptyCopy: Record<Filter, { icon: React.ReactNode; title: string; body: string }> = {
    all: {
      icon: <Users size={26} />,
      title: 'No one else here yet',
      body: `${stationName ? `${stationName} · ` : ''}${lineName}. People who check in here show up automatically — this list refreshes on its own.`
    },
    nearby: {
      icon: <Radar size={26} />,
      title: 'No one nearby right now',
      body: 'Nearby shows people who are active close to you. Check back in a minute, or browse everyone in this room.'
    },
    friends: {
      icon: <UserCheck size={26} />,
      title: 'None of your friends are here',
      body: 'Friends show up here when they ride the same line. Send requests to people you meet to build your list.'
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 8 }}>
      {/* Where you are — real line colour, station and direction only */}
      <div style={{ marginBottom: 14 }}>
        <h2 className="display" style={{ fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
          <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: lineColor, flexShrink: 0 }} />
          People on {lineName}
        </h2>
        {(stationName || dir) && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {stationName}{dir ? ` → ${dir}` : ''}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="segmented" role="tablist" aria-label="Filter people" style={{ marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`people-tab-${tab.id}`}
            aria-selected={filter === tab.id}
            aria-controls="people-panel"
            className="segmented-option"
            onClick={() => setFilter(tab.id)}
            style={{ minHeight: 42 }}
          >
            {tab.label}
            <span style={{ fontWeight: 600, opacity: 0.7 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div id="people-panel" role="tabpanel" aria-labelledby={`people-tab-${filter}`}>
        {isLoading ? (
          <CarriageFeedSkeleton />
        ) : (
          <>
            {/* Best matches — shared interests, from /api/vibe */}
            {filter === 'all' && matches.length > 0 && (
              <section aria-labelledby="people-matches" style={{ marginBottom: 20 }}>
                <div className="section-head">
                  <h3 id="people-matches" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Best matches
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Shared interests</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {matches.map(m => {
                    const u = people.find(p => p.id === m.profile.id) || m.profile;
                    return renderCard(u, m.mutualTags);
                  })}
                </div>
              </section>
            )}

            {list.length > 0 && (
              <section aria-labelledby="people-everyone">
                {filter === 'all' && matches.length > 0 && (
                  <div className="section-head">
                    <h3 id="people-everyone">Everyone else here</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{list.length}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map(u => renderCard(u))}
                </div>
              </section>
            )}

            {list.length === 0 && !(filter === 'all' && matches.length > 0) && (
              <div
                role="status"
                style={{
                  textAlign: 'center', padding: '28px 20px', borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)'
                }}
              >
                <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface-raised)', color: 'var(--text-secondary)' }}>
                  {emptyCopy[filter].icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{emptyCopy[filter].title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '6px auto 16px', maxWidth: 320 }}>
                  {emptyCopy[filter].body}
                </p>
                {filter === 'all' ? (
                  <Button variant="secondary" icon={shared ? <Check size={16} /> : <Share2 size={16} />} onClick={invite}>
                    {shared ? 'Link copied' : 'Invite someone'}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setFilter('all')}>Show everyone</Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Traveler profile sheet */}
      <ProfileSheet
        open={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        labelledBy="discovery-profile-title"
      >
        {selectedUser && (
          <>
            <ProfileSheetContent
              traveler={selectedUser}
              titleId="discovery-profile-title"
              isFriend={friendSet.has(selectedUser.id)}
              currentContext={context}
              activeRoomId={room.id}
              sharedTags={sharedFor(selectedUser)}
            />
            <ProfileSheetActions
              key={selectedUser.id}
              travelerName={selectedUser.pseudonym}
              initialState={sheetState(selectedUser.id)}
              onSendRequest={() => sendRequest(selectedUser.id)}
              onReport={() => { setReportTarget(selectedUser); setSelectedUser(null); }}
              onBlock={() => { blockUser(selectedUser.id); setSelectedUser(null); setNotice(`${selectedUser.pseudonym} is blocked`); }}
            />
          </>
        )}
      </ProfileSheet>

      {/* Report flow — reason, note, optional block; posts /api/reports itself */}
      <ReportSheet
        open={reportTarget !== null}
        traveler={reportTarget ? toPresenceTraveler(reportTarget) : null}
        currentUserId={currentUser.id}
        onClose={() => setReportTarget(null)}
        onReported={(msg) => { setReportTarget(null); setNotice(msg || 'Report submitted. Thank you.'); }}
        onBlocked={(id) => setHidden(prev => new Set(prev).add(id))}
      />

      {notice && createPortal(
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(var(--nav-offset) + 12px)', zIndex: 45,
            maxWidth: 'calc(100% - 32px)', padding: '12px 18px', borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
            animation: 'fadeIn var(--dur-std) var(--ease-enter)'
          }}
        >
          {notice}
        </div>,
        document.body
      )}
    </div>
  );
};
