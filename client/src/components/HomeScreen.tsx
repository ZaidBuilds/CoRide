import { Train, Users, Sparkles, ChevronRight, MapPin } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import type { UserProfile, ContextRoom, RankedTraveler } from '../types';
import type { EngagementSnapshot } from '../types/engagement';

/** CoRide peaks on the evening commute as much as the morning — greeting follows the clock. */
function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  /** Open a traveler's profile sheet. Without it, tapping a person opens People. */
  onOpenProfile?: (u: UserProfile) => void;
  onShowNotifications?: () => void;
  onOpenLiveTracking?: () => void;
  onOpenCheckIn?: () => void;
}

interface AroundItem {
  profile: UserProfile;
  shared: number;
}

const GAME_TITLES: Record<string, string> = {
  word_chain: 'Word Chain',
  trivia: 'Fast Trivia',
  twenty_q: '20 Questions',
  prompt: 'Prompt Wall'
};

/** Presence-room id (`station:line:direction`) for the live context, as RoomScreen expects. */
function presenceRoomId(room: ContextRoom | null): string | undefined {
  if (!room?.stationId || !room.lineId || !room.direction) return undefined;
  const slug = (s: string, max: number) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
  const id = `${slug(room.stationId, 40)}:${slug(room.lineId, 30)}:${slug(room.direction, 40)}`;
  return /^[a-z0-9_]{1,40}:[a-z0-9_]{1,30}:[a-z0-9_]{1,40}$/.test(id) ? id : undefined;
}

function firstName(pseudonym: string): string {
  return pseudonym.split('_')[0] || pseudonym;
}

/**
 * Home — "who's around me?". Three real signals only: where you are (live
 * context), who is there (room presence, best matches first), and live games
 * in your rooms. No placeholder rooms, schedules or match scores.
 */
