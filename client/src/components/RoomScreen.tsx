import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeftIcon, ArrowClockwiseIcon, ChatCircleDotsIcon, CheckIcon, UserPlusIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { Socket } from 'socket.io-client';
import type { UserProfile, RoomPresenceTraveler, RoomPresenceResponse, RoomMessage, ContextRoom } from '../types';
import type { ReactionState, EngagementSnapshot } from '../types/engagement';
import { INTEREST_TAXONOMY } from '../types';
import { authHeaders } from '../utils/auth';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions } from './ProfileSheetActions';
import { ReportSheet } from './ReportSheet';
import { ChatView } from './ChatView';
import { Toast } from './ui/Toast';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { EmptyState } from './ui/EmptyState';
import { IconButton } from './ui/IconButton';
import { LineRail } from './ui/LineRail';
import { ListGroup, ListRow } from './ui/ListRow';
import { PresenceStack } from './ui/PresenceStack';
import { Skeleton } from './ui/Skeleton';
import { StationSign } from './ui/StationSign';
import { EngagementHub } from './engagement/EngagementHub';
import { lineStyle } from '../utils/lineStyle';
import { pushBackHandler } from '../utils/nativeBridge';
import { API } from '../config';
import { getLineById, getStationById } from '../data/metroData';

const POLL_INTERVAL_MS = 15000;
/** Riders listed before "Show all". */
const RIDERS_PREVIEW = 6;

interface PresetRoom {
  id: string;
  station: string;
  line: string;
  direction: string;
  label: string;
  color: string;
}

