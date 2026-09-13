import { useState, useMemo } from 'react';
import { TravelerCard } from './TravelerCard';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions } from './ProfileSheetActions';
import { EmptyState } from './ui/EmptyState';
import { CarriageFeedSkeleton } from './transit/CarriageFeedSkeleton';
import type { ContextRoom, ContextResult, UserProfile, RankedTraveler } from '../types';
import { Train, Shield } from 'lucide-react';

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
  onReport,
  onProfileOpen
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<'all'|'nearby'|'friends'>('all');
  const handleTap = (u: UserProfile) => { setSelectedUser(u); onProfileOpen?.(u.id); };

  const presenceCounts = room.presence || { active: 0, nearby: 0, other: 0, total: 0 };
  void context;

  const rankedMap = useMemo(() => new Map<string, RankedTraveler>((ranked || []).map(r => [r.profile.id, r])), [ranked]);

  const baseList: UserProfile[] = useMemo(() => {
    if (ranked && ranked.length) {
      const ids = ranked.map(r => r.profile.id);
      const byId = new Map(room.users.map(u => [u.id, u]));
      const ordered = ids.map(id => byId.get(id)).filter(Boolean) as UserProfile[];
      const missing = room.users.filter(u => !ids.includes(u.id));
      return [...ordered, ...missing];
    }
    const order: Record<string, number> = { active:0, nearby:1, other:2 };
    return [...(room.users||[])].sort((a,b)=> (order[a.presenceTier||'other']??2)-(order[b.presenceTier||'other']??2));
  }, [room.users, ranked]);

  const filtered = useMemo(() => {
    if (filter==='friends') return baseList.filter(u => friendIds.includes(u.id));
    if (filter==='nearby') return baseList.filter(u => {
      const t = (u as any).presenceTier as string | undefined;
      return t==='nearby' || t==='active';
    });
    return baseList;
  }, [baseList, filter, friendIds]);

  const nextStation = room.scheduleLabel ? 'Mandi House' : (room.stationName === 'Rajiv Chowk (Connaught Place)' ? 'Mandi House' : 'Noida Sec 18');

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 8 }}>
      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize:20, fontWeight:900, letterSpacing:-0.2 }}>Blue Line</h2>
        <p style={{ fontSize:12, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
          {room.stationName} → {room.direction?.replace('Towards ','') || nextStation} <span style={{ opacity:0.6 }}>⇄</span> <Shield size={14} style={{ color:'var(--text-muted)' }} />
        </p>
      </div>

      {/* Purple travelers online card — Figma 02 */}
      <div style={{
        background:'linear-gradient(135deg, var(--bg-accent-wash-2) 0%, var(--bg-accent-wash) 100%)',
        border:'1px solid rgba(123,93,255,0.28)',
        borderRadius:'var(--radius-xl)',
        padding:14,
        display:'flex',
        alignItems:'center',
        gap:12,
        marginBottom:12
      }}>
        <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent-purple)', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
          <Train size={20} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:6 }}>
            {room.userCount || baseList.length} travelers online <span style={{ width:7,height:7, borderRadius:'50%', background:'var(--presence-active)', boxShadow:'0 0 6px var(--presence-active)', display:'inline-block' }} />
          </div>
          <div style={{ fontSize:12, color:'var(--accent-purple-text)', marginTop:2 }}>Next: {nextStation}</div>
        </div>
      </div>

      {/* Filter tabs — All / Nearby / Friends as in Figma */}
      <div style={{
        display:'flex', gap:6, padding:4, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-full)', marginBottom:12
      }}>
        {[
          { id:'all', label:'All', count: baseList.length },
          { id:'nearby', label:'Nearby', count: presenceCounts.nearby + presenceCounts.active, dot: 'var(--presence-nearby)' },
          { id:'friends', label:'Friends', count: friendIds.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={()=> setFilter(tab.id as any)}
            style={{
              flex:1, padding:'8px 0', borderRadius:'var(--radius-full)', border:'none',
              background: filter===tab.id ? 'var(--accent-purple)' : 'transparent',
              color: filter===tab.id ? 'white' : 'var(--text-muted)',
              fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer'
            }}
          >
            {tab.label} <span style={{ opacity: filter===tab.id?0.9:0.7, fontWeight:700 }}>{tab.count}</span>
            {(tab as any).dot && <span style={{ width:6,height:6, borderRadius:'50%', background:(tab as any).dot, display:'inline-block' }} />}
          </button>
        ))}
      </div>

      {/* Vibe strip */}
      {vibe && vibe.length > 0 && filter==='all' && (
        <div style={{ marginBottom:12, padding:'12px', borderRadius:'var(--radius-lg)', background:'linear-gradient(135deg, rgba(123,93,255,0.10), rgba(139,92,246,0.06))', border:'1px solid rgba(123,93,255,0.14)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--accent-purple-text)', display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            ✨ People you may vibe with <span style={{ marginLeft:'auto', fontSize:11, padding:'2px 6px', borderRadius:999, background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.22)' }}>{vibe.length}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {vibe.map(r=> (
              <TravelerCard
                key={`vibe-${r.profile.id}`}
                user={r.profile}
                isMe={r.profile.id===currentUser.id}
                mutualTags={r.mutualTags}
                mutualCount={r.mutualCount}
                trustBadge={r.trustBadge}
                trustTier={r.trustTier}
                rankedScore={Math.round(r.score)}
                vibeTagline={(r.profile as any).vibeTagline}
                onTap={()=> handleTap(r.profile)}
                onConnect={()=> onConnect(r.profile.id)}
                onBlock={()=> onBlock(r.profile.id)}
                onReport={()=> onReport(r.profile.id, 'General concern')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Traveler list — Figma cards or CarriageFeedSkeleton */}
      {isLoading ? (
        <CarriageFeedSkeleton />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(u => {
            const r = rankedMap.get(u.id);
            return (
              <TravelerCard
                key={u.id}
                user={u}
                isMe={u.id===currentUser.id}
                mutualTags={r?.mutualTags}
                mutualCount={r?.mutualCount}
                trustBadge={r?.trustBadge}
                trustTier={r?.trustTier}
                rankedScore={r ? Math.round(r.score) : undefined}
                vibeTagline={(u as any).vibeTagline}
                isFriend={friendIds.includes(u.id)}
                activeRoomId={room?.id}
                onTap={()=> handleTap(u)}
                onConnect={()=> onConnect(u.id)}
                onBlock={()=> onBlock(u.id)}
                onReport={()=> onReport(u.id, 'General concern')}
              />
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              lineName={room.lineName || context?.lineName || 'Blue Line'}
              stationName={room.stationName || context?.stationName || 'Rajiv Chowk'}
              direction={room.direction || 'Towards Noida'}
            />
          )}
        </div>
      )}

      {/* Traveler Profile Sheet */}
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
              isFriend={friendIds.includes(selectedUser.id)}
              currentContext={context}
              activeRoomId={room?.id}
            />
            <ProfileSheetActions
              initialState={
                selectedUser.id === currentUser.id
                  ? 'already-friends'
                  : friendIds.includes(selectedUser.id)
                    ? 'already-friends'
                    : 'idle'
              }
              onSendRequest={() => onConnect(selectedUser.id)}
              onReport={() => { onReport(selectedUser.id, 'Inappropriate behavior'); setSelectedUser(null); }}
              onBlock={() => { onBlock(selectedUser.id); setSelectedUser(null); }}
            />
          </>
        )}
      </ProfileSheet>
    </div>
  );
};
