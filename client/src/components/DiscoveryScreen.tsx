import { useState, useMemo } from 'react';
import { TravelerCard } from './TravelerCard';
import { ProfileDrawer } from './ProfileDrawer';
import type { ContextRoom, ContextResult, UserProfile, RankedTraveler } from '../types';
import { Train, Users, Shield, Info, SlidersHorizontal, Search } from 'lucide-react';

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
  const nextTime = '9:15 AM';

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
          <div style={{ fontSize:12, color:'var(--accent-purple-text)', marginTop:2 }}>Next: {nextStation} ({nextTime})</div>
        </div>
        <button style={{
          padding:'7px 12px', borderRadius:'var(--radius-full)', background:'rgba(123,93,255,0.18)', border:'1px solid rgba(123,93,255,0.32)', color:'var(--accent-purple-text)', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6
        }}>
          <Info size={12}/> Train Info
        </button>
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

      {/* Traveler list — Figma cards */}
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
              onTap={()=> handleTap(u)}
              onConnect={()=> onConnect(u.id)}
              onBlock={()=> onBlock(u.id)}
              onReport={()=> onReport(u.id, 'General concern')}
            />
          );
        })}
        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:12, border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
            No travelers in this filter — try All
          </div>
        )}
      </div>

      {/* Bottom actions as in Figma 02 — Filters + Search floating */}
      <div style={{ display:'flex', justifyContent:'center', marginTop:14, gap:10 }}>
        <button style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-card)', color:'var(--text-secondary)', fontWeight:700, fontSize:12 }}>
          <SlidersHorizontal size={14}/> Filters
        </button>
        <button aria-label="Search travellers" style={{ width:44, height:44, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-card)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)' }}>
          <Search size={18}/>
        </button>
      </div>

      {/* Chat CTA hidden -> moved to Home Quick Actions, but keep for station/train chat */}
      <div style={{ display:'flex', justifyContent:'center', marginTop:14 }}>
        <button onClick={onOpenChat} style={{ padding:'10px 18px', borderRadius:'var(--radius-full)', background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.28)', color:'var(--accent-purple-text)', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
          <Users size={14}/> Open {room.type==='station'?'Station':'Train'} Chat
        </button>
      </div>

      {selectedUser && (
        <ProfileDrawer
          user={selectedUser}
          isMe={selectedUser.id===currentUser.id}
          isFriend={friendIds.includes(selectedUser.id)}
          onClose={()=> setSelectedUser(null)}
          onConnect={()=> { onConnect(selectedUser.id); setSelectedUser(null); }}
          onBlock={()=> { onBlock(selectedUser.id); setSelectedUser(null); }}
          onReport={(reason)=> { onReport(selectedUser.id, reason); setSelectedUser(null); }}
          onMessage={()=> setSelectedUser(null)}
        />
      )}
    </div>
  );
};
