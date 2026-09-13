import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { useSocket } from './hooks/useSocket';
import { setToken, getToken, authHeaders } from './utils/auth';
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
import { BottomNav, type NavView } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ConnectScreen } from './components/ConnectScreen';
import { ProfileSheet } from './components/ProfileSheet';
import { ProfileSheetContent } from './components/ProfileSheetContent';
import { ProfileSheetActions } from './components/ProfileSheetActions';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DiscoverAroundYou } from './components/DiscoverAroundYou';
import { ChatsScreen } from './components/ChatsScreen';
import { DirectChatScreen } from './components/DirectChatScreen';
import { LiveTrackingScreen } from './components/LiveTrackingScreen';
import { ProfileStatsScreen } from './components/ProfileStatsScreen';
import { RoomScreen } from './components/RoomScreen';
import { useCommuteNotifications } from './hooks/useCommuteNotifications';
import { track } from './utils/analytics';
import { SafetyCenterScreen } from './components/safety/SafetyCenterScreen';
import { BlockedUsersScreen } from './components/safety/BlockedUsersScreen';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { flushOfflineQueue } from './utils/offlineQueue';
import { CheckInScreen } from './components/transit/CheckInScreen';
import { DELHI_METRO_LINES } from './data/metroData';
import type { EngagementSnapshot } from './types/engagement';
import type {
  UserProfile,
  ContextRoom,
  ContextResult,
  DirectMessage,
  FriendEntry
} from './types';

const API = 'http://localhost:4000';

