import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Train, ArrowLeft, RefreshCw, Users, AlertTriangle, UserPlus, Check, MapPin, MessageCircle } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { UserProfile, RoomPresenceTraveler, RoomPresenceResponse, RoomMessage, ContextRoom } from '../types';
import type { ReactionState } from '../types/engagement';
import { INTEREST_TAXONOMY } from '../types';
import { authHeaders } from '../utils/auth';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions } from './ProfileSheetActions';
import { ReportSheet } from './ReportSheet';
import { ChatView } from './ChatView';
import { Toast } from './ui/Toast';
import { pushBackHandler } from '../utils/nativeBridge';
import { API } from '../config';
import { getLineById, getStationById } from '../data/metroData';

const POLL_INTERVAL_MS = 15000;

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
    color: line?.color || 'var(--accent-purple)'
  };
}

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { emoji: '✨', label: id };
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
  useEffect(() => {
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
      sendLeave(activeRoomId);
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

  return (
    <div className="animate-fade-in">
      {/* Nav bar — large title collapses into the compact one on scroll */}
      <div className={`nav-bar${collapsed ? ' collapsed' : ''}`}>
        <div className="nav-bar-top">
          {onBack ? (
            <button onClick={onBack} className="icon-btn" aria-label="Back to home">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span style={{ width: 'var(--tap)' }} />
          )}

          <span className="nav-bar-compact">
            {activePreset.station}{data && !error ? ` · ${liveCount} live` : ''}
          </span>

          <button
            onClick={handleManualRefresh}
            className="icon-btn"
            aria-label="Refresh presence"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <h1 className="nav-bar-large">Live Room</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <span
            aria-hidden="true"
            className={data && !error ? 'animate-pulse-glow' : undefined}
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: data && !error ? 'var(--presence-active)' : 'var(--presence-other)'
            }}
          />
          <span role="status" style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {error
              ? 'Live presence unavailable'
              : !data
                ? 'Checking who\'s here…'
                : `${liveCount} ${liveCount === 1 ? 'traveler' : 'travelers'} live`}
          </span>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {error ? `Last updated ${lastUpdated}` : `Updated ${lastUpdated}`}
            </span>
          )}
        </div>
      </div>

      {/* Context picker — station via segmented control, then line → direction */}
      <div className="section-head"><h3>Station</h3></div>
      <div className="segmented" role="tablist" aria-label="Pick your station" style={{ marginBottom: 20 }}>
        {stations.map(station => (
          <button
            key={station}
            role="tab"
            aria-selected={station === pickerStation}
            className="segmented-option"
            onClick={() => setPickerStation(station)}
          >
            {station}
          </button>
        ))}
      </div>

      <div className="section-head"><h3>Line &amp; direction</h3></div>
      <div className="list-group">
        {stationRooms.map(preset => {
          const isActive = preset.id === activeRoomId;
          return (
            <button
              key={preset.id}
              className="list-row navigable"
              aria-current={isActive || undefined}
              onClick={() => setActiveRoomId(preset.id)}
            >
              {/* Metro line brand colour — decorative identity, stays literal */}
              <span
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: preset.color, flexShrink: 0
                }}
              />
              <span className="row-text">
                <span className="row-title">{preset.line}</span>
                <span className="row-sub">{preset.direction}</span>
              </span>
              {isActive && (
                <Check size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Current Room Glass Panel Hero */}
      <div
        className="glass-panel"
        style={{
          padding: 16,
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            className="avatar"
            style={{
              width: 46,
              height: 46,
              background: `linear-gradient(135deg, ${activePreset.color}, var(--accent-fill-from))`,
              color: 'white'
            }}
          >
            <Train size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {activePreset.station}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {activePreset.line}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} style={{ color: 'var(--accent-text)' }} />
              {activePreset.direction}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12,
                fontWeight: 700,
                color: data && !error ? 'var(--presence-active)' : 'var(--text-muted)'
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: data && !error ? 'var(--presence-active)' : 'var(--presence-other)'
                }}
                className={data && !error ? 'animate-pulse-glow' : undefined}
              />
              <span>{data && !error ? `${data.count} live` : error ? 'Offline' : '…'}</span>
            </div>
          </div>
        </div>

        {currentUser && (
          <button
            onClick={openChat}
            disabled={!socket || !socketConnected}
            className="btn-primary press"
            aria-label={unseenChat > 0 ? `Open room chat, ${unseenChat} new ${unseenChat === 1 ? 'message' : 'messages'}` : 'Open room chat'}
            style={{
              marginTop: 14, width: '100%', minHeight: 48, borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 15, fontWeight: 700,
              opacity: !socket || !socketConnected ? 0.55 : 1
            }}
          >
            <MessageCircle size={18} aria-hidden="true" />
            {!socket || !socketConnected ? 'Chat reconnecting…' : 'Room chat'}
            {unseenChat > 0 && (
              <span
                aria-hidden="true"
                style={{
                  minWidth: 22, height: 22, padding: '0 6px', borderRadius: 'var(--radius-full)',
                  background: 'var(--text-on-accent)', color: 'var(--accent-purple)',
                  fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {unseenChat > 99 ? '99+' : unseenChat}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="glass-panel"
          style={{
            padding: '8px 8px 8px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'var(--status-danger)'
          }}
        >
          <AlertTriangle size={20} aria-hidden="true" style={{ color: 'var(--status-danger)', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {error}
            {data && <span style={{ color: 'var(--text-muted)' }}> Showing the last list we saw.</span>}
          </div>
          <button
            onClick={handleManualRefresh}
            className="btn-secondary press"
            disabled={isRefreshing}
            style={{ minHeight: 48, padding: '0 16px', fontSize: 14, flexShrink: 0 }}
          >
            {isRefreshing ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* Section Heading with count */}
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={16} style={{ color: 'var(--accent-text)' }} />
          <h3>Travelers here{data ? ` (${data.travelers.length})` : ''}</h3>
        </div>
        <button
          onClick={handleManualRefresh}
          className="link"
          disabled={isRefreshing}
          style={{ minHeight: 48, padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Loading — skeleton cards, never a spinner */}
      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading travelers</span>
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="glass-soft" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && data && data.travelers.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: 32,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            className="avatar"
            style={{
              width: 56,
              height: 56,
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)'
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>No one here yet</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
              Nobody has checked into {activePreset.line} · {activePreset.direction} right now.
            </p>
          </div>
          <button onClick={handleManualRefresh} className="pill-button secondary" disabled={isRefreshing}>
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Checking…' : 'Check again'}
          </button>
        </div>
      )}

      {/* Travelers List */}
      {data && data.travelers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.travelers.map(traveler => {
            const isMe = traveler.id === currentUser?.id;
            const isConnected = connectedIds.has(traveler.id);
            const initials = (traveler.pseudonym || traveler.username)
              .replace(/^@/, '')
              .substring(0, 2)
              .toUpperCase();
            // Server derives this per user from their heartbeat TTL.
            const presence = (traveler as { presenceState?: string }).presenceState === 'active' ? 'active' : 'away';
            const displayName = traveler.pseudonym || traveler.username.replace(/^@/, '');

            return (
              <div
                key={traveler.id}
                className="glass-panel animate-fade-in"
                role="button"
                tabIndex={0}
                aria-label={`${displayName}${isMe ? ' (you)' : ''}, ${presence === 'active' ? 'active now' : 'away'}. View profile`}
                style={{
                  padding: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
                onClick={() => handleTravelerTap(traveler)}
                onKeyDown={e => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTravelerTap(traveler); }
                }}
              >
                {/* Avatar with live active dot */}
                <div className="avatar-wrap">
                  <div
                    className="avatar"
                    style={{
                      width: 48,
                      height: 48,
                      fontSize: 14,
                      background:
                        traveler.avatarBg ||
                        'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))'
                    }}
                  >
                    {initials}
                  </div>
                  <div
                    className={`avatar-dot ${presence === 'active' ? 'active' : 'other'}`}
                    title={presence === 'active' ? 'Active now' : 'Away'}
                    aria-hidden="true"
                  />
                </div>

                {/* Traveler Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {traveler.pseudonym || traveler.username}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {traveler.username.startsWith('@') ? traveler.username : `@${traveler.username}`}
                    </span>
                    {presence === 'away' && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· away</span>
                    )}
                    {isMe && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--accent-text)',
                          background: 'var(--bg-surface)',
                          padding: '1px 6px',
                          borderRadius: 999,
                          border: '1px solid var(--border-purple)'
                        }}
                      >
                        You
                      </span>
                    )}
                  </div>

                  {/* Bio */}
                  {traveler.bio && (
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        margin: '4px 0 6px',
                        lineHeight: 1.35
                      }}
                    >
                      {traveler.bio}
                    </p>
                  )}

                  {/* Tags */}
                  {traveler.interestTags && traveler.interestTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {traveler.interestTags.map(t => {
                        const meta = tagMeta(t);
                        return (
                          <span
                            key={t}
                            className="tag-pill"
                            style={{
                              padding: '2px 8px',
                              fontSize: 11,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            <span>{meta.emoji}</span> {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connect / Say Hi button */}
                {!isMe && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (!isConnected) handleConnectClick(traveler);
                    }}
                    onKeyDown={e => e.stopPropagation()}
                    disabled={isConnected}
                    aria-label={isConnected ? `Request sent to ${displayName}` : `Send connection request to ${displayName}`}
                    className={isConnected ? 'btn-secondary press' : 'btn-primary press'}
                    style={{
                      padding: '0 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      minHeight: 48,
                      alignSelf: 'center'
                    }}
                  >
                    {isConnected ? (
                      <>
                        <Check size={13} />
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

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
