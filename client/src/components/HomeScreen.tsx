import { Train, Users, Map } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { UserProfile, ContextRoom, RankedTraveler } from '../types';
import type { EngagementSnapshot } from '../types/engagement';

/** CoRide peaks on the evening commute as much as the morning — greeting follows the clock. */
function greetingFor(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface Props {
  user: UserProfile | null;
  contextStationName?: string;
  contextLineName?: string;
  stationRoom: ContextRoom | null;
  trainRoom: ContextRoom | null;
  vibe?: RankedTraveler[];
  engagement?: Record<string, EngagementSnapshot>;
  onViewAllPeople: () => void;
  onJoinRoom: (roomId: string) => void;
  onOpenRoom?: (roomId?: string) => void;
  onShowNotifications?: () => void;
  onOpenLiveTracking?: () => void;
  onOpenCheckIn?: () => void;
}

export const HomeScreen: React.FC<Props> = ({ user, contextStationName, contextLineName, stationRoom, trainRoom, vibe, engagement, onViewAllPeople, onJoinRoom, onOpenRoom, onOpenLiveTracking, onOpenCheckIn }) => {
  const greeting = greetingFor(new Date().getHours());
  const nearbyCount = stationRoom?.userCount || trainRoom?.userCount || 0;
  const line = contextLineName || trainRoom?.lineName || 'Blue Line';
  const station = contextStationName || trainRoom?.stationName || 'Rajiv Chowk';
  const next = trainRoom?.stationName ? 'Mandi House' : 'Noida Sec 18';

  // Build Around You Now avatars — use vibe or first 6 station users
  const around = vibe && vibe.length ? vibe : (stationRoom?.users.slice(0,6) || trainRoom?.users.slice(0,6) || []);
  // For around, we need to map RankedTraveler[] vs UserProfile[] — normalize
  const aroundItems: { id: string; name: string; bg: string; match: number; avatar?: string; tier?: string }[] =
    (around as any).slice(0,6).map((r: any, idx: number) => {
      if (r.profile) {
        const pct = Math.max(65, 90 - idx*5); // 90,80,75,70,65
        return { id: r.profile.id, name: r.profile.pseudonym.split('_')[0] || r.profile.pseudonym, bg: r.profile.avatarBg, match: pct, tier: r.profile.presenceTier };
      } else {
        const u = r as UserProfile;
        const pct = 90 - idx*5;
        return { id: u.id, name: u.pseudonym.split('_')[0] || u.pseudonym, bg: u.avatarBg, match: pct, tier: (u as any).presenceTier };
      }
    });

  // Active rooms from real engagement rooms only — no demo fallbacks.
  const activeRooms: { id: string; title: string; desc: string; emoji: string; count: number }[] = [];
  if (engagement) {
    for (const snap of Object.values(engagement)) {
      if (snap.activeGame) {
        const g: any = snap.activeGame;
        const titleMap: Record<string,string> = { word_chain: 'Word Chain', trivia: 'Fast Trivia', twenty_q: '20 Questions', prompt: 'Prompt Wall' };
        activeRooms.push({ id: snap.roomId, title: `${titleMap[g.type] || g.type} • Live`, desc: g.type==='prompt' ? g.currentPrompt?.text?.slice(0,28) || 'Share your vibe' : `${g.players?.length || 0} playing`, emoji: g.type==='trivia'?'⚡':g.type==='prompt'?'💬':'🎮', count: g.players?.length || 0 });
      }
    }
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Header — sticky frosted bar; content scrolls under it */}
      <div className="app-header">
        <div style={{ minWidth:0 }}>
          <h1 className="display" style={{ fontSize:24, fontWeight:700, letterSpacing:-0.6, margin:0 }}>CoRide</h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:1 }}>
            {greeting}, {user ? user.pseudonym.split('_')[0] : 'there'} <span>👋</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <ThemeToggle />
        </div>
      </div>

      {/* On Ride */}
      <div
        style={{
          background:'var(--bg-accent-wash)',
          border:'1px solid var(--border-purple)',
          borderRadius:'var(--radius-xl)',
          padding:14,
          display:'flex',
          alignItems:'center',
          gap:12,
          marginBottom:16,
          cursor: onOpenRoom ? 'pointer' : 'default'
        }}
        onClick={() => onOpenRoom && onOpenRoom()}
      >
        <div className="avatar" style={{ width:42, height:42, background:'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))' }}>
          <Train size={20} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13, color:'var(--accent-purple-text)', fontWeight:700 }}>On Ride · Live Presence</span>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--presence-active)' }} />
          </div>
          <div style={{ fontSize:14, color:'var(--text-primary)', fontWeight:600 }}>{line} • {station} → {next}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onOpenCheckIn && (
            <button
              className="btn-secondary press"
              style={{
                background: 'var(--ink-700)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 'var(--radius-pill)',
                minHeight: 40
              }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenCheckIn();
              }}
            >
              Check In
            </button>
          )}
          <button
            className="btn-secondary press"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-purple)',
              color: 'var(--accent-purple-text)',
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 'var(--radius-pill)',
              minHeight: 40
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenRoom) onOpenRoom();
            }}
          >
            View Room
          </button>
        </div>
      </div>

      {/* Live Metro Map & Subway Route Tracker Tile */}
      <div
        className="glass-thick press"
        style={{
          borderRadius: 'var(--radius-xl)',
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(123, 93, 255, 0.15))',
          border: '1px solid rgba(56, 189, 248, 0.25)'
        }}
        onClick={() => onOpenLiveTracking && onOpenLiveTracking()}
      >
        <div className="avatar" style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #0284c7, #38bdf8)' }}>
          <Map size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 800 }}>Delhi Metro Live Map</span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>10 Lines</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Friends Transit Map & Route Diagram</div>
        </div>
        <button
          className="btn-secondary press"
          style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '6px 12px', fontSize: 13, fontWeight: 700 }}
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenLiveTracking) onOpenLiveTracking();
          }}
        >
          Open Map
        </button>
      </div>

      {/* Around You Now */}
      <div className="glass-panel" style={{ padding:16, marginBottom:16 }}>
        <div className="section-head" style={{ marginBottom:6 }}>
          <h3>Around You Now</h3>
          <button onClick={onViewAllPeople} className="link">View all</button>
        </div>
        {/* Only claim a live count when there is one — the old `|| 74` fallback
            contradicted the empty state directly below it. */}
        {nearbyCount > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
            <div style={{ width:7,height:7, borderRadius:'50%', background:'var(--presence-active)', boxShadow:'0 0 6px var(--presence-active)' }} />
            <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:600 }}>
              {nearbyCount} {nearbyCount === 1 ? 'person' : 'people'} nearby
            </span>
          </div>
        )}
        <div style={{ display: aroundItems.length ? 'flex' : 'block', gap:12, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {aroundItems.length ? aroundItems.map(it => (
            <div key={it.id} style={{ flex:'0 0 72px', textAlign:'center' }}>
              <div className="avatar-wrap" style={{ width:64, height:64, margin:'0 auto 6px' }}>
                <div className="avatar" style={{ width:64, height:64, background: it.bg, fontSize:15 }}>
                  {it.name[0]}
                </div>
                <div className={`avatar-dot ${it.tier === 'nearby' ? 'nearby' : it.tier === 'other' ? 'other' : 'active'}`} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.name}</div>
              <span className="tag-pill active" style={{ marginTop:4, padding:'3px 8px', fontSize:11, fontWeight:800 }}>{it.match}% Match</span>
            </div>
          )) : (
            // Empty state — context + one action, rather than a row of grey voids
            <div style={{ textAlign:'center', padding:'20px 12px' }}>
              <div style={{ width:48,height:48, borderRadius:'50%', background:'var(--bg-surface)', border:'1px solid var(--border-card)', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', marginBottom:10 }}>
                <Users size={22} />
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Nobody nearby yet</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4, lineHeight:1.5 }}>
                Set your station and we'll show who's riding with you.
              </div>
              <button onClick={onViewAllPeople} className="btn-secondary" style={{ marginTop:12 }}>Set my station</button>
            </div>
          )}
        </div>
      </div>

      {/* Active Rooms */}
      <div className="section-head">
        <h3>Active Rooms</h3>
        <button onClick={onViewAllPeople} className="link">View all</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {activeRooms.map(rm=>(
          <div key={rm.id} className="glass-panel" style={{ padding:14, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
                {rm.title} <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>👥 {rm.count}</span>
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{rm.desc}</div>
            </div>
            <button
              onClick={() => {
                if (rm.id.includes(':') && onOpenRoom) {
                  onOpenRoom(rm.id);
                } else {
                  onJoinRoom(rm.id);
                }
              }}
              className="btn-primary press"
              style={{ padding:'8px 18px', fontSize:13 }}
            >
              Join
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