type View = 'home' | 'people' | 'discover' | 'liveTracking' | 'chat' | 'chats' | 'connect' | 'profile' | 'friends' | 'room' | 'safetyCenter' | 'blockedUsers';

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const { socket, connected: socketConnected } = useSocket(user ? getToken() : null);
  const [context, setContext] = useState<ContextResult | null>(null);
  const [stationRoom, setStationRoom] = useState<ContextRoom | null>(null);
  const [trainRoom, setTrainRoom] = useState<ContextRoom | null>(null);
  const [view, setView] = useState<View>('home');
  const [chatTarget, setChatTarget] = useState<'station' | 'train'>('train');
  const [friends, setFriends] = useState<MetroFriend[]>([]);
  const [friendDMs, setFriendDMs] = useState<DirectMessage[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<MetroFriend | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [showCheckInScreen, setShowCheckInScreen] = useState(false);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [beachhead, setBeachhead] = useState<{ line: string; isBeachhead: boolean; activeLines: any[] } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; pseudonym: string }[]>>({});
  const [engagement, setEngagement] = useState<Record<string, EngagementSnapshot>>({});
  const [rankedMap, setRankedMap] = useState<Record<string, any[]>>({});
  const [vibeMap, setVibeMap] = useState<Record<string, any[]>>({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // used to silence noUnusedLocals for demo state
  const _keep1 = beachhead; const _keep2 = setSelectedFriend; void _keep1; void _keep2;
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedPresenceRoomId, setSelectedPresenceRoomId] = useState<string>('rajiv_chowk:blue:towards_noida');
  const routeHistoryRef = useRef<{ lat: number; lng: number; t: number }[]>([]);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const { permission: pushPermission, isLive: commuteLive, requestPermission: requestPush } = useCommuteNotifications(!!user);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Bootstrap with persistence ───
  useEffect(() => {
    const STORAGE_KEY = 'coride_profile';
    const stored = localStorage.getItem(STORAGE_KEY);
    const initWithProfile = (profile: UserProfile, token?: string) => {
      if (token) setToken(token); // signed device token → authenticates every request
      setUser(profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      detect(socket, profile);
      track('session_start', profile.id, { stationHint: 'auto' });
      track('activated_user', profile.id, {});
    };

    if (stored) {
      try {
        const parsed: UserProfile = JSON.parse(stored);
        fetch(`${API}/api/auth/restore/${parsed.id}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(d => initWithProfile(d.profile, d.token))
          .catch(() => { initWithProfile(parsed); });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        fetch(`${API}/api/auth/random-profile`).then(r => r.json()).then(data => initWithProfile(data.profile, data.token));
      }
    } else {
      fetch(`${API}/api/auth/random-profile`).then(r => r.json()).then(data => initWithProfile(data.profile, data.token));
    }

    socket.on('room_updated', (roomData: ContextRoom) => {
      if (roomData.type === 'station') setStationRoom(roomData);
      else setTrainRoom(roomData);
      track('travelers_seen', undefined, { roomId: roomData.id, type: roomData.type, count: (roomData as any).userCount ?? (roomData as any).users?.length ?? 0 });
    });

    socket.on('new_message', (msg) => {
      setStationRoom(prev => { if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] }; return prev; });
      setTrainRoom(prev => { if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] }; return prev; });
    });

    socket.on('connection_result', (result: { success: boolean; message: string }) => {
      showToast(result.message);
      if (result.success) track('connection_request_sent', undefined, { message: result.message });
    });

    socket.on('connection_accepted', ({ message, userA, userB }: { userA: string; userB: string; message: string }) => {
      showToast(message);
      track('connection_accepted', undefined, { userA, userB });
      track('mutual_acceptance', undefined, { userA, userB });
    });

    socket.on('block_result', (result: { message: string }) => showToast(result.message));
    socket.on('report_result', (result: { message: string }) => showToast(result.message));
    socket.on('moderation_action', ({ message }: { message: string }) => showToast(`⚠️ ${message}`));
    socket.on('new_dm', (dm: DirectMessage) => setFriendDMs(prev => {
      if (prev.some(x => x.id === dm.id)) return prev;
      return [...prev, dm];
    }));
    socket.on('dm_history', ({ messages }: { friendId: string; messages: DirectMessage[] }) => {
      setFriendDMs(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = messages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newOnes].sort((a,b) => a.timestamp - b.timestamp);
      });
    });

    socket.on('live_count_tick', (payload: { roomId: string; count: number; presence: any }) => {
      setStationRoom(prev => prev && payload.roomId === prev.id ? { ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom : prev);
      setTrainRoom(prev => prev && payload.roomId === prev.id ? { ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom : prev);
    });
    socket.on('commute_window_live', (payload: { title: string; body: string }) => {
      showToast(`${payload.title}: ${payload.body}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(payload.title, { body: payload.body, icon: '/vite.svg' }); } catch {}
      }
      track('commute_window_push_received', undefined, payload as any);
    });
    socket.on('commute_window_room_live', (p: { roomId: string; count: number }) => {
      track('commute_window_room_live', undefined, p as any);
    });
    socket.on('user_typing', (p: { roomId: string; userId: string; pseudonym: string }) => {
      setTypingUsers(prev => {
        const cur = prev[p.roomId] || [];
        if (cur.some(u => u.userId === p.userId)) return prev;
        return { ...prev, [p.roomId]: [...cur, { userId: p.userId, pseudonym: p.pseudonym }] };
      });
      setTimeout(() => {
        setTypingUsers(prev => {
          const cur = prev[p.roomId] || [];
          return { ...prev, [p.roomId]: cur.filter(u => u.userId !== p.userId) };
        });
      }, 4000);
    });
    socket.on('user_stop_typing', (p: { roomId: string; userId: string }) => {
      setTypingUsers(prev => {
        const cur = prev[p.roomId] || [];
        return { ...prev, [p.roomId]: cur.filter(u => u.userId !== p.userId) };
      });
    });
    socket.on('engagement_updated', (snap: EngagementSnapshot) => {
      setEngagement(prev => ({ ...prev, [snap.roomId]: snap }));
    });
    socket.on('reaction_updated', (p: { targetId: string; state: any; roomId?: string }) => {
      setEngagement(prev => {
        const next = { ...prev };
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
        const first = Object.keys(next)[0];
        if (first) {
          next[first] = { ...next[first], reactions: { ...next[first].reactions, [p.targetId]: p.state } };
        }
        return next;
      });
    });
    socket.on('game_error', (p: { error: string }) => showToast(`⚠️ ${p.error}`));

    // The socket's lifecycle is owned by useSocket now; just detach the
    // listeners this effect registered so they don't stack on re-mount.
    return () => {
      socket.off('room_updated'); socket.off('new_message');
      socket.off('connection_result'); socket.off('connection_accepted');
      socket.off('block_result'); socket.off('report_result'); socket.off('moderation_action');
      socket.off('new_dm'); socket.off('dm_history');
      socket.off('live_count_tick'); socket.off('commute_window_live'); socket.off('commute_window_room_live');
      socket.off('user_typing'); socket.off('user_stop_typing');
      socket.off('engagement_updated'); socket.off('reaction_updated'); socket.off('game_error');
    };
  }, []);

  // Fetch beachhead info
  useEffect(() => {
    fetch(`${API}/api/metro/beachhead`).then(r => r.json()).then(setBeachhead).catch(() => {});
  }, []);

  // Offline tunnel queue auto-flush on reconnect
  useEffect(() => {
    if (socketConnected && socket && user) {
      flushOfflineQueue(
        (roomId, content) => {
          socket.emit('chat_message', { roomId, senderId: user.id, content });
        },
        (receiverId, content) => {
          socket.emit('send_dm', { senderId: user.id, receiverId, content });
        }
      ).then(count => {
        if (count > 0) showToast(`Synced ${count} queued messages ✓`);
      });
    }
  }, [socketConnected, socket, user, showToast]);

  // Onboarding check — if tags <2 or no onboard flag, show
  useEffect(() => {
    if (!user) return;
    const hasTags = user.interestTags && user.interestTags.length >= 2;
    if (!hasTags && !localStorage.getItem('coride_onboarded')) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, speed } = pos.coords;
        lastPosRef.current = { lat: latitude, lng: longitude };
        routeHistoryRef.current.push({ lat: latitude, lng: longitude, t: Date.now() });
        if (routeHistoryRef.current.length > 8) routeHistoryRef.current.shift();
        if (speed !== null && speed !== undefined) {
          (window as any).__lastSpeedKmh = speed * 3.6;
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Auto-nudge manual picker when confidence is low
  useEffect(() => {
    if (!context) return;
    if (hasManualOverride) return;
    if (context.confidence < 0.6) {
      const t = setTimeout(() => setShowStationPicker(true), 1200);
      return () => clearTimeout(t);
    }
  }, [context, hasManualOverride]);

  const handleStationPicked = (station: { id: string; name: string; lat: number; lng: number; cellTowerId?: string }) => {
    if (!socket || !user) return;
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

  const handleHeroCheckIn = async (lineId: string, stationId: string, direction: string) => {
    if (!socket || !user) return;
    if (stationRoom) socket.emit('leave_room', { roomId: stationRoom.id, userId: user.id });
    if (trainRoom) socket.emit('leave_room', { roomId: trainRoom.id, userId: user.id });

    let stationLat = 28.6328;
    let stationLng = 77.2197;
    let stationName = stationId;
    const lineObj = DELHI_METRO_LINES.find(l => l.id === lineId);
    const stObj = lineObj?.stations.find(s => s.id === stationId);
    if (stObj) {
      stationLat = stObj.lat;
      stationLng = stObj.lng;
      stationName = stObj.name;
    }

    setHasManualOverride(true);
    await detect(socket, user, {
      userConfirmed: true,
      overrideLat: stationLat,
      overrideLng: stationLng,
      overrideCellTowerId: `TOWER_DMRC_${stationId.toUpperCase()}`
    });

    showToast(`Checked in to ${stationName} (${direction}) ✓`);

    setTimeout(() => {
      setShowCheckInScreen(false);
      setView('people');
    }, 700);
  };

  const handleUseCommute = async (pattern: any, roomFromServer?: any) => {
    if (!socket || !user) return;
    if (stationRoom) socket.emit('leave_room', { roomId: stationRoom.id, userId: user.id });
    if (trainRoom) socket.emit('leave_room', { roomId: trainRoom.id, userId: user.id });
    showToast(`→ ${pattern.stationName} • ${pattern.targetTime} • re-entering`);
    track('commute_pattern_used', user.id, { patternId: pattern.id, station: pattern.stationName });
    if (roomFromServer) {
      const room = roomFromServer;
      if (room.type === 'station') {
        setStationRoom(room);
        setContext({ stationName: pattern.stationName, lineName: pattern.lineName, lineColor: pattern.lineColor, direction: pattern.direction, confidence: 0.95, breakdown: { stationMatch:30, routeMatch:25, movementMatch:10, scheduleMatch:20, userConfirm:50 }, rawScore:135, station:pattern.stationId, line:pattern.lineId, id:'', reason:'One-tap commute' } as any);
        socket.emit('join_room', { roomId: room.id, user });
      } else {
        setTrainRoom(room);
        socket.emit('join_room', { roomId: room.id, user });
      }
      setHasManualOverride(true);
      setView('people');
      return;
    }
    const station = { id: pattern.stationId, name: pattern.stationName, lat: 28.6328, lng: 77.2197, cellTowerId: `TOWER_DMRC_${pattern.stationId.toUpperCase()}` };
    try {
      const lines = await fetch(`${API}/api/metro/lines`).then(r=>r.json());
      for (const line of lines.lines || []) {
        const found = line.stations.find((s:any)=> s.id===pattern.stationId);
        if (found) { station.lat = found.lat; station.lng = found.lng; station.cellTowerId = found.cellTowerId; break; }
      }
    } catch {}
    detect(socket, user, { userConfirmed: true, overrideCellTowerId: station.cellTowerId, overrideLat: station.lat, overrideLng: station.lng });
    setHasManualOverride(true);
    setView('people');
  };

  // Detect
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
        body: JSON.stringify({ ...basePayload, movementState: 'WALKING', speedKmh: geoSpeed && geoSpeed < 8 ? geoSpeed : 3 })
      });
      const stationData = await stationRes.json();
      setStationRoom(stationData.room);
      activeSocket.emit('join_room', { roomId: stationData.room.id, user: profile });
      const trainRes = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, movementState: 'IN_VEHICLE', speedKmh: geoSpeed && geoSpeed >= 8 ? geoSpeed : 42 })
      });
      const trainData = await trainRes.json();
      setContext(trainData.context);
      setTrainRoom(trainData.room);
      activeSocket.emit('join_room', { roomId: trainData.room.id, user: profile });
      track('context_detected', profile.id, { context: trainData.context, confidence: trainData.context.confidence, station: trainData.context.stationName, routeHistoryLen: routeHistory?.length || 0 });
      track('travelers_seen', profile.id, { station: trainData.context.stationName, stationCount: stationData.room.userCount, trainCount: trainData.room.userCount });
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  const handleConnect = (targetUserId: string) => {
    if (!socket || !user || !context) return;
    socket.emit('connect_request', { fromUser: user, toUserId: targetUserId, contextLine: context.lineName || '', contextStation: context.stationName || '' });
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
    const activeRoom = view === 'chat' ? (chatTarget==='station'?stationRoom:trainRoom) : (trainRoom || stationRoom);
    socket.emit('report_user', { reporterId: user.id, reportedUserId: targetUserId, reason, roomId: activeRoom?.id });
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
  };
  void handleSendDM;
  const handleReaction = (targetId: string, emoji: string, targetType: 'message' | 'profile' | 'submission' = 'message', roomId?: string) => {
    if (!socket || !user) return;
    const rid = roomId || (view === 'chat' ? (chatTarget==='station'?stationRoom?.id:trainRoom?.id) : (trainRoom?.id || stationRoom?.id)) || '';
    socket.emit('reaction_toggle', { targetId, targetType, userId: user.id, emoji, roomId: rid });
    track('reaction_toggle', user.id, { targetId, emoji, targetType });
  };

  // Heartbeat
  useEffect(() => {
    if (!socket || !user) return;
    let meaningfulSent = false;
    const id = setInterval(() => {
      if (stationRoom) socket.emit('heartbeat', { userId: user.id, roomId: stationRoom.id });
      if (trainRoom) socket.emit('heartbeat', { userId: user.id, roomId: trainRoom.id });
      if (!meaningfulSent) {
        const activeRoom = trainRoom || stationRoom;
        const cnt = activeRoom?.userCount || activeRoom?.users.length || 0;
        if (cnt >= 5) {
          meaningfulSent = true;
          track('meaningful_live_session', user.id, { roomId: activeRoom?.id, count: cnt, type: activeRoom?.type, durationSec: 60 });
        }
      }
    }, 25 * 1000);
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

  // Engagement fetch
  useEffect(() => {
    if (!socket) return;
    const ids: string[] = [];
    if (stationRoom?.id) ids.push(stationRoom.id);
    if (trainRoom?.id) ids.push(trainRoom.id);
    for (const id of ids) {
      socket.emit('fetch_engagement', { roomId: id });
      fetch(`${API}/api/engagement/${id}`).then(r=>r.json()).then((snap: EngagementSnapshot)=>{
        setEngagement(prev=> ({...prev, [id]: snap}));
      }).catch(()=>{});
    }
  }, [socket, stationRoom?.id, trainRoom?.id]);

  // Ranking
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

  // DM history
  useEffect(() => {
    if (!socket || !user || !selectedFriend) return;
    socket.emit('fetch_dm_history', { userId: user.id, friendId: selectedFriend.friendId });
    fetch(`${API}/api/dm/${user.id}/${selectedFriend.friendId}`, { headers: { ...authHeaders() } })
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

  const activeRoom = view === 'chat' ? (chatTarget === 'station' ? stationRoom : trainRoom) : null;
  const friendIds = friends.map(f => f.friendId);
  const activePeopleRoom = trainRoom || stationRoom;
  const navActive: NavView = view === 'home' ? 'home' : view === 'liveTracking' ? 'liveTracking' : view === 'people' || view === 'discover' || view === 'connect' || view === 'room' ? 'people' : view === 'chats' || view === 'chat' || view === 'friends' ? 'chats' : (view === 'profile' || view === 'safetyCenter' || view === 'blockedUsers') ? 'profile' : 'home';

  const handleBottomNav = (v: NavView) => {
    if (v === 'home') setView('home');
    else if (v === 'liveTracking') setView('liveTracking');
    else if (v === 'people') setView('people');
    else if (v === 'chats') {
      setView('chats');
      if (user) {
        fetch(`${API}/api/friends/${user.id}`).then(r=>r.json()).then(d=> setFriends((d.friends||[]).map((f: FriendEntry)=>({ id:f.id, friendId:f.id, friendProfile:f.profile, connectedAtLine:'', connectedAtStation:'', createdAt:Date.now(), unreadCount:0 }))));
      }
    }
    else if (v === 'connect') setView('connect');
    else if (v === 'profile') setView('profile');
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 12px 86px', minHeight:'100vh', background:'var(--bg-base)' }}>
      {/* Offline Subway Tunnel Alert */}
      {!socketConnected && (
        <div style={{ marginBottom: 10 }}>
          <OfflineBanner lastSyncTime={new Date()} />
        </div>
      )}

      {showOnboarding && user && (
        <OnboardingScreen
          user={user}
          onComplete={(np)=>{ setUser(np); setShowOnboarding(false); localStorage.setItem('coride_onboarded','1'); showToast('Welcome aboard! 🎉'); }}
          onSkip={()=>{ setShowOnboarding(false); localStorage.setItem('coride_onboarded','1'); }}
          onSelectManualStation={() => setShowStationPicker(true)}
        />
      )}
      {/* Home */}
      {view === 'home' && (
        <>
          <HomeScreen
            user={user}
            contextStationName={context?.stationName}
            contextLineName={context?.lineName}
            stationRoom={stationRoom}
            trainRoom={trainRoom}
            vibe={activePeopleRoom ? vibeMap[activePeopleRoom.id] : []}
            engagement={engagement}
            onViewAllPeople={()=> setView('people')}
            onOpenRoom={(roomId)=> {
              if (roomId) setSelectedPresenceRoomId(roomId);
              setView('room');
            }}
            onJoinRoom={(roomId)=> {
              const room = stationRoom?.id===roomId ? stationRoom : trainRoom?.id===roomId ? trainRoom : null;
              if (room) { setChatTarget(room.type==='train'?'train':'station'); setView('chat'); }
            }}
            onOpenLiveTracking={()=> setView('liveTracking')}
            onOpenCheckIn={()=> setShowCheckInScreen(true)}
          />
          {/* Saved commutes compact on home */}
          {user && (
            <div style={{ marginTop:12 }}>
              <SavedCommutes userId={user.id} onUse={handleUseCommute} />
            </div>
          )}
        </>
      )}

      {/* People List — 02 */}
      {view === 'people' && activePeopleRoom && user && (
        <>
          <LiveRoomHeader room={activePeopleRoom} />
          <div style={{ height:10 }} />
          <DiscoveryScreen
            room={activePeopleRoom}
            context={context}
            currentUser={user}
            friendIds={friendIds}
            ranked={rankedMap[activePeopleRoom.id]}
            vibe={vibeMap[activePeopleRoom.id]}
            onConnect={handleConnect}
            onBlock={handleBlock}
            onReport={handleReport}
            onProfileOpen={handleProfileOpen}
          />
          <div style={{ marginTop:14 }}>
            <EngagementHub room={activePeopleRoom} snapshot={engagement[activePeopleRoom.id] || null} currentUser={user} socket={socket} onReaction={(tid, emoji, ttype, rid)=> handleReaction(tid, emoji, ttype as any, rid)} />
          </div>
          {/* Station picker + telemetry subtle */}
          {showStationPicker && (
            <StationPicker onConfirm={(st,_line)=> handleStationPicked(st)} onDismiss={()=> setShowStationPicker(false)} />
          )}
          {context && (
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8, padding:'10px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)' }}><Radio size={12} style={{ color: hasManualOverride?'var(--accent-emerald)':'var(--accent-blue)' }}/> {hasManualOverride?'Confirmed':'Auto'}: <strong style={{ color:'var(--text-primary)' }}>{context.stationName}</strong></span>
                <button onClick={()=> setShowCheckInScreen(true)} style={{ background:'none', border:'none', color:'var(--accent-purple-text)', fontSize:11, fontWeight:700, cursor:'pointer' }}>Change</button>
              </div>
              <ContextConfidenceBadge context={context} />
            </div>
          )}
        </>
      )}

      {/* Discover Around You — 07 */}
      {view === 'discover' && user && activePeopleRoom && (
        <DiscoverAroundYou
          user={user}
          room={activePeopleRoom}
          ranked={rankedMap[activePeopleRoom.id]}
          engagement={engagement}
          onProfile={(u)=> setSelectedUser(u)}
          onJoinRoom={()=> { setChatTarget('train'); setView('chat'); }}
          onSeeAllPeople={()=> setView('people')}
        />
      )}

      {/* Live Tracking — 09 */}
      {view === 'liveTracking' && user && (
        <LiveTrackingScreen
          currentUser={user}
          friends={friends}
          currentContext={context}
          activeRoom={activeRoom}
          onBack={() => setView('people')}
          onOpenChat={(fid) => {
            const f = friends.find(x => x.id === fid || x.friendId === fid);
            if (f) {
              setSelectedFriend(f);
              setView('chats');
            }
          }}
          onOpenProfile={(p) => setSelectedUser(p)}
          onContextUpdated={(c) => setContext(c)}
        />
      )}

      {/* Chat — 04 Train Room */}
      {view === 'chat' && activeRoom && user && (
        <ChatView
          room={activeRoom}
          currentUser={user}
          onSendMessage={handleSendMessage}
          onBack={()=> setView(activePeopleRoom ? 'people' : 'home')}
          socket={socket}
          typingUsers={typingUsers[activeRoom.id] || []}
          reactions={engagement[activeRoom.id]?.reactions as any}
          onReaction={(tid, emoji)=> handleReaction(tid, emoji, 'message', activeRoom.id)}
        />
      )}

      {/* Chats List — 08 */}
      {view === 'chats' && user && (
        <>
          {selectedFriend ? (
            // Full-screen overlay so the 100dvh chat escapes the padded app shell
            // and sits above the bottom nav.
            <div className="animate-push" style={{ position:'fixed', inset:0, left:0, right:0, maxWidth:520, margin:'0 auto', zIndex:60, background:'var(--bg-base)' }}>
              <DirectChatScreen
                currentUser={user}
                peer={{
                  id: selectedFriend.friendId,
                  pseudonym: selectedFriend.friendProfile.pseudonym,
                  username: selectedFriend.friendProfile.username,
                  avatarBg: selectedFriend.friendProfile.avatarBg
                }}
                onBack={()=> setSelectedFriend(null)}
              />
            </div>
          ) : (
            <ChatsScreen
              friends={friends}
              onSelect={(id)=> {
                const f = friends.find(x=> (x.friendId===id || x.id===id));
                if (f) setSelectedFriend(f);
                else showToast('Chat opened');
              }}
            />
          )}
        </>
      )}

      {/* Connect — 05 */}
      {view === 'connect' && user && (
        <ConnectScreen currentUser={user} socket={socket} />
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

      {/* Profile Stats / Account Screen */}
      {view === 'profile' && user && (
        <ProfileStatsScreen
          user={user}
          onEdit={() => setShowProfileEditor(true)}
          onOpenSafetyCenter={() => setView('safetyCenter')}
          onOpenBlockedUsers={() => setView('blockedUsers')}
          onAccountDeleted={() => {
            setUser(null);
            setShowOnboarding(true);
            showToast('Account permanently deleted.');
          }}
        />
      )}

      {/* Safety Centre Screen */}
      {view === 'safetyCenter' && (
        <SafetyCenterScreen onBack={() => setView('profile')} />
      )}

      {/* Blocked Users Screen */}
      {view === 'blockedUsers' && (
        <BlockedUsersScreen
          onBack={() => setView('profile')}
          onUnblocked={() => {
            showToast('Commuter unblocked ✓');
          }}
        />
      )}

      {/* Live Room Presence Screen */}
      {view === 'room' && (
        <RoomScreen
          currentUser={user}
          initialRoomId={selectedPresenceRoomId}
          onBack={()=> setView('home')}
          onProfileOpen={(u)=> setSelectedUser(u)}
          onConnect={(targetId)=> handleConnect(targetId)}
          socket={socket}
          socketConnected={socketConnected}
        />
      )}



      {/* Profile editor overlay */}
      {showProfileEditor && user && (
        <ProfileEditor user={user} onClose={()=> setShowProfileEditor(false)} onSaved={(np)=>{ setUser(np); showToast('Profile enhanced ✓'); track('profile_enhanced', np.id, { tags: np.interestTags.length }); }} />
      )}

      {/* Selected user profile sheet */}
      <ProfileSheet
        open={selectedUser !== null && view !== 'profile' && view !== 'home'}
        onClose={() => setSelectedUser(null)}
        labelledBy="app-profile-sheet-title"
      >
        {selectedUser && (
          <>
            <ProfileSheetContent
              traveler={selectedUser}
              titleId="app-profile-sheet-title"
              isFriend={friendIds.includes(selectedUser.id)}
              currentContext={context}
              activeRoomId={activeRoom?.id}
            />
            <ProfileSheetActions
              initialState={
                selectedUser.id === user?.id
                  ? 'already-friends'
                  : friendIds.includes(selectedUser.id)
                    ? 'already-friends'
                    : 'idle'
              }
              onSendRequest={() => {
                if (selectedUser) handleConnect(selectedUser.id);
              }}
              onReport={() => {
                if (selectedUser) handleReport(selectedUser.id, 'General report');
                setSelectedUser(null);
              }}
              onBlock={() => {
                if (selectedUser) handleBlock(selectedUser.id);
                setSelectedUser(null);
              }}
            />
          </>
        )}
      </ProfileSheet>

      {/* Station picker */}
      {showStationPicker && view==='home' && (
        <StationPicker onConfirm={(st,_line)=> handleStationPicked(st)} onDismiss={()=> setShowStationPicker(false)} />
      )}

      {/* ══ The One Bold Element: Hero Check-In Screen & Orchestrated Moment ══ */}
      {showCheckInScreen && user && (
        <CheckInScreen
          onCheckIn={handleHeroCheckIn}
          onCancel={() => setShowCheckInScreen(false)}
          initialLineId={context?.line || 'blue'}
          initialStationId={context?.station || 'rajiv_chowk'}
          initialDirection={context?.direction}
        />
      )}

      {/* Toast — announced to screen readers */}
      {toast && (
        <div role="status" aria-live="polite" className="glass animate-fade-in" style={{ position:'fixed', bottom:'calc(86px + env(safe-area-inset-bottom))', left:'50%', transform:'translateX(-50%)', padding:'10px 18px', borderRadius:999, color:'var(--text-primary)', fontSize:13, fontWeight:700, zIndex:100 }}>
          {toast}
        </div>
      )}

      {/* Commute window push banner (subtle) */}
      {commuteLive && pushPermission!=='granted' && pushPermission!=='denied' && view==='home' && (
        <div style={{ position:'fixed', bottom:'calc(86px + env(safe-area-inset-bottom))', left:12, right:12, maxWidth:520, margin:'0 auto', background:'linear-gradient(135deg, var(--bg-accent-wash), var(--bg-accent-wash-2))', border:'1px solid var(--border-purple)', borderRadius:'var(--radius-lg)', padding:'10px 12px', display:'flex', alignItems:'center', gap:8, zIndex:39, boxShadow:'var(--shadow-md)' }}>
          <span style={{ fontSize:13, color:'var(--text-primary)', fontWeight:700, flex:1 }}>Commute window live — 38+ online</span>
          <button onClick={requestPush} className="btn-primary press" style={{ padding:'8px 14px', fontSize:13 }}>Enable</button>
        </div>
      )}

      {view !== 'chat' && !showOnboarding && (
        <BottomNav active={navActive} onNavigate={handleBottomNav} unreadChats={friendDMs.filter(d=> !d.read && d.receiverId===user?.id).length} />
      )}
    </div>
  );
}

export default App;
