import { useState, useMemo, useCallback } from 'react';
import { UserCheckIcon, BroadcastIcon } from '@phosphor-icons/react';
import { TravelerCard } from './TravelerCard';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions, type RequestState } from './ProfileSheetActions';
import { ReportSheet } from './ReportSheet';
import { ContextConfidenceBadge } from './ContextConfidenceBadge';
import { ScreenHeader } from './ui/ScreenHeader';
import { LinePill } from './ui/LinePill';
import { Chip } from './ui/Chip';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { Toast } from './ui/Toast';
import { lineStyle } from '../utils/lineStyle';
import { getLineById } from '../data/metroData';
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
  /** Open check-in / station picker. Shows "Change" next to the location line when set. */
  onChangeStation?: () => void;
  /** Wire to a real notification opt-in for the empty room. Hidden when absent. */
  onEnablePush?: () => void;
  pushEnabled?: boolean;
  /** Set false if the parent already renders a screen header. Default true. */
  showHeader?: boolean;
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

/** Loading placeholder shaped like the rider cards below. */
const RiderSkeleton: React.FC = () => (
  <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span className="sr-only">Loading riders</span>
    {[0, 1, 2].map(i => (
      <div key={i} className="card has-stub" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={48} height={48} borderRadius="var(--radius-squircle)" delayMs={i * 120} />
          <div style={{ flex: 1 }}>
            <Skeleton width="45%" height={16} delayMs={i * 120} />
            <Skeleton width="30%" height={12} style={{ marginTop: 6 }} delayMs={i * 120} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[64, 80, 56].map((w, j) => <Skeleton key={j} width={w} height={32} borderRadius="var(--radius-pill)" delayMs={i * 120 + 60} />)}
        </div>
      </div>
    ))}
  </div>
);

/**
 * People: "who can I meet?". Everything here comes from the live room and the
 * ranking endpoints; nothing is invented. Best matches (shared interests) come
 * first, then everyone else in the room, narrowed by the filter chips. The
 * screen wears the room's line colour.
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
  onProfileOpen,
  onChangeStation,
  onEnablePush,
  pushEnabled,
  showHeader = true
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reportTarget, setReportTarget] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [requested, setRequested] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const dismissNotice = useCallback(() => setNotice(null), []);
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

  const lineId = room.lineId || context?.line;
  const line = lineId ? getLineById(lineId) : undefined;
  const lineName = line?.name || room.lineName || context?.lineName || 'Metro';
  const stationName = room.stationName || context?.stationName || '';
  const dir = shortDirection(room.direction || context?.direction);
  const scope = lineStyle(line?.color || room.lineColor || context?.lineColor);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Everyone', count: people.length },
    { id: 'nearby', label: 'Nearby', count: nearbyList.length },
    { id: 'friends', label: 'Friends', count: friendList.length }
  ];

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

  const showMatches = filter === 'all' && matches.length > 0;
  const where = <span>{stationName}{dir ? `, towards ${dir}` : ''}</span>;
  const pill = <LinePill line={line || room.lineColor} label={lineName.replace(/\s+Line$/i, '')} />;

  return (
    <div className="animate-fade-in" style={{ ...scope, paddingBottom: 8 }}>
      {showHeader ? (
        <ScreenHeader title={`On the ${lineName}`} size="large" subtitle={where} actions={pill} />
      ) : (
        <div className="type-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginBottom: 12 }}>{pill}{where}</div>
      )}

      {context && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '-4px 0 12px' }}>
          <ContextConfidenceBadge context={context} />
          {onChangeStation && (
            <button type="button" className="link-btn" onClick={onChangeStation} aria-label="Change station or direction" style={{ marginRight: -10, flexShrink: 0 }}>
              Change
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div role="group" aria-label="Filter riders" style={{ display: 'flex', gap: 8, margin: '0 -16px 20px', padding: '6px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)} aria-label={`${f.label}, ${f.count}`}>
            {f.label}
            <span className="tnum" style={{ opacity: 0.7, fontWeight: 480 }}>{f.count}</span>
          </Chip>
        ))}
      </div>

      <div aria-live="polite" aria-busy={isLoading || undefined}>
        {isLoading ? (
          <RiderSkeleton />
        ) : (
          <>
            {/* Best matches: shared interests, from /api/vibe */}
            {showMatches && (
              <section aria-labelledby="people-matches" style={{ marginBottom: 24 }}>
                <div className="section-head">
                  <h2 id="people-matches">Best matches</h2>
                  <span className="type-meta" style={{ color: 'var(--text-muted)' }}>Interests you share</span>
                </div>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matches.map(m => {
                    const u = people.find(p => p.id === m.profile.id) || m.profile;
                    return renderCard(u, m.mutualTags);
                  })}
                </div>
              </section>
            )}

            {list.length > 0 && (
              <section aria-labelledby="people-everyone">
                <div className="section-head">
                  <h2 id="people-everyone">{filter === 'friends' ? 'Friends here' : filter === 'nearby' ? 'Close to you' : showMatches ? 'Everyone else here' : 'Everyone here'}</h2>
                  <span className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>{list.length}</span>
                </div>
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map(u => renderCard(u))}
                </div>
              </section>
            )}

            {list.length === 0 && !showMatches && (
              filter === 'all' ? (
                <EmptyState
                  lineName={lineName}
                  stationName={stationName}
                  direction={dir ? `towards ${dir}` : undefined}
                  onBrowseOtherLines={onChangeStation}
                  onEnablePush={onEnablePush}
                  pushEnabled={pushEnabled}
                />
              ) : filter === 'nearby' ? (
                <EmptyState
                  icon={<BroadcastIcon size={24} />}
                  title="No one close to you right now"
                  description="Nearby shows riders active near you in this room. Check back in a minute."
                  action={{ label: 'Show everyone', onClick: () => setFilter('all') }}
                />
              ) : (
                <EmptyState
                  icon={<UserCheckIcon size={24} />}
                  title="None of your friends are here"
                  description="Friends show up here when they ride the same line. Say hi to people you meet to build your list."
                  action={{ label: 'Show everyone', onClick: () => setFilter('all') }}
                />
              )
            )}
          </>
        )}
      </div>

      {/* Rider profile sheet */}
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
              room={room}
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

      {/* Report flow: reason, note, optional block; posts /api/reports itself */}
      <ReportSheet
        open={reportTarget !== null}
        traveler={reportTarget ? toPresenceTraveler(reportTarget) : null}
        currentUserId={currentUser.id}
        onClose={() => setReportTarget(null)}
        onReported={(msg) => { setReportTarget(null); setNotice(msg || 'Report sent. Thank you.'); }}
        onBlocked={(id) => setHidden(prev => new Set(prev).add(id))}
      />

      <Toast message={notice} onDismiss={dismissNotice} />
    </div>
  );
};