export const HomeScreen: React.FC<Props> = ({
  user, contextStationName, contextLineName, stationRoom, trainRoom, vibe, engagement,
  onViewAllPeople, onJoinRoom, onOpenRoom, onOpenProfile, onOpenCheckIn
}) => {
  const greeting = greetingFor(new Date().getHours());
  const liveRoom = trainRoom || stationRoom;
  const detecting = !liveRoom;
  const line = contextLineName || liveRoom?.lineName;
  const station = contextStationName || liveRoom?.stationName;
  const lineColor = liveRoom?.lineColor || 'var(--accent-purple)';
  const direction = (trainRoom?.direction || stationRoom?.direction || '').replace(/^Towards\s+/i, '');
  const presenceId = presenceRoomId(trainRoom) || presenceRoomId(stationRoom);

  // Around you: best matches (shared interests) first, then everyone else in
  // your rooms. Never yourself, never duplicates, and only real shared counts.
  const aroundItems: AroundItem[] = [];
  const seen = new Set<string>(user ? [user.id] : []);
  for (const r of vibe || []) {
    if (seen.has(r.profile.id)) continue;
    seen.add(r.profile.id);
    aroundItems.push({ profile: r.profile, shared: r.mutualCount || 0 });
  }
  for (const u of [...(trainRoom?.users || []), ...(stationRoom?.users || [])]) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const shared = user ? u.interestTags?.filter(t => user.interestTags?.includes(t)).length || 0 : 0;
    aroundItems.push({ profile: u, shared });
  }
  const shown = aroundItems.slice(0, 8);
  const othersCount = aroundItems.length;

  // Live games in your own rooms (real engagement snapshots only).
  const liveGames: { roomId: string; title: string; desc: string; players: number }[] = [];
  for (const snap of Object.values(engagement || {})) {
    const g = snap.activeGame as { type?: string; players?: unknown[]; currentPrompt?: { text?: string } } | null;
    if (!g?.type) continue;
    const players = Array.isArray(g.players) ? g.players.length : 0;
    liveGames.push({
      roomId: snap.roomId,
      title: GAME_TITLES[g.type] || g.type.replace(/_/g, ' '),
      desc: g.type === 'prompt'
        ? (g.currentPrompt?.text?.slice(0, 60) || 'Share your answer')
        : players > 0 ? `${players} playing now` : 'Starting now',
      players
    });
  }

  const openGame = (roomId: string) => {
    // Games are played in the People tab's room hub for your current room;
    // a game in your other room opens that room's chat.
    if (liveRoom && roomId === liveRoom.id) onViewAllPeople();
    else onJoinRoom(roomId);
  };

  const openPerson = (u: UserProfile) => (onOpenProfile ? onOpenProfile(u) : onViewAllPeople());

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="app-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, margin: 0 }}>CoRide</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {greeting}{user ? `, ${firstName(user.pseudonym)}` : ''}
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Live context — where you are right now */}
      <section
        aria-label="Your current ride"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-xl)',
          padding: 16,
          marginBottom: 16,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {detecting ? (
          <div aria-busy="true" aria-live="polite">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Skeleton width={44} height={44} borderRadius="50%" />
              <div style={{ flex: 1 }}>
                <Skeleton width="45%" height={12} />
                <Skeleton width="75%" height={16} style={{ marginTop: 8 }} />
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '12px 0 0' }}>Finding your station…</p>
            {onOpenCheckIn && (
              <Button variant="secondary" size="sm" icon={<MapPin size={16} />} onClick={onOpenCheckIn} style={{ marginTop: 12 }}>
                Pick my station
              </Button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: lineColor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Train size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--presence-active)' }} />
                  {trainRoom ? 'On the train' : 'At the station'}
                  {line ? ` · ${line}` : ''}
                </div>
<div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                  {station}
                </div>
                {direction && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>
                    Towards {direction}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {onOpenRoom && (
                <Button variant="primary" size="sm" fullWidth style={{ flex: 1 }} onClick={() => onOpenRoom(presenceId)}>
                  View room
                </Button>
              )}
              {onOpenCheckIn && (
                <Button variant="secondary" size="sm" fullWidth style={{ flex: 1 }} onClick={onOpenCheckIn}>
                  Change station
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Around you now */}
      <section aria-labelledby="home-around" className="glass-panel" style={{ padding: 16, marginBottom: 16 }}>
        <div className="section-head" style={{ marginBottom: 4 }}>
          <h3 id="home-around">Around you now</h3>
          {othersCount > 0 && (
            <button type="button" onClick={onViewAllPeople} className="link" style={{ minHeight: 'var(--tap)', display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: 'var(--accent-purple-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              See all <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {detecting ? (
          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }} aria-hidden="true">
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ flex: '0 0 72px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Skeleton width={60} height={60} borderRadius="50%" delayMs={i * 120} />
                <Skeleton width={48} height={10} delayMs={i * 120} />
              </div>
            ))}
          </div>
        ) : shown.length > 0 ? (
          <>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, margin: '0 0 12px' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--presence-active)' }} />
              {othersCount} {othersCount === 1 ? 'person' : 'people'} in your rooms
            </p>
            <ul
              style={{ display: 'flex', gap: 8, overflowX: 'auto', listStyle: 'none', margin: '0 -16px', padding: '0 16px 4px', scrollbarWidth: 'none' }}
            >
              {shown.map(({ profile: p, shared }) => (
                <li key={p.id} style={{ flex: '0 0 76px', width: 76, minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => openPerson(p)}
                    aria-label={`${p.pseudonym}${shared ? `, ${shared} interest${shared === 1 ? '' : 's'} in common` : ''}. View profile`}
                    style={{ width: 76, minWidth: 0, minHeight: 'var(--tap)', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 'var(--radius-md)' }}
                  >
                    <div className="avatar-wrap" style={{ width: 60, height: 60, marginBottom: 6 }}>
                      <div className="avatar" style={{ width: 60, height: 60, background: p.avatarBg, fontSize: 16 }}>
                        {p.pseudonym.slice(0, 2).toUpperCase()}
                      </div>
                      {p.presenceTier && <div className={`avatar-dot ${p.presenceTier}`} />}
                    </div>
                    <span style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {firstName(p.pseudonym)}
                    </span>
                    {shared > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2, fontSize: 11, fontWeight: 700, color: 'var(--accent-purple-text)', whiteSpace: 'nowrap' }}>
                        <Sparkles size={11} aria-hidden="true" /> {shared} shared
                      </span>
                    ) : (
                      <span style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>&nbsp;</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          // Honest zero-state: context + one action.
          <div style={{ textAlign: 'center', padding: '16px 8px 4px' }}>
            <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-surface-raised)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginBottom: 10 }}>
              <Users size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>No one else here yet</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px auto 0', lineHeight: 1.5, maxWidth: 300 }}>
              People riding with you appear here as they check in. Wrong station? Update it so you land in the right room.
            </p>
            {onOpenCheckIn && (
              <Button variant="secondary" size="sm" icon={<MapPin size={16} />} onClick={onOpenCheckIn} style={{ marginTop: 14 }}>
                Change station
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Live games — only when a real game is running in one of your rooms */}
      {liveGames.length > 0 && (
        <section aria-labelledby="home-live-games">
          <div className="section-head">
            <h3 id="home-live-games">Live in your rooms</h3>
          </div>
          <div className="list-group" style={{ marginBottom: 0 }}>
            {liveGames.map(g => (
              <button
                key={g.roomId}
                type="button"
                className="list-row navigable"
                onClick={() => openGame(g.roomId)}
                style={{ minHeight: 64 }}
              >
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple-text)', flexShrink: 0 }}>
                  <Sparkles size={18} />
                </span>
                <span className="row-text">
                  <span className="row-title">{g.title}</span>
                  <span className="row-sub">{g.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