const PRESET_ROOMS: PresetRoom[] = [
  {
    id: 'rajiv_chowk:blue:towards_noida',
    station: 'Rajiv Chowk',
    line: 'Blue Line',
    direction: 'Towards Noida',
    label: 'Rajiv Chowk · Blue · Towards Noida',
    color: '#0072CE'
  },
  {
    id: 'rajiv_chowk:yellow:towards_samaypur_badli',
    station: 'Rajiv Chowk',
    line: 'Yellow Line',
    direction: 'Towards Samaypur Badli',
    label: 'Rajiv Chowk · Yellow · Towards Samaypur Badli',
    color: '#FFD100'
  },
  {
    id: 'kashmere_gate:red:towards_rithala',
    station: 'Kashmere Gate',
    line: 'Red Line',
    direction: 'Towards Rithala',
    label: 'Kashmere Gate · Red · Towards Rithala',
    color: '#E31837'
  },
  {
    id: 'hauz_khas:magenta:towards_botanical_garden',
    station: 'Hauz Khas',
    line: 'Magenta Line',
    direction: 'Towards Botanical Garden',
    label: 'Hauz Khas · Magenta · Towards Botanical Garden',
    color: '#8A1538'
  }
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * Human names for any `station:line:direction` room id (Home links to rooms
 * beyond the presets), resolved from the metro map; unknown parts fall back
 * to a title-cased slug rather than raw ids.
 */
function roomFromId(id: string): PresetRoom {
  const preset = PRESET_ROOMS.find(p => p.id === id);
  if (preset) return preset;
  const [stationId = '', lineId = '', dirSlug = ''] = id.split(':');
  const line = getLineById(lineId);
  const stationName = getStationById(stationId)?.name.replace(/\s*\(.*\)\s*$/, '') || titleCase(stationId) || 'Metro station';
  const terminals = line ? [line.terminalA, line.terminalB] : [];
  const terminal = terminals.find(t => slug(`towards ${t}`) === dirSlug || slug(t) === dirSlug);
  const direction = terminal ? `Towards ${terminal}` : titleCase(dirSlug) || 'Any direction';
  const lineName = line?.name || (lineId ? `${titleCase(lineId)} Line` : 'Metro');
  return {
    id,
    station: stationName,
    line: lineName,
    direction,
    label: `${stationName} · ${lineName} · ${direction}`,
    color: line?.color || 'var(--ink)'
  };
}

function tagLabel(id: string): string {
  return INTEREST_TAXONOMY.find(t => t.id === id)?.label || titleCase(id);
}

const baseName = (n: string) => n.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();

/** Does a direction slug ("towards_noida") point at this terminal ("Noida Electronic City / Vaishali")? */
function towardsTerminal(dirSlug: string, terminal: string): boolean {
  const d = dirSlug.replace(/^towards_/, '');
  if (!d) return false;
  return terminal.split('/').map(t => slug(t)).some(t => t && (t.startsWith(d) || d.startsWith(t)));
}

/**
 * The real stops around this platform, ordered in the direction of travel
 * (so "next" is always to the right). Unknown line/station → no rail.
 */
function railFor(roomId: string, stationName: string) {
  const [stationId = '', lineId = '', dirSlug = ''] = roomId.split(':');
  const line = getLineById(lineId);
  if (!line) return null;
  let stops = line.stations;
  let idx = stops.findIndex(s => s.id === stationId);
  if (idx < 0) idx = stops.findIndex(s => baseName(s.name) === baseName(stationName));
  if (idx < 0) return null;
  const toA = towardsTerminal(dirSlug, line.terminalA) && !towardsTerminal(dirSlug, line.terminalB);
  if (toA) { stops = [...stops].reverse(); idx = stops.length - 1 - idx; }
  return { stops: stops.map(s => ({ id: s.id, name: s.name.replace(/\s*\(.*\)\s*$/, '') })), index: idx, line };
}

interface Props {
  currentUser: UserProfile | null;
  initialRoomId?: string;
  onBack?: () => void;
  onProfileOpen?: (user: UserProfile) => void;
  onConnect?: (targetUserId: string) => void;
  socket?: Socket | null;
  socketConnected?: boolean;
}

export const RoomScreen: React.FC<Props> = ({
  currentUser,
  initialRoomId = 'rajiv_chowk:blue:towards_noida',
  onBack,
  onConnect,
  socket = null,
  socketConnected = false
}) => {
  const [activeRoomId, setActiveRoomId] = useState(initialRoomId);
  const [data, setData] = useState<RoomPresenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [sheetTraveler, setSheetTraveler] = useState<RoomPresenceTraveler | null>(null);
  const [reportTraveler, setReportTraveler] = useState<RoomPresenceTraveler | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const handleBlock = async (traveler: RoomPresenceTraveler) => {
    const name = traveler.pseudonym || traveler.username.replace(/^@/, '');
    setSheetTraveler(null);
    if (!currentUser?.id) return;
    // Optimistically drop them; the next poll confirms via server-side filtering.
    setData(prev => prev ? { ...prev, travelers: prev.travelers.filter(t => t.id !== traveler.id), count: Math.max(0, prev.count - 1) } : prev);
    try {
      const res = await fetch(`${API}/api/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetId: traveler.id })
      });
      if (!res.ok) throw new Error();
      showToast(`Blocked ${name}`);
    } catch {
      showToast(`Couldn't block ${name}. Try again.`);
      fetchRoomData(activeRoomId, true); // restore the list if the block failed
    }
  };
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Lazy initial value rather than setting it from inside the effect — mounting
  // part-scrolled (back navigation, refresh) still starts in the right state.
  const [collapsed, setCollapsed] = useState(() => window.scrollY > 24);

  // Large title collapses once the page scrolls — the .nav-bar hairline appears
  // with it. Passive listener so scrolling stays on the compositor.
  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const activePreset = roomFromId(activeRoomId);
  // The room we were opened with stays pickable even when it isn't a preset.
  const [entryRoom] = useState(() => roomFromId(initialRoomId));
  const rooms = PRESET_ROOMS.some(p => p.id === entryRoom.id) ? PRESET_ROOMS : [entryRoom, ...PRESET_ROOMS];
  const stations = Array.from(new Set(rooms.map(p => p.station)));

  const [pickerStation, setPickerStation] = useState(activePreset.station);

  // ── Room chat (ephemeral socket messages for this presence room) ──
  const [chatOpen, setChatOpen] = useState(false);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomTyping, setRoomTyping] = useState<{ userId: string; pseudonym: string }[]>([]);
  const [roomReactions, setRoomReactions] = useState<Record<string, ReactionState>>({});
  const [unseenChat, setUnseenChat] = useState(0);
  const [engagementSnap, setEngagementSnap] = useState<EngagementSnapshot | null>(null);
  const [showAllRiders, setShowAllRiders] = useState(false);
  const chatOpenRef = useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Switching rooms: drop the previous room's list during render so it never
  // shows under the new room's header while the fetch is in flight.
  const [shownRoomId, setShownRoomId] = useState(activeRoomId);
  if (shownRoomId !== activeRoomId) {
    setShownRoomId(activeRoomId);
    setData(null);
    setError(null);
    setLoading(true);
    setLastUpdated('');
    setRoomMessages([]);
    setRoomTyping([]);
    setRoomReactions({});
    setUnseenChat(0);
    setChatOpen(false);
    setEngagementSnap(null);
    setShowAllRiders(false);
  }
  // Responses for a room we've since left are ignored.
  const activeRoomRef = useRef(activeRoomId);
  useEffect(() => { activeRoomRef.current = activeRoomId; }, [activeRoomId]);
  const stationRooms = rooms.filter(p => p.station === pickerStation);
  const liveCount = data?.count ?? 0;

  const fetchRoomData = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      // Token lets the server hide anyone in a block relationship with us.
      const res = await fetch(`${API}/api/room/${encodeURIComponent(roomId)}`, {
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const json: RoomPresenceResponse = await res.json();
      if (roomId !== activeRoomRef.current) return;
      setData(json);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (err) {
      if (roomId !== activeRoomRef.current) return;
      console.warn('[RoomScreen] Failed to fetch room presence:', err);
      setError(navigator.onLine === false
        ? "You're offline. We'll refresh when you reconnect."
        : "Couldn't load who's here right now.");
    } finally {
      if (roomId === activeRoomRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Heartbeat presence for current user.
  const sendHeartbeat = useCallback(async (roomId: string) => {
    if (!currentUser?.id) return;
    if (socket && socketConnected) {
      // Socket heartbeat keeps the Redis TTL fresh and broadcasts live
      // presence to everyone else in the room.
      socket.emit('heartbeat', { roomId });
      return;
    }
    try {
      await fetch(`${API}/api/room/${encodeURIComponent(roomId)}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
    } catch {
      // heartbeats fail silently if server is momentarily down
    }
  }, [currentUser, socket, socketConnected]);

  // Leave room on cleanup
  const sendLeave = useCallback(async (roomId: string) => {
    if (!currentUser?.id) return;
    try {
      await fetch(`${API}/api/room/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
    } catch {
      // silent
    }
  }, [currentUser]);

  // Polling setup: 15 seconds — the REST/Redis fallback used whenever the
  // socket isn't connected. When connected, presence_updated events drive
  // refreshes instead, so a live session never polls the API.
  // Which room this screen is in right now. Cleanup defers its REST leave a
  // tick and skips it if the effect re-ran for the same room (socket
  // connecting, StrictMode), so a late leave can't evict us after the rejoin.
  const inRoomRef = useRef<string | null>(null);
  useEffect(() => {
    inRoomRef.current = activeRoomId;
    // Initial fetch & heartbeat
    fetchRoomData(activeRoomId);
    sendHeartbeat(activeRoomId);

    // Poll + heartbeat only while the tab is visible — a backgrounded room
    // shouldn't keep two requests going every 15s.
    pollTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (socket && socketConnected) {
        // Live via socket events; just keep our own presence fresh.
        sendHeartbeat(activeRoomId);
        return;
      }
      fetchRoomData(activeRoomId, true);
      sendHeartbeat(activeRoomId);
    }, POLL_INTERVAL_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fetchRoomData(activeRoomId, true);
        sendHeartbeat(activeRoomId);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
      inRoomRef.current = null;
      const leaving = activeRoomId;
      setTimeout(() => { if (inRoomRef.current !== leaving) sendLeave(leaving); }, 0);
    };
  }, [activeRoomId, fetchRoomData, sendHeartbeat, sendLeave, socket, socketConnected]);

  // Socket join/leave for the active room + live presence diffs. Server binds
  // identity from the handshake auth (useSocket), so no user payload is sent.
  useEffect(() => {
    if (!socket || !socketConnected || !currentUser?.id) return;
    socket.emit('join_room', { roomId: activeRoomId });

    const onPresence = (p: { roomId: string; userId: string; state: string | null }) => {
      if (p.roomId !== activeRoomId) return;
      // Event-driven refresh — a single round-trip, in place of polling.
      fetchRoomData(activeRoomId, true);
    };
    socket.on('presence_updated', onPresence);

    return () => {
      socket.off('presence_updated', onPresence);
      socket.emit('leave_room', { roomId: activeRoomId });
    };
  }, [socket, socketConnected, activeRoomId, currentUser?.id, fetchRoomData]);

  // Live room chat events. Messages exist only while people are here — the
  // server doesn't store presence-room chat — so the list starts empty.
  useEffect(() => {
    if (!socket) return;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const onMessage = (m: RoomMessage) => {
      if (!m || m.roomId !== activeRoomId) return;
      setRoomMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m].slice(-200));
      setRoomTyping(prev => prev.filter(u => u.userId !== m.senderId));
      if (!chatOpenRef.current && !m.isSystem && m.senderId !== currentUser?.id) setUnseenChat(n => n + 1);
    };
    const onTyping = (p: { roomId: string; userId: string; pseudonym: string }) => {
      if (p?.roomId !== activeRoomId || p.userId === currentUser?.id) return;
      setRoomTyping(prev => prev.some(u => u.userId === p.userId) ? prev : [...prev, { userId: p.userId, pseudonym: p.pseudonym }]);
      const old = typingTimers.get(p.userId);
      if (old) clearTimeout(old);
      typingTimers.set(p.userId, setTimeout(() => {
        setRoomTyping(prev => prev.filter(u => u.userId !== p.userId));
      }, 5000));
    };
    const onStopTyping = (p: { roomId: string; userId: string }) => {
      if (p?.roomId !== activeRoomId) return;
      setRoomTyping(prev => prev.filter(u => u.userId !== p.userId));
    };
    const onReaction = (p: { targetId: string; state: ReactionState; roomId?: string }) => {
      if (p?.roomId !== activeRoomId) return;
      setRoomReactions(prev => ({ ...prev, [p.targetId]: p.state }));
    };
    socket.on('new_message', onMessage);
    socket.on('user_typing', onTyping);
    socket.on('user_stop_typing', onStopTyping);
    socket.on('reaction_updated', onReaction);
    return () => {
      socket.off('new_message', onMessage);
      socket.off('user_typing', onTyping);
      socket.off('user_stop_typing', onStopTyping);
      socket.off('reaction_updated', onReaction);
      typingTimers.forEach(t => clearTimeout(t));
    };
  }, [socket, activeRoomId, currentUser?.id]);

  // Android back / browser back closes the chat before leaving the room.
  useEffect(() => {
    if (!chatOpen) return;
    return pushBackHandler(() => { setChatOpen(false); return true; });
  }, [chatOpen]);

  // Games + room reactions for this platform. The server keeps a snapshot per
  // room and pushes engagement_updated to members; ask for it once on join.
  useEffect(() => {
    if (!socket) return;
    const onEngagement = (snap: EngagementSnapshot) => {
      if (snap?.roomId === activeRoomId) setEngagementSnap(snap);
    };
    socket.on('engagement_updated', onEngagement);
    if (socketConnected) socket.emit('fetch_engagement', { roomId: activeRoomId });
    return () => { socket.off('engagement_updated', onEngagement); };
  }, [socket, socketConnected, activeRoomId]);

  const openChat = () => {
    setUnseenChat(0);
    setChatOpen(true);
  };

  const chatRoom: ContextRoom = {
    id: activeRoomId,
    type: 'station',
    lineId: activeRoomId.split(':')[1] || '',
    lineName: activePreset.line,
    lineColor: activePreset.color,
    stationId: activeRoomId.split(':')[0] || '',
    stationName: activePreset.station,
    direction: activePreset.direction,
    users: [],
    userCount: liveCount,
    presence: { active: liveCount, nearby: 0, other: 0, total: liveCount },
    messages: roomMessages,
    createdAt: 0,
    expiresAt: 0
  };

  const handleManualRefresh = () => {
    fetchRoomData(activeRoomId);
    sendHeartbeat(activeRoomId);
  };

  const handleConnectClick = (traveler: RoomPresenceTraveler) => {
    setConnectedIds(prev => new Set([...prev, traveler.id]));
    if (onConnect) {
      onConnect(traveler.id);
    }
  };

  /**
   * POST /api/connections for the profile sheet. Throws the server's error
   * message on non-2xx so ProfileSheetActions can revert to idle and show it.
   */
  const sendConnectionRequest = async (traveler: RoomPresenceTraveler) => {
    if (!currentUser?.id) throw new Error('Sign in to send requests.');
    const res = await fetch(`${API}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ targetId: traveler.id })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setConnectedIds(prev => new Set([...prev, traveler.id]));
    onConnect?.(traveler.id);
  };

  // Tapping a card opens the profile bottom sheet.
  const handleTravelerTap = (traveler: RoomPresenceTraveler) => {
    setSheetTraveler(traveler);
  };

  const lineId = activeRoomId.split(':')[1] || '';
  const stationId = activeRoomId.split(':')[0] || '';
  const signStation = getStationById(stationId);
  const towards = activePreset.direction.replace(/^towards\s+/i, '');
  const rail = railFor(activeRoomId, activePreset.station);
  const presenceKnown = !!data && !error;
  const chatReady = !!socket && socketConnected;
  const myTags = currentUser?.interestTags || [];
  const onlyMe = !!data && data.travelers.length === 1 && data.travelers[0].id === currentUser?.id;
  const snapshotForHub: EngagementSnapshot | null = engagementSnap
    ? { ...engagementSnap, reactions: { ...engagementSnap.reactions, ...roomReactions } }
    : null;

  // You first, then whoever shares the most interests; long rooms show the
  // first few and let you expand, so chat and games stay within reach.
  const sortedTravelers = data ? [...data.travelers].sort((a, b) => {
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    const shared = (t: RoomPresenceTraveler) => (t.interestTags || []).filter(x => myTags.includes(x)).length;
    return shared(b) - shared(a);
  }) : [];
  const visibleTravelers = showAllRiders ? sortedTravelers : sortedTravelers.slice(0, RIDERS_PREVIEW);
  const hiddenRiders = sortedTravelers.length - visibleTravelers.length;

  const skeletonRows = (dim: boolean) => (
    <div className="list-group" aria-hidden="true" style={dim ? { opacity: 0.55 } : undefined}>
      {[0, 1, 2].map(idx => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px 14px 16px', borderTop: idx ? '1px solid var(--border-subtle)' : undefined }}>
          <Skeleton width={48} height={48} borderRadius="var(--radius-squircle)" delayMs={idx * 120} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="42%" height={14} delayMs={idx * 120 + 40} />
            <Skeleton width="70%" height={12} delayMs={idx * 120 + 80} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Skeleton width={64} height={24} borderRadius="var(--radius-pill)" delayMs={idx * 120 + 100} />
              <Skeleton width={52} height={24} borderRadius="var(--radius-pill)" delayMs={idx * 120 + 120} />
            </div>
          </div>
          <Skeleton width={96} height={40} borderRadius="var(--radius-pill)" delayMs={idx * 120 + 140} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in" style={lineStyle(lineId || activePreset.color)}>
      {/* Top bar: the sign's name slides in here once it scrolls away */}
      <div className={`nav-bar${collapsed ? ' collapsed' : ''}`} style={{ marginBottom: 4 }}>
        <div className="nav-bar-top">
          {onBack ? (
            <IconButton label="Back to home" variant="plain" onClick={onBack} style={{ marginLeft: -12 }}>
              <ArrowLeftIcon size={24} aria-hidden="true" />
            </IconButton>
          ) : (
            <span style={{ width: 'var(--tap)' }} />
          )}

          <span className="nav-bar-compact" aria-hidden={!collapsed}>
            {activePreset.station}
            {presenceKnown && <span className="tnum" style={{ color: 'var(--text-secondary)', fontWeight: 480 }}> · {liveCount} here</span>}
          </span>

          <IconButton label="Refresh who's here" variant="plain" onClick={handleManualRefresh} disabled={isRefreshing} style={{ marginRight: -12 }}>
            <ArrowClockwiseIcon size={22} aria-hidden="true" className={isRefreshing ? 'animate-spin' : undefined} />
          </IconButton>
        </div>
      </div>

      {/* Platform sign */}
      <section aria-label="This platform" style={{ marginBottom: 24 }}>
        <StationSign
          name={activePreset.station}
          hindiName={signStation?.hindiName}
          lines={lineId && getLineById(lineId) ? [lineId] : []}
          towards={towards}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, minHeight: 32, ['--stack-ring' as string]: 'var(--bg-base)' } as React.CSSProperties}>
          <span role="status" style={{ minWidth: 0 }}>
            {presenceKnown ? (
              <PresenceStack
                people={data!.travelers.map(t => ({ id: t.id, name: t.pseudonym || t.username, avatarBg: t.avatarBg }))}
                count={liveCount}
                label="here now"
                live
              />
            ) : error ? (
              <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Presence unavailable</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={64} height={28} borderRadius="var(--radius-pill)" />
                <span className="sr-only">Checking who's here</span>
              </span>
            )}
          </span>
          {lastUpdated && (
            <span className="type-meta tnum" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              {error ? 'Last seen' : 'Updated'} {lastUpdated}
            </span>
          )}
        </div>

        {rail && (
          <div style={{ marginTop: 16, padding: '12px 4px 8px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)' }}>
            <LineRail
              orientation="horizontal"
              stations={rail.stops}
              currentIndex={rail.index}
              window={2}
              ariaLabel={`${rail.line.name} towards ${towards}, around ${activePreset.station}`}
            />
          </div>
        )}
        <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          You picked this platform. Others see the station and line, never your location.
        </p>
      </section>

      {/* Room chat: the one primary action here */}
      {currentUser && (
        <div style={{ marginBottom: 24 }}>
          <Button
            type="button"
            fullWidth
            size="lg"
            onClick={openChat}
            disabled={!chatReady}
            icon={<ChatCircleDotsIcon size={22} />}
            aria-label={unseenChat > 0 ? `Open platform chat, ${unseenChat} new ${unseenChat === 1 ? 'message' : 'messages'}` : 'Open platform chat'}
          >
            {chatReady ? 'Platform chat' : 'Chat reconnecting'}
            {unseenChat > 0 && (
              <span
                aria-hidden="true"
                className="tnum"
                style={{
                  minWidth: 24, height: 24, padding: '0 7px', marginLeft: 4, borderRadius: 'var(--radius-pill)',
                  background: 'var(--ink-fixed)', color: '#FFFFFF',
                  fontSize: 13, fontWeight: 650, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {unseenChat > 99 ? '99+' : unseenChat}
              </span>
            )}
          </Button>
          <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Everyone on this platform can read it. Messages clear after your commute.
          </p>
        </div>
      )}

      {/* Who's here */}
      <div className="section-head">
        <h2>On this platform</h2>
        {data && <span className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>{data.travelers.length} {data.travelers.length === 1 ? 'rider' : 'riders'}</span>}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
            padding: '8px 8px 8px 16px', borderRadius: 'var(--radius-card)',
            background: 'var(--bg-surface)', boxShadow: 'inset 4px 0 0 var(--status-danger)', overflow: 'hidden'
          }}
        >
          <WarningCircleIcon size={22} aria-hidden="true" style={{ color: 'var(--danger-text)', flexShrink: 0 }} />
          <div className="type-meta" style={{ flex: 1, color: 'var(--text-primary)' }}>
            {error}
            {data && <span style={{ color: 'var(--text-secondary)' }}> Showing the last list we saw.</span>}
          </div>
          <Button type="button" variant="tonal" size="sm" onClick={handleManualRefresh} isLoading={isRefreshing}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading (and failed first load): rows shaped like the real list */}
      {!data && (loading || error) && (
        <div aria-busy={loading || undefined}>
          {loading && <span className="sr-only">Loading riders</span>}
          {skeletonRows(!!error)}
        </div>
      )}

      {!loading && data && data.travelers.length === 0 && (
        <EmptyState lineName={activePreset.line} stationName={activePreset.station} direction={activePreset.direction} />
      )}

      {data && data.travelers.length > 0 && (
        <ul className="list-group stagger" style={{ listStyle: 'none', padding: 0, marginBottom: onlyMe || hiddenRiders > 0 ? 8 : 24 }}>
          {visibleTravelers.map((traveler, idx) => {
            const isMe = traveler.id === currentUser?.id;
            const isConnected = connectedIds.has(traveler.id);
            // Server derives this per user from their heartbeat TTL.
            const active = (traveler as { presenceState?: string }).presenceState === 'active';
            const displayName = traveler.pseudonym || traveler.username.replace(/^@/, '');
            const tags = traveler.interestTags || [];
            const shared = isMe ? [] : tags.filter(t => myTags.includes(t));
            const rest = tags.filter(t => !shared.includes(t));
            const shownTags = [...shared, ...rest].slice(0, 3);
            const more = tags.length - shownTags.length;

            return (
              <li
                key={traveler.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 12px 0 0',
                  borderTop: idx ? '1px solid var(--border-subtle)' : undefined
                }}
              >
                <button
                  type="button"
                  onClick={() => handleTravelerTap(traveler)}
                  aria-label={`${displayName}${isMe ? ' (you)' : ''}, ${active ? 'active now' : 'away'}${shared.length ? `, ${shared.length} shared ${shared.length === 1 ? 'interest' : 'interests'}` : ''}. View profile`}
                  className="press-row"
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 0 14px 16px', background: 'none', border: 'none', textAlign: 'left',
                    color: 'inherit', cursor: 'pointer'
                  }}
                >
                  <Avatar name={displayName} seed={traveler.id} bg={traveler.avatarBg} size={48} presence={active ? 'active' : 'other'} you={isMe} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                      <span className="type-label" style={{ fontSize: 16, lineHeight: '22px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </span>
                      {(isMe || !active) && (
                        <span className="type-meta" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          {isMe ? 'You' : 'Away'}
                        </span>
                      )}
                    </span>
                    {traveler.bio && (
                      <span
                        className="type-meta"
                        style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {traveler.bio}
                      </span>
                    )}
                    {shownTags.length > 0 && (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {shownTags.map(t => (
                          <Chip key={t} shared={shared.includes(t)} variant={shared.includes(t) ? 'outline' : 'quiet'} style={rowChip}>
                            {tagLabel(t)}
                          </Chip>
                        ))}
                        {more > 0 && <span className="type-meta tnum" style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>+{more}</span>}
                      </span>
                    )}
                  </span>
                </button>

                {!isMe && (
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    disabled={isConnected}
                    icon={isConnected ? <CheckIcon size={18} /> : <UserPlusIcon size={18} />}
                    onClick={() => { if (!isConnected) handleConnectClick(traveler); }}
                    aria-label={isConnected ? `Request sent to ${displayName}` : `Send connection request to ${displayName}`}
                  >
                    {isConnected ? 'Sent' : 'Connect'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hiddenRiders > 0 && (
        <Button type="button" variant="tonal" fullWidth onClick={() => setShowAllRiders(true)} style={{ marginBottom: 24 }}>
          <span className="tnum">{`Show all ${sortedTravelers.length} riders`}</span>
        </Button>
      )}
      {onlyMe && (
        <p className="type-meta" style={{ color: 'var(--text-muted)', marginBottom: 24, padding: '0 4px' }}>
          Only you so far. Riders show up here as they reach this platform, and the list updates live.
        </p>
      )}

      {/* Games: secondary to the people and the chat */}
      {currentUser && (
        <section aria-labelledby="room-games-title" style={{ marginBottom: 24 }}>
          <div className="section-head">
            <h2 id="room-games-title">Games</h2>
          </div>
          <EngagementHub
            room={chatRoom}
            snapshot={snapshotForHub}
            currentUser={currentUser}
            socket={chatReady ? socket : null}
            onReaction={(targetId, emoji, targetType) => socket?.emit('reaction_toggle', { targetId, targetType, userId: currentUser.id, emoji, roomId: activeRoomId })}
          />
        </section>
      )}

      {/* Switch platform */}
      <section aria-labelledby="room-switch-title">
        <div className="section-head">
          <h2 id="room-switch-title">Change platform</h2>
        </div>
        <div role="group" aria-label="Station" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px 12px', padding: '0 16px' }}>
          {stations.map(station => (
            <Chip key={station} selected={station === pickerStation} onClick={() => setPickerStation(station)} style={{ flexShrink: 0 }}>
              {station}
            </Chip>
          ))}
        </div>
        <ListGroup label="Line and direction">
          {stationRooms.map(preset => {
            const isActive = preset.id === activeRoomId;
            return (
              <ListRow
                key={preset.id}
                onClick={() => { setActiveRoomId(preset.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-label={`${preset.line}, ${preset.direction}${isActive ? ', current platform' : ''}`}
                leading={<span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: preset.color, display: 'inline-block' }} />}
                title={preset.line}
                subtitle={preset.direction}
                trailing={isActive ? <CheckIcon size={20} weight="bold" style={{ color: 'var(--text-primary)' }} /> : undefined}
              />
            );
          })}
        </ListGroup>
      </section>

      {/* Room chat — full-screen over the room */}
      {chatOpen && currentUser && (
        <ChatView
          room={chatRoom}
          currentUser={currentUser}
          socket={socket}
          typingUsers={roomTyping}
          reactions={roomReactions}
          onSendMessage={(content) => socket?.emit('send_message', { roomId: activeRoomId, content })}
          onReaction={(targetId, emoji) => socket?.emit('reaction_toggle', { targetId, targetType: 'message', userId: currentUser.id, emoji, roomId: activeRoomId })}
          onBack={() => setChatOpen(false)}
        />
      )}

      {/* Traveler profile sheet */}
      <ProfileSheet
        open={sheetTraveler !== null}
        onClose={() => setSheetTraveler(null)}
        labelledBy="profile-sheet-title"
      >
        {sheetTraveler && (
          <>
            <ProfileSheetContent
              traveler={sheetTraveler}
              titleId="profile-sheet-title"
              activeRoomId={activeRoomId}
              sharedTags={
                sheetTraveler.id === currentUser?.id
                  ? undefined
                  : (sheetTraveler.interestTags || []).filter(t => currentUser?.interestTags?.includes(t))
              }
            />
            <ProfileSheetActions
              key={sheetTraveler.id}
              travelerName={sheetTraveler.pseudonym || sheetTraveler.username.replace(/^@/, '')}
              initialState={
                sheetTraveler.id === currentUser?.id
                  ? 'self'
                  : connectedIds.has(sheetTraveler.id)
                    ? 'sent'
                    : 'idle'
              }
              onSendRequest={() => sendConnectionRequest(sheetTraveler)}
              onReport={() => { setReportTraveler(sheetTraveler); setSheetTraveler(null); }}
              onBlock={() => handleBlock(sheetTraveler)}
            />
          </>
        )}
      </ProfileSheet>

      {/* Report sheet */}
      <ReportSheet
        open={reportTraveler !== null}
        traveler={reportTraveler}
        currentUserId={currentUser?.id}
        onClose={() => setReportTraveler(null)}
        // ReportSheet shows its own confirmation — no second toast here.
        onReported={() => setReportTraveler(null)}
        onBlocked={(targetId) => {
          setData(prev => prev ? { ...prev, travelers: prev.travelers.filter(t => t.id !== targetId), count: Math.max(0, prev.count - 1) } : prev);
        }}
      />

      {/* Confirmation toast — hidden while the full-screen chat is up */}
      {!chatOpen && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
};

/** Interest chips inside a rider row: smaller than filter chips (the row is the tap target). */
const rowChip: React.CSSProperties = { minHeight: 26, padding: '3px 10px', fontSize: 13, lineHeight: '18px' };
