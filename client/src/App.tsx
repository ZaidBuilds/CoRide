import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MapPin, Train, MessageCircle, Radio } from 'lucide-react';
import { DiscoveryScreen } from './components/DiscoveryScreen';
import { ChatView } from './components/ChatView';
import { FriendsTab } from './components/FriendsTab';
import type { MetroFriend } from './components/FriendsTab';
import { ContextConfidenceBadge } from './components/ContextConfidenceBadge';
import { StationPicker } from './components/StationPicker';
import { LiveRoomHeader } from './components/LiveRoomHeader';
import { EngagementHub } from './components/engagement/EngagementHub';
import { ProfileEditor } from './components/personalization/ProfileEditor';
import { SavedCommutes } from './components/personalization/SavedCommutes';
import { useCommuteNotifications } from './hooks/useCommuteNotifications';
import { track } from './utils/analytics';
import type { EngagementSnapshot } from './types/engagement';
import type {
  UserProfile,
  ContextRoom,
  ContextResult,
  DirectMessage,
  FriendEntry
} from './types';

const API = 'http://localhost:4000';

type View = 'station' | 'train' | 'chat' | 'friends';

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [context, setContext] = useState<ContextResult | null>(null);
  const [stationRoom, setStationRoom] = useState<ContextRoom | null>(null);
  const [trainRoom, setTrainRoom] = useState<ContextRoom | null>(null);
  const [view, setView] = useState<View>('station');
  const [chatTarget, setChatTarget] = useState<'station' | 'train'>('station');
  const [friends, setFriends] = useState<MetroFriend[]>([]);
  const [friendDMs, setFriendDMs] = useState<DirectMessage[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<MetroFriend | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [beachhead, setBeachhead] = useState<{ line: string; isBeachhead: boolean; activeLines: any[] } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; pseudonym: string }[]>>({});
  const [engagement, setEngagement] = useState<Record<string, EngagementSnapshot>>({});
  const [rankedMap, setRankedMap] = useState<Record<string, any[]>>({});
  const [vibeMap, setVibeMap] = useState<Record<string, any[]>>({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const routeHistoryRef = useRef<{ lat: number; lng: number; t: number }[]>([]);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const { permission: pushPermission, isLive: commuteLive, requestPermission: requestPush } = useCommuteNotifications(!!user);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Bootstrap with persistence ───
  useEffect(() => {
    const s = io(API);
    setSocket(s);

    const STORAGE_KEY = 'coride_profile';
    const stored = localStorage.getItem(STORAGE_KEY);
    const initWithProfile = (profile: UserProfile) => {
      setUser(profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      detect(s, profile);
      track('session_start', profile.id, { stationHint: 'auto' });
      track('activated_user', profile.id, {});
    };

    if (stored) {
      try {
        const parsed: UserProfile = JSON.parse(stored);
        // Try restore from server (validates persistence across restarts)
        fetch(`${API}/api/auth/restore/${parsed.id}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(d => initWithProfile(d.profile))
          .catch(() => {
            // fallback to stored profile directly if server lost it but client has it
            initWithProfile(parsed);
          });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        fetch(`${API}/api/auth/random-profile`).then(r => r.json()).then(data => initWithProfile(data.profile));
      }
    } else {
      fetch(`${API}/api/auth/random-profile`)
        .then(r => r.json())
        .then(data => initWithProfile(data.profile));
    }

    s.on('room_updated', (roomData: ContextRoom) => {
      if (roomData.type === 'station') setStationRoom(roomData);
      else setTrainRoom(roomData);
      track('travelers_seen', undefined, { roomId: roomData.id, type: roomData.type, count: (roomData as any).userCount ?? (roomData as any).users?.length ?? 0 });
    });

    s.on('new_message', (msg) => {
      setStationRoom(prev => {
        if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] };
        return prev;
      });
      setTrainRoom(prev => {
        if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] };
        return prev;
      });
    });

    s.on('connection_result', (result: { success: boolean; message: string }) => {
      showToast(result.message);
      if (result.success) track('connection_request_sent', undefined, { message: result.message });
    });

    s.on('connection_accepted', ({ message, userA, userB }: { userA: string; userB: string; message: string }) => {
      showToast(message);
      track('connection_accepted', undefined, { userA, userB });
      track('mutual_acceptance', undefined, { userA, userB });
    });

    s.on('block_result', (result: { message: string }) => showToast(result.message));
    s.on('report_result', (result: { message: string }) => showToast(result.message));
    s.on('moderation_action', ({ message }: { message: string }) => showToast(`⚠️ ${message}`));
    s.on('new_dm', (dm: DirectMessage) => setFriendDMs(prev => {
      // de-dupe by id
      if (prev.some(x => x.id === dm.id)) return prev;
      return [...prev, dm];
    }));
    s.on('dm_history', ({ messages }: { friendId: string; messages: DirectMessage[] }) => {
      // Merge history without dupes
      setFriendDMs(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = messages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newOnes].sort((a,b) => a.timestamp - b.timestamp);
      });
    });

    // MVP2 live push: hero count tick + commute window
    s.on('live_count_tick', (payload: { roomId: string; count: number; presence: any }) => {
      // bump the count without full room_updated — keep feeling live even when idle
      setStationRoom(prev => prev && payload.roomId === prev.id ? { ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom : prev);
      setTrainRoom(prev => prev && payload.roomId === prev.id ? { ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom : prev);
    });
    s.on('commute_window_live', (payload: { title: string; body: string }) => {
      showToast(`${payload.title}: ${payload.body}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(payload.title, { body: payload.body, icon: '/vite.svg' }); } catch {}
      }
      track('commute_window_push_received', undefined, payload as any);
    });
    s.on('commute_window_room_live', (p: { roomId: string; count: number }) => {
      track('commute_window_room_live', undefined, p as any);
    });
    s.on('user_typing', (p: { roomId: string; userId: string; pseudonym: string }) => {
      setTypingUsers(prev => {
        const cur = prev[p.roomId] || [];
        if (cur.some(u => u.userId === p.userId)) return prev;
        return { ...prev, [p.roomId]: [...cur, { userId: p.userId, pseudonym: p.pseudonym }] };
      });
      // auto-clear after 4s
      setTimeout(() => {
        setTypingUsers(prev => {
          const cur = prev[p.roomId] || [];
          return { ...prev, [p.roomId]: cur.filter(u => u.userId !== p.userId) };
        });
      }, 4000);
    });
    s.on('user_stop_typing', (p: { roomId: string; userId: string }) => {
      setTypingUsers(prev => {
        const cur = prev[p.roomId] || [];
        return { ...prev, [p.roomId]: cur.filter(u => u.userId !== p.userId) };
      });
    });
    s.on('engagement_updated', (snap: EngagementSnapshot) => {
      setEngagement(prev => ({ ...prev, [snap.roomId]: snap }));
    });
    s.on('reaction_updated', (p: { targetId: string; state: any; roomId?: string }) => {
      // merge into engagement reactions map for room hub
      setEngagement(prev => {
        const next = { ...prev };
        // prefer explicit roomId
        if (p.roomId && next[p.roomId]) {
          next[p.roomId] = { ...next[p.roomId], reactions: { ...next[p.roomId].reactions, [p.targetId]: p.state } };
          return next;
        }
        for (const rid of Object.keys(next)) {
          if (next[rid].reactions[p.targetId] !== undefined || p.targetId === rid) {
            next[rid] = { ...next[rid], reactions: { ...next[rid].reactions, [p.targetId]: p.state } };
            return next;
          }
        }
        // fallback: put in first available room
        const first = Object.keys(next)[0];
        if (first) {
          next[first] = { ...next[first], reactions: { ...next[first].reactions, [p.targetId]: p.state } };
        }
        return next;
      });
    });
    s.on('game_error', (p: { error: string }) => showToast(`⚠️ ${p.error}`));

    return () => { s.disconnect(); };
  }, []);

  // Fetch beachhead info (PRD §2)
  useEffect(() => {
    fetch(`${API}/api/metro/beachhead`).then(r => r.json()).then(setBeachhead).catch(() => {});
  }, []);

  // Track real geolocation for multi-signal (PRD §5 signal stack #1 & #3)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, speed } = pos.coords;
        lastPosRef.current = { lat: latitude, lng: longitude };
        routeHistoryRef.current.push({ lat: latitude, lng: longitude, t: Date.now() });
        if (routeHistoryRef.current.length > 8) routeHistoryRef.current.shift();
        // also store speed if available (m/s → km/h)
        if (speed !== null && speed !== undefined) {
          (window as any).__lastSpeedKmh = speed * 3.6;
        }
      },
      () => {}, // silently ignore permission deny — fallback to cellTower
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Auto-nudge manual picker when confidence is low (<60%) — PRD §5 semi-assisted fallback
  useEffect(() => {
    if (!context) return;
    if (hasManualOverride) return;
    if (context.confidence < 0.6) {
      // delay to let user see auto-detect first
      const t = setTimeout(() => setShowStationPicker(true), 1200);
      return () => clearTimeout(t);
    }
  }, [context, hasManualOverride]);

  const handleStationPicked = (station: { id: string; name: string; lat: number; lng: number; cellTowerId?: string }) => {
    if (!socket || !user) return;
    // leave previous ephemeral rooms before switch — keeps presence truthful
    if (stationRoom) socket.emit('leave_room', { roomId: stationRoom.id, userId: user.id });
    if (trainRoom) socket.emit('leave_room', { roomId: trainRoom.id, userId: user.id });
    setHasManualOverride(true);
    setShowStationPicker(false);
    showToast(`Confirmed — ${station.name} ✓ +50 confidence`);
    detect(socket, user, {
      userConfirmed: true,
      overrideCellTowerId: station.cellTowerId,
      overrideLat: station.lat,
      overrideLng: station.lng
    });
    fetch(`${API}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'manual_context_confirm', userId: user.id, payload: { stationId: station.id, stationName: station.name } })
    }).catch(() => {});
  };

  const handleUseCommute = async (pattern: any, roomFromServer?: any) => {
    if (!socket || !user) return;
    // one-tap repeat entry — leave previous rooms, join pattern’s room
    if (stationRoom) socket.emit('leave_room', { roomId: stationRoom.id, userId: user.id });
    if (trainRoom) socket.emit('leave_room', { roomId: trainRoom.id, userId: user.id });
    showToast(`→ ${pattern.stationName} • ${pattern.targetTime} • re-entering`);
    track('commute_pattern_used', user.id, { patternId: pattern.id, station: pattern.stationName });
    if (roomFromServer) {
      // server already created room via /api/commute/patterns/use — use it directly
      const room = roomFromServer;
      // decide type
      if (room.type === 'station') {
        setStationRoom(room);
        setContext({ stationName: pattern.stationName, lineName: pattern.lineName, lineColor: pattern.lineColor, direction: pattern.direction, confidence: 0.95, breakdown: { stationMatch:30, routeMatch:25, movementMatch:10, scheduleMatch:20, userConfirm:50 }, rawScore:135, station:pattern.stationId, line:pattern.lineId, id:'', reason:'One-tap commute' } as any);
        socket.emit('join_room', { roomId: room.id, user });
      } else {
        setTrainRoom(room);
        socket.emit('join_room', { roomId: room.id, user });
      }
      setHasManualOverride(true);
      return;
    }
    // fallback: detect with pattern’s cellTower
    const station = { id: pattern.stationId, name: pattern.stationName, lat: 28.6328, lng: 77.2197, cellTowerId: `TOWER_DMRC_${pattern.stationId.toUpperCase()}` };
    // lookup real station coords if available
    try {
      const lines = await fetch(`${API}/api/metro/lines`).then(r=>r.json());
      for (const line of lines.lines || []) {
        const found = line.stations.find((s:any)=> s.id===pattern.stationId);
        if (found) { station.lat = found.lat; station.lng = found.lng; station.cellTowerId = found.cellTowerId; break; }
      }
    } catch {}
    detect(socket, user, { userConfirmed: true, overrideCellTowerId: station.cellTowerId, overrideLat: station.lat, overrideLng: station.lng });
    setHasManualOverride(true);
  };

  // ─── Detect both station and train contexts — uses real geolocation when available ───
  const detect = async (activeSocket: Socket, profile: UserProfile, opts?: { userConfirmed?: boolean; overrideCellTowerId?: string; overrideLat?: number; overrideLng?: number }) => {
    try {
      const lastPos = lastPosRef.current;
      const routeHistory = routeHistoryRef.current.length >= 2 ? routeHistoryRef.current : undefined;
      const geoSpeed = (window as any).__lastSpeedKmh as number | undefined;
      const hasCellTower = !lastPos && !opts?.overrideCellTowerId;
      const cellTower = opts?.overrideCellTowerId ? opts.overrideCellTowerId : hasCellTower ? 'TOWER_DMRC_RC_CP' : undefined;
      const lat = opts?.overrideLat ?? lastPos?.lat;
      const lng = opts?.overrideLng ?? lastPos?.lng;

      const userConfirmed = !!opts?.userConfirmed;

      const basePayload: any = {
        userId: profile.id,
        cellTowerId: cellTower,
        routeHistory,
        userConfirmed
      };
      if (lat !== undefined) basePayload.lat = lat;
      if (lng !== undefined) basePayload.lng = lng;

      const stationRes = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          movementState: 'WALKING',
          speedKmh: geoSpeed && geoSpeed < 8 ? geoSpeed : 3
        })
      });
      const stationData = await stationRes.json();
      setStationRoom(stationData.room);
      activeSocket.emit('join_room', { roomId: stationData.room.id, user: profile });

      const trainRes = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          movementState: 'IN_VEHICLE',
          speedKmh: geoSpeed && geoSpeed >= 8 ? geoSpeed : 42
        })
      });
      const trainData = await trainRes.json();
      // If user overrode, inject higher confidence hint
      setContext(trainData.context);
      setTrainRoom(trainData.room);
      activeSocket.emit('join_room', { roomId: trainData.room.id, user: profile });

      track('context_detected', profile.id, { context: trainData.context, confidence: trainData.context.confidence, station: trainData.context.stationName, routeHistoryLen: routeHistory?.length || 0 });
      track('travelers_seen', profile.id, { station: trainData.context.stationName, stationCount: stationData.room.userCount, trainCount: trainData.room.userCount });
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  // ─── Actions ───
  const handleConnect = (targetUserId: string) => {
    if (!socket || !user || !context) return;
    socket.emit('connect_request', {
      fromUser: user,
      toUserId: targetUserId,
      contextLine: context.lineName || '',
      contextStation: context.stationName || ''
    });
    track('connection_request_sent', user.id, { toUserId: targetUserId, station: context.stationName, line: context.lineName });
    track('profile_open_to_connect', user.id, {});
  };

  const handleProfileOpen = (targetUserId: string) => {
    if (!user) return;
    track('profile_open', user.id, { targetUserId });
    track('profile_open_rate', user.id, {});
  };

  const handleBlock = (targetUserId: string) => {
    if (!socket || !user) return;
    socket.emit('block_user', { userId: user.id, blockedUserId: targetUserId });
    track('user_blocked', user.id, { targetUserId });
  };

  const handleReport = (targetUserId: string, reason: string) => {
    if (!socket || !user) return;
    const activeRoom = view === 'train' ? trainRoom : stationRoom;
    socket.emit('report_user', {
      reporterId: user.id,
      reportedUserId: targetUserId,
      reason,
      roomId: activeRoom?.id
    });
    track('user_reported', user.id, { targetUserId, reason });
  };

  const handleSendMessage = (content: string) => {
    if (!socket || !user) return;
    const targetRoom = chatTarget === 'station' ? stationRoom : trainRoom;
    if (!targetRoom) return;
    socket.emit('send_message', { roomId: targetRoom.id, user, content });
    track('ephemeral_message_sent', user.id, { roomId: targetRoom.id, type: targetRoom.type });
  };

  const handleSendDM = (receiverId: string, content: string) => {
    if (!socket || !user) return;
    socket.emit('send_dm', { senderId: user.id, receiverId, content });
    track('dm_sent', user.id, { receiverId, len: content.length });
    // Don't optimistically push — rely on server's targeted 'new_dm' echo to avoid dupes/ID mismatch
  };

  const handleReaction = (targetId: string, emoji: string, targetType: 'message' | 'profile' | 'submission' = 'message', roomId?: string) => {
    if (!socket || !user) return;
    const rid = roomId || (view === 'train' ? trainRoom?.id : stationRoom?.id) || '';
    socket.emit('reaction_toggle', { targetId, targetType, userId: user.id, emoji, roomId: rid });
    track('reaction_toggle', user.id, { targetId, emoji, targetType });
  };

  // Heartbeat — keeps presence active (MVP2 live) + meaningful session metric
  useEffect(() => {
    if (!socket || !user) return;
    let meaningfulSent = false;
    const id = setInterval(() => {
      if (stationRoom) socket.emit('heartbeat', { userId: user.id, roomId: stationRoom.id });
      if (trainRoom) socket.emit('heartbeat', { userId: user.id, roomId: trainRoom.id });
      // MVP2 key metric: meaningful live session = 60s+ in live room with >=5 travelers
      if (!meaningfulSent) {
        const activeRoom = trainRoom || stationRoom;
        const cnt = activeRoom?.userCount || activeRoom?.users.length || 0;
        if (cnt >= 5) {
          meaningfulSent = true;
          track('meaningful_live_session', user.id, { roomId: activeRoom?.id, count: cnt, type: activeRoom?.type, durationSec: 60 });
        }
      }
    }, 25 * 1000);
    // also after 90s mark meaningful if still live
    const t2 = setTimeout(() => {
      if (meaningfulSent) return;
      const activeRoom = trainRoom || stationRoom;
      const cnt = activeRoom?.userCount || 0;
      if (activeRoom && cnt >= 3) {
        track('meaningful_live_session', user.id, { roomId: activeRoom.id, count: cnt, type: activeRoom.type, durationSec: 90, fallback: true });
      }
    }, 90 * 1000);
    return () => { clearInterval(id); clearTimeout(t2); };
  }, [socket, user, stationRoom?.id, trainRoom?.id, stationRoom?.userCount, trainRoom?.userCount]);

  // Fetch engagement snapshot when room switches (MVP3)
  useEffect(() => {
    if (!socket) return;
    const ids: string[] = [];
    if (stationRoom?.id) ids.push(stationRoom.id);
    if (trainRoom?.id) ids.push(trainRoom.id);
    for (const id of ids) {
      socket.emit('fetch_engagement', { roomId: id });
      // REST fallback
      fetch(`${API}/api/engagement/${id}`).then(r=>r.json()).then((snap: EngagementSnapshot)=>{
        setEngagement(prev=> ({...prev, [id]: snap}));
      }).catch(()=>{});
    }
  }, [socket, stationRoom?.id, trainRoom?.id]);

  // MVP4: Smart ranking + vibe per room
  useEffect(() => {
    if (!user) return;
    const rooms = [stationRoom, trainRoom].filter(Boolean) as ContextRoom[];
    for (const room of rooms) {
      fetch(`${API}/api/rank/${encodeURIComponent(room.id)}?viewerId=${user.id}`)
        .then(r=>r.json()).then(j=> setRankedMap(prev=> ({...prev, [room.id]: j.ranked || []}))).catch(()=>{});
      fetch(`${API}/api/vibe/${encodeURIComponent(room.id)}/${user.id}`)
        .then(r=>r.json()).then(j=> setVibeMap(prev=> ({...prev, [room.id]: j.vibe || []}))).catch(()=>{});
    }
  }, [user, stationRoom?.id, trainRoom?.id, stationRoom?.userCount, trainRoom?.userCount]);

  // Heartbeat also refresh ranking periodically
  useEffect(()=>{
    if (!user || (!stationRoom && !trainRoom)) return;
    const id = setInterval(()=>{
      const rooms = [stationRoom, trainRoom].filter(Boolean) as ContextRoom[];
      for (const room of rooms) {
        fetch(`${API}/api/rank/${encodeURIComponent(room.id)}?viewerId=${user.id}`)
          .then(r=>r.json()).then(j=> setRankedMap(prev=> ({...prev, [room.id]: j.ranked || []}))).catch(()=>{});
      }
    }, 20*1000);
    return ()=> clearInterval(id);
  }, [user, stationRoom?.id, trainRoom?.id]);

  // Fetch DM history when a friend is selected
  useEffect(() => {
    if (!socket || !user || !selectedFriend) return;
    // Socket path (live)
    socket.emit('fetch_dm_history', { userId: user.id, friendId: selectedFriend.friendId });
    // REST fallback for cold start / reconnect
    fetch(`${API}/api/dm/${user.id}/${selectedFriend.friendId}`)
      .then(r => r.json())
      .then(d => {
        if (d.messages && d.messages.length) {
          setFriendDMs(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = (d.messages as DirectMessage[]).filter(m => !existingIds.has(m.id));
            return [...prev, ...newOnes].sort((a,b) => a.timestamp - b.timestamp);
          });
        }
      }).catch(() => {});
  }, [selectedFriend, socket, user]);

  const openChat = (target: 'station' | 'train') => {
    setChatTarget(target);
    setView('chat');
    if (user) track('room_chat_opened', user.id, { target });
  };

  const activeRoom = view === 'chat'
    ? (chatTarget === 'station' ? stationRoom : trainRoom)
    : null;

  const friendIds = friends.map(f => f.friendId);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 12px' }}>
      {/* ── Top Bar ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Train size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1 }}>CoRide</h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Who is around you right now?
              {beachhead?.isBeachhead && (
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(16,185,129,0.12)', color: 'var(--accent-emerald)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 10, fontWeight: 800, letterSpacing: '0.02em' }}>
                  BEACHHEAD: {beachhead.line.toUpperCase()}
                </span>
              )}
            </p>
          </div>
        </div>

        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: user.avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
                color: 'white'
              }}>
                {user.pseudonym.substring(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {user.pseudonym}
              </span>
              <div className="presence-dot active" style={{ width: 8, height: 8 }} />
            </div>
            <button onClick={()=>setShowProfileEditor(true)} title="Edit profile — enhance discovery" style={{ padding:'6px 10px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              ✎ Edit
            </button>
          </div>
        )}
      </header>
      {showProfileEditor && user && (
        <ProfileEditor user={user} onClose={()=>setShowProfileEditor(false)} onSaved={(np)=>{ setUser(np); showToast('Profile enhanced ✓ — better vibe matches'); track('profile_enhanced', np.id, { tags: np.interestTags.length }); }} />
      )}

      {/* ── Detection Telemetry ── */}
      {context && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 14px',
          marginBottom: 12,
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: context.confidence < 0.6 ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border-subtle)',
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <Radio size={14} style={{ color: hasManualOverride ? 'var(--accent-emerald)' : 'var(--accent-blue)' }} />
              <span>{hasManualOverride ? 'Confirmed' : 'Auto-detected'}: <strong style={{ color: 'var(--text-primary)' }}>{context.stationName}</strong></span>
            </div>
            <ContextConfidenceBadge context={context} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {context.confidence < 0.6 && !hasManualOverride && (
              <span style={{ fontSize: 11, color: 'var(--accent-amber)', fontWeight: 600 }}>Low confidence — please confirm</span>
            )}
            <button
              onClick={() => setShowStationPicker(true)}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: hasManualOverride ? 'rgba(16,185,129,0.12)' : context.confidence < 0.6 ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                border: `1px solid ${hasManualOverride ? 'rgba(16,185,129,0.3)' : context.confidence < 0.6 ? 'rgba(245,158,11,0.5)' : 'var(--border-subtle)'}`,
                color: hasManualOverride ? 'var(--accent-emerald)' : context.confidence < 0.6 ? 'black' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {hasManualOverride ? '✓ Confirmed — Change' : context.confidence < 0.6 ? 'Confirm Station' : 'Change station'}
            </button>
          </div>
          {context.reason && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
              {context.reason}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                • {context.breakdown.stationMatch}+{context.breakdown.routeMatch}+{context.breakdown.movementMatch}+{context.breakdown.scheduleMatch}{context.breakdown.userConfirm ? `+${context.breakdown.userConfirm}` : ''} = {context.rawScore} → {Math.round(context.confidence*100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {showStationPicker && (
        <StationPicker
          onConfirm={(st, _line) => handleStationPicked(st)}
          onDismiss={() => setShowStationPicker(false)}
        />
      )}

      {/* MVP2 commute window push — only when live and permission not yet granted */}
      {commuteLive && pushPermission !== 'granted' && pushPermission !== 'denied' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          marginBottom: 12,
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(14,165,233,0.12))',
          border: '1px solid rgba(16,185,129,0.3)',
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Radio size={14} style={{ color: 'var(--presence-active)', flexShrink: 0 }} className="animate-pulse-glow" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.2 }}>Commute window live — 38+ travelers online</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Get notified when your route gets bustling</div>
            </div>
          </div>
          <button
            onClick={requestPush}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-emerald)',
              color: 'black',
              border: 'none',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Enable
          </button>
        </div>
      )}
      {commuteLive && pushPermission === 'granted' && (
        <div style={{
          padding: '8px 14px',
          marginBottom: 12,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.22)',
          fontSize: 11,
          color: 'var(--presence-active)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Radio size={12} /> Commute window live — you’ll be notified
        </div>
      )}

      {/* MVP4: Saved commute — one-tap repeat entry */}
      {user && (
        <div style={{ marginBottom: 12 }}>
          <SavedCommutes userId={user.id} onUse={handleUseCommute} />
        </div>
      )}

      {/* ── Navigation ── */}
      {view !== 'chat' && (
        <nav style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          padding: '4px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            className={`nav-pill ${view === 'station' ? 'active-station' : ''}`}
            onClick={() => setView('station')}
          >
            <MapPin size={14} />
            Station
            {stationRoom && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: view === 'station' ? 'var(--accent-emerald)' : 'var(--text-muted)'
              }}>
                {stationRoom.userCount || stationRoom.users.length}
              </span>
            )}
          </button>

          <button
            className={`nav-pill ${view === 'train' ? 'active-train' : ''}`}
            onClick={() => setView('train')}
          >
            <Train size={14} />
            Train
            {trainRoom && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: view === 'train' ? 'var(--accent-indigo)' : 'var(--text-muted)'
              }}>
                {trainRoom.userCount || trainRoom.users.length}
              </span>
            )}
          </button>

          <button
            className={`nav-pill ${view === 'friends' ? 'active-friends' : ''}`}
            onClick={() => {
              setView('friends');
              if (user) {
                fetch(`${API}/api/friends/${user.id}`)
                  .then(r => r.json())
                  .then(d => setFriends(
                    (d.friends || []).map((f: FriendEntry) => ({
                      id: f.id,
                      friendId: f.id,
                      friendProfile: f.profile,
                      connectedAtLine: '',
                      connectedAtStation: '',
                      createdAt: Date.now(),
                      unreadCount: 0
                    }))
                  ));
              }
            }}
          >
            <MessageCircle size={14} />
            Friends
            {friends.length > 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-purple)',
                color: 'white'
              }}>
                {friends.length}
              </span>
            )}
          </button>
        </nav>
      )}

      {/* ── Views — MVP2 product moment header ── */}

      {view === 'station' && stationRoom && user && (
        <>
          <div style={{ marginBottom: 10 }}>
            <LiveRoomHeader room={stationRoom} />
          </div>
          <DiscoveryScreen
            room={stationRoom}
            context={context}
            currentUser={user}
            friendIds={friendIds}
            ranked={rankedMap[stationRoom.id]}
            vibe={vibeMap[stationRoom.id]}
            onConnect={handleConnect}
            onBlock={handleBlock}
            onReport={handleReport}
            onOpenChat={() => openChat('station')}
            onProfileOpen={handleProfileOpen}
          />
          <div style={{ marginTop: 14 }}>
            <EngagementHub room={stationRoom} snapshot={engagement[stationRoom.id] || null} currentUser={user} socket={socket} onReaction={(tid, emoji, ttype, rid) => handleReaction(tid, emoji, ttype as any, rid)} />
          </div>
        </>
      )}

      {view === 'train' && trainRoom && user && (
        <>
          <div style={{ marginBottom: 10 }}>
            <LiveRoomHeader room={trainRoom} />
          </div>
          <DiscoveryScreen
            room={trainRoom}
            context={context}
            currentUser={user}
            friendIds={friendIds}
            ranked={rankedMap[trainRoom.id]}
            vibe={vibeMap[trainRoom.id]}
            onConnect={handleConnect}
            onBlock={handleBlock}
            onReport={handleReport}
            onOpenChat={() => openChat('train')}
            onProfileOpen={handleProfileOpen}
          />
          <div style={{ marginTop: 14 }}>
            <EngagementHub room={trainRoom} snapshot={engagement[trainRoom.id] || null} currentUser={user} socket={socket} onReaction={(tid, emoji, ttype, rid) => handleReaction(tid, emoji, ttype as any, rid)} />
          </div>
        </>
      )}

      {view === 'chat' && activeRoom && user && (
        <ChatView
          room={activeRoom}
          currentUser={user}
          onSendMessage={handleSendMessage}
          onBack={() => setView(chatTarget)}
          socket={socket}
          typingUsers={typingUsers[activeRoom.id] || []}
          reactions={engagement[activeRoom.id]?.reactions as any}
          onReaction={(tid, emoji) => handleReaction(tid, emoji, 'message', activeRoom.id)}
        />
      )}

      {view === 'friends' && user && (
        <FriendsTab
          friends={friends}
          currentUser={user}
          activeDMs={friendDMs}
          selectedFriend={selectedFriend}
          onSelectFriend={setSelectedFriend}
          onSendDM={handleSendDM}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
