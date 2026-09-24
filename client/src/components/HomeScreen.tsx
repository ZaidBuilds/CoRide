import { useEffect, useMemo, useState } from 'react';
import { ArrowRightIcon, MapPinIcon, SwapIcon, UsersIcon, GameControllerIcon } from '@phosphor-icons/react';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { StationSign } from './ui/StationSign';
import { LineRail } from './ui/LineRail';
import { PresenceStack } from './ui/PresenceStack';
import { Avatar } from './ui/Avatar';
import { BrandMark } from './ui/BrandMark';
import { ListGroup, ListRow } from './ui/ListRow';
import { lineStyle } from '../utils/lineStyle';
import { getLineById, getStationById } from '../data/metroData';
import { describeContext } from '../utils/commuteContext';
import type { UserProfile, ContextRoom, RankedTraveler, ContextResult } from '../types';
import type { LocationContext } from '../hooks/useLocationContext';
import type { EngagementSnapshot } from '../types/engagement';

/** CoRide peaks on the evening commute as much as the morning; the greeting follows the clock. */
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
  /** Full detector result (engine v2). Drives the honest wording and the line rail. */
  context?: LocationContext | ContextResult | null;
  /** One-tap "Yes, I'm here" for a low-confidence guess ("Near Rajiv Chowk?"). Wire to useLocationContext().confirm. */
  onConfirmContext?: () => unknown;
  /** Rendered after "Riding with you", e.g. <SavedCommutes />. */
  children?: React.ReactNode;
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

const TIER_WORD: Record<string, string> = { active: 'Here now', nearby: 'Nearby', other: 'Earlier' };

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

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function agoLabel(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ago`;
}

/**
 * Home: "your platform". A DMRC-style sign for where you are (and how we
 * know), the stretch of line around you, who is riding with you, then your
 * saved commutes. The whole screen wears the current line's colour. Only real
 * signals: no placeholder rooms, schedules or match scores.
 */
export const HomeScreen: React.FC<Props> = ({
  user, contextStationName, contextLineName, stationRoom, trainRoom, vibe, engagement,
  onViewAllPeople, onJoinRoom, onOpenRoom, onOpenProfile, onOpenCheckIn,
  context, onConfirmContext, children
}) => {
  const greeting = greetingFor(new Date().getHours());
  const liveRoom = trainRoom || stationRoom;
  const presenceId = presenceRoomId(trainRoom) || presenceRoomId(stationRoom);
  const ctx = (context ?? null) as LocationContext | null;

  // "N min ago" should age honestly, so re-render on a slow tick.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Resolve the line and station from metroData so names, Hindi and colours are canonical.
  const noSignal = ctx?.source === 'none';
  const lineId = (noSignal ? undefined : ctx?.line) || liveRoom?.lineId;
  const line = lineId ? getLineById(lineId) : undefined;
  const stationId = (noSignal ? undefined : ctx?.station) || liveRoom?.stationId;
  const station = (stationId && (line?.stations.find(s => s.id === stationId) || getStationById(stationId))) || undefined;
  const stationName = station?.name || (noSignal ? undefined : contextStationName) || liveRoom?.stationName;
  const lineName = line?.name || contextLineName || liveRoom?.lineName;
  const direction = (ctx?.direction || trainRoom?.direction || stationRoom?.direction || '').replace(/^Towards\s+/i, '').trim();
  const hasPlace = !!stationName && !noSignal;

  // Honest wording (DESIGN.md §9): never claim more than the confidence supports.
  const described = describeContext(
    ctx
      ? { ...ctx, stationName: ctx.stationName || stationName || '', lineName: ctx.lineName || lineName || '' }
      : hasPlace
        ? { context: trainRoom ? 'train' : 'station', confidence: 1, stationName: stationName!, lineName: lineName || '', source: 'manual' }
        : null,
    now
  );
  const confident = hasPlace && !described.needsConfirm;
  const onTrain = ctx ? ctx.context === 'train' && confident : !!trainRoom;
  const between = ctx?.movement === 'in_vehicle' && ctx.between ? ctx.between : null;
  const fixAgo = ctx?.source === 'gps' && ctx.lastFixAt ? agoLabel(Math.max(0, now - ctx.lastFixAt)) : null;
  const metaLine = hasPlace ? `${described.meta}${fixAgo ? ` · ${fixAgo}` : ''}` : null;

  // The stretch of line around you, drawn in the direction of travel.
  const fromId = between?.fromStationId || station?.id;
  const dirKey = ctx?.directionKey;
  const rail = useMemo(() => {
    if (!line || !fromId) return null;
    const stops = line.stations.map(s => ({ id: s.id, name: s.name.replace(/\s*\(.*\)\s*$/, '') }));
    const first = line.stations[0]?.name || '';
    const d = norm(direction);
    const reverse = dirKey ? dirKey === 'towards_a' : !!d && (norm(line.terminalA).includes(d) || d.includes(norm(first)));
    const ordered = reverse ? [...stops].reverse() : stops;
    const index = ordered.findIndex(s => s.id === fromId);
    return index >= 0 ? { stops: ordered, index } : null;
  }, [line, fromId, direction, dirKey]);


  // Riding with you: best matches (shared interests) first, then everyone else in
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
  const shown = aroundItems.slice(0, 10);
  const othersCount = aroundItems.length;

  // Live games in your own rooms (real engagement snapshots only).
  const liveGames: { roomId: string; title: string; desc: string }[] = [];
  for (const snap of Object.values(engagement || {})) {
    const g = snap.activeGame as { type?: string; players?: unknown[]; currentPrompt?: { text?: string } } | null;
    if (!g?.type) continue;
    const players = Array.isArray(g.players) ? g.players.length : 0;
    liveGames.push({
      roomId: snap.roomId,
      title: GAME_TITLES[g.type] || g.type.replace(/_/g, ' '),
      desc: g.type === 'prompt'
        ? (g.currentPrompt?.text?.slice(0, 60) || 'Share your answer')
        : players > 0 ? `${players} playing now` : 'Starting now'
    });
  }

  const openGame = (roomId: string) => {
    // Games are played in the People tab's room hub for your current room;
    // a game in your other room opens that room's chat.
    if (liveRoom && roomId === liveRoom.id) onViewAllPeople();
    else onJoinRoom(roomId);
  };

  const openPerson = (u: UserProfile) => (onOpenProfile ? onOpenProfile(u) : onViewAllPeople());
  const openRoom = () => (onOpenRoom ? onOpenRoom(presenceId) : onViewAllPeople());

  const canConfirm = hasPlace && !confident && !!onConfirmContext;
  // Moving between two stations: the sign shows the next one, like the in-train display.
  const showNext = !!between && confident;
  const signStation = showNext
    ? (line?.stations.find(s => s.id === between!.toStationId) || getStationById(between!.toStationId))
    : station;
  const signLines: string[] = signStation
    ? [signStation.lineId, ...(signStation.interchangeLines || [])].filter((v, i, a) => !!v && a.indexOf(v) === i)
    : lineId ? [lineId] : [];

  return (
    <div className="animate-fade-in" style={lineStyle(line?.color || liveRoom?.lineColor)}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <BrandMark size={32} />
          <div style={{ minWidth: 0 }}>
            <p className="type-label" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {greeting}{user ? `, ${firstName(user.pseudonym)}` : ''}
            </p>
            <p className="type-meta" style={{ color: 'var(--text-muted)' }}>
              {hasPlace ? (!confident ? 'Checking your station' : between ? `On the ${lineName ?? 'train'}` : described.headline) : ctx ? 'Where are you?' : 'Finding your station'}
            </p>
          </div>
        </div>
        <ThemeToggle variant="plain" />
      </header>

      {/* ── Your platform ── */}
      <section aria-label="Your current ride" className="card has-stub" style={{ padding: '20px 16px 16px 20px' }}>
        {hasPlace ? (
          <>
            {showNext && (
              <p className="type-meta" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                Next station, from {between!.fromStationName}
              </p>
            )}
            <StationSign
              station={signStation}
              name={showNext ? signStation?.name ?? between!.toStationName : confident ? stationName : `Near ${stationName}?`}
              hindiName={signStation?.hindiName}
              lines={signLines}
              towards={direction || undefined}
              meta={metaLine}
            />

            {rail && (
              <div style={{ marginTop: 16 }}>
                <LineRail
                  orientation="horizontal"
                  stations={rail.stops}
                  currentIndex={rail.index}
                  window={2}
                  compact
                  live={confident && ctx?.source === 'gps'}
                  dimPast={onTrain}
                  annotate={showNext ? (stop => (stop.id === between!.toStationId ? 'next' : null)) : undefined}
                  ariaLabel={`${lineName ?? 'Line'} around ${stationName}`}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              {liveRoom ? (
                <PresenceStack
                  people={shown.map(s => ({ id: s.profile.id, name: s.profile.pseudonym, avatarBg: s.profile.avatarBg }))}
                  count={othersCount}
                  label={othersCount === 1 ? (onTrain ? 'rider with you' : 'rider here') : (onTrain ? 'riders with you' : 'riders here')}
                  live
                />
              ) : (
                <span className="type-meta" style={{ color: 'var(--text-muted)' }}>Joining the room</span>
              )}
            </div>
          </>
        ) : (
          <div aria-busy="true" aria-live="polite">
            <Skeleton width="70%" height={34} />
            <Skeleton width="30%" height={14} style={{ marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Skeleton width={84} height={22} borderRadius="var(--radius-pill)" />
              <Skeleton width={140} height={22} borderRadius="var(--radius-pill)" delayMs={120} />
            </div>
            <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 14 }}>
              Finding your station from GPS. You can also pick it yourself.
            </p>
          </div>
        )}
      </section>

      {/* ── The one action ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!hasPlace ? (
          onOpenCheckIn && (
            <Button fullWidth icon={<MapPinIcon size={20} />} onClick={onOpenCheckIn}>Pick my station</Button>
          )
        ) : canConfirm ? (
          <>
            <Button style={{ flex: 1 }} onClick={() => { void onConfirmContext?.(); }}>Yes, I'm here</Button>
            {onOpenCheckIn && <Button variant="tonal" style={{ flex: 1 }} icon={<SwapIcon size={20} />} onClick={onOpenCheckIn}>Change</Button>}
          </>
        ) : (
          <>
            <Button style={{ flex: 1 }} iconEnd={<ArrowRightIcon size={20} />} onClick={openRoom}>Open room</Button>
            {onOpenCheckIn && (
              <Button variant="tonal" icon={<SwapIcon size={20} />} onClick={onOpenCheckIn} aria-label="Change station or direction">Change</Button>
            )}
          </>
        )}
      </div>

      {/* ── Riding with you ── */}
      {hasPlace && (
        <section aria-labelledby="home-around" style={{ marginTop: 28 }}>
          <div className="section-head">
            <h2 id="home-around">{onTrain ? 'Riding with you' : 'On your platform'}</h2>
            {othersCount > 0 && (
              <button type="button" className="link" onClick={onViewAllPeople}>See all</button>
            )}
          </div>

          {!liveRoom ? (
            <div style={{ display: 'flex', gap: 16 }} aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Skeleton width={56} height={56} borderRadius="var(--radius-squircle)" delayMs={i * 120} />
                  <Skeleton width={44} height={10} delayMs={i * 120} />
                </div>
              ))}
            </div>
          ) : shown.length > 0 ? (
            <ul
              className="stagger"
              style={{ display: 'flex', gap: 4, overflowX: 'auto', listStyle: 'none', margin: '0 -16px', padding: '0 12px 4px', scrollbarWidth: 'none' }}
            >
              {shown.map(({ profile: p, shared }) => (
                <li key={p.id} style={{ flex: '0 0 76px', minWidth: 0 }}>
                  <button
                    type="button"
                    className="press"
                    onClick={() => openPerson(p)}
                    aria-label={`${p.pseudonym}${shared ? `, ${shared} interest${shared === 1 ? '' : 's'} in common` : ''}. View profile`}
                    style={{ width: 76, minHeight: 'var(--tap)', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderRadius: 'var(--radius-card)' }}
                  >
                    <Avatar name={p.pseudonym} seed={p.id} bg={p.avatarBg} size={56} presence={p.presenceTier} style={{ fontSize: 19 }} />
                    <span className="type-label" style={{ display: 'block', width: '100%', textAlign: 'center', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {firstName(p.pseudonym)}
                    </span>
                    <span className="type-meta tnum" style={{ color: shared ? 'var(--text-secondary)' : 'var(--text-muted)', marginTop: -4, whiteSpace: 'nowrap' }}>
                      {shared ? `${shared} in common` : p.presenceTier ? TIER_WORD[p.presenceTier] : '\u00a0'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            // Honest zero-state: what's empty, why, and one way forward.
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 'var(--radius-squircle)', background: 'var(--bg-tonal)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <UsersIcon size={22} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="type-label" style={{ color: 'var(--text-primary)' }}>No one else here yet</p>
                <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  Riders show up as they check in{stationName ? ` at ${stationName}` : ''}. Peak hours are busiest.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Live in your rooms: only when a real game is running ── */}
      {liveGames.length > 0 && (
        <section aria-labelledby="home-live-games" style={{ marginTop: 28 }}>
          <div className="section-head">
            <h2 id="home-live-games">Live in your rooms</h2>
          </div>
          <ListGroup style={{ marginBottom: 0 }}>
            {liveGames.map(g => (
              <ListRow
                key={g.roomId}
                leading={<GameControllerIcon size={22} />}
                title={g.title}
                subtitle={g.desc}
                onClick={() => openGame(g.roomId)}
                navigable
              />
            ))}
          </ListGroup>
        </section>
      )}

      {children && <div style={{ marginTop: 28 }}>{children}</div>}
    </div>
  );
};
