import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Radio } from 'lucide-react';
import { DiscoveryScreen } from './components/DiscoveryScreen';
import { ChatView } from './components/ChatView';
import type { MetroFriend } from './components/FriendsTab';
import { StationPicker } from './components/StationPicker';
import { LiveRoomHeader } from './components/LiveRoomHeader';
import { EngagementHub } from './components/engagement/EngagementHub';
import { ProfileEditor } from './components/personalization/ProfileEditor';
import { SavedCommutes } from './components/personalization/SavedCommutes';
import { BottomNav, type NavView } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { ConnectScreen } from './components/ConnectScreen';
import { ProfileDrawer } from './components/ProfileDrawer';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DiscoverAroundYou } from './components/DiscoverAroundYou';
import { ChatsScreen } from './components/ChatsScreen';
import { LiveTrackingScreen } from './components/LiveTrackingScreen';
import { ProfileStatsScreen } from './components/ProfileStatsScreen';
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

type View = 'home' | 'people' | 'discover' | 'chat' | 'chats' | 'connect' | 'profile' | 'profileStats' | 'liveTracking' | 'station' | 'train' | 'friends';

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
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
        fetch(`${API}/api/auth/restore/${parsed.id}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(d => initWithProfile(d.profile))
          .catch(() => { initWithProfile(parsed); });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        fetch(`${API}/api/auth/random-profile`).then(r => r.json()).then(data => initWithProfile(data.profile));
      }
    } else {
      fetch(`${API}/api/auth/random-profile`).then(r => r.json()).then(data => initWithProfile(data.profile));
    }

    s.on('room_updated', (roomData: ContextRoom) => {
      if (roomData.type === 'station') setStationRoom(roomData);
      else setTrainRoom(roomData);
      track('travelers_seen', undefined, { roomId: roomData.id, type: roomData.type, count: (roomData as any).userCount ?? (roomData as any).users?.length ?? 0 });
    });

    s.on('new_message', (msg) => {
      setStationRoom(prev => { if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] }; return prev; });
      setTrainRoom(prev => { if (prev && msg.roomId === prev.id) return { ...prev, messages: [...prev.messages, msg] }; return prev; });
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
      if (prev.some(x => x.id === dm.id)) return prev;
      return [...prev, dm];
    }));
    s.on('dm_history', ({ messages }: { friendId: string; messages: DirectMessage[] }) => {
      setFriendDMs(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = messages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newOnes].sort((a,b) => a.timestamp - b.timestamp);
      });
    });

    s.on('live_count_tick', (payload: { roomId: string; count: number; presence: any }) => {
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
    s.on('game_error', (p: { error: string }) => showToast(`⚠️ ${p.error}`));

    return () => { s.disconnect(); };
  }, []);

  // Fetch beachhead info
  useEffect(() => {
    fetch(`${API}/api/metro/beachhead`).then(r => r.json()).then(setBeachhead).catch(() => {});
  }, []);

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

  const activeRoom = view === 'chat' ? (chatTarget === 'station' ? stationRoom : trainRoom) : null;
  const friendIds = friends.map(f => f.friendId);
  const activePeopleRoom = trainRoom || stationRoom;
  const navActive: NavView = view === 'home' ? 'home' : view === 'people' || view === 'station' || view === 'train' || view === 'discover' || view === 'liveTracking' || view === 'connect' ? 'people' : view === 'chats' || view === 'chat' || view === 'friends' ? 'chats' : view === 'profile' || view === 'profileStats' ? 'profile' : 'home';

  const handleBottomNav = (v: NavView) => {
    if (v === 'home') setView('home');
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

  const handleHomeQuick = (action: 'chat'|'quiz'|'icebreaker'|'post') => {
    if (action==='chat') { setChatTarget(trainRoom ? 'train' : 'station'); setView('chat'); }
    else if (action==='quiz') {
      const room = trainRoom || stationRoom;
      if (room && socket && user) { socket.emit('create_game', { roomId: room.id, type:'trivia', user }); setView('people'); }
    }
    else if (action==='icebreaker') {
      const room = trainRoom || stationRoom;
      if (room && socket && user) { socket.emit('create_game', { roomId: room.id, type:'prompt', user }); setView('people'); }
    }
    else if (action==='post') { setView('people'); setTimeout(()=> setShowProfileEditor(true), 200); }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 12px 86px', minHeight:'100vh', background:'var(--bg-base)' }}>
      {showOnboarding && user && (
        <OnboardingScreen
          user={user}
          onComplete={(np)=>{ setUser(np); setShowOnboarding(false); localStorage.setItem('coride_onboarded','1'); showToast('Welcome aboard! 🎉'); }}
          onSkip={()=>{ setShowOnboarding(false); localStorage.setItem('coride_onboarded','1'); }}
        />
      )}
      {/* Home */}
      {view === 'home' && (
        <>
          <div style={{ height: 8 }} />
          <HomeScreen
            user={user}
            contextStationName={context?.stationName}
            contextLineName={context?.lineName}
            stationRoom={stationRoom}
            trainRoom={trainRoom}
            vibe={activePeopleRoom ? vibeMap[activePeopleRoom.id] : []}
            engagement={engagement}
            onViewAllPeople={()=> setView('people')}
            onQuickAction={handleHomeQuick}
            onJoinRoom={(roomId)=> {
              const room = stationRoom?.id===roomId ? stationRoom : trainRoom?.id===roomId ? trainRoom : null;
              if (room) { setChatTarget(room.type==='train'?'train':'station'); setView('chat'); }
            }}
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
            onOpenChat={() => openChat(activePeopleRoom.type==='train'?'train':'station')}
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
            <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', fontSize:11, color:'var(--text-muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}><Radio size={12} style={{ color: hasManualOverride?'var(--accent-emerald)':'var(--accent-blue)' }}/> {hasManualOverride?'Confirmed':'Auto'}: <strong style={{ color:'var(--text-primary)' }}>{context.stationName}</strong></span>
              <button onClick={()=> setShowStationPicker(true)} style={{ background:'none', border:'none', color:'var(--accent-violet)', fontSize:11, fontWeight:700 }}>Change</button>
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
      {view === 'liveTracking' && (
        <LiveTrackingScreen onBack={()=> setView('people')} />
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
            <div style={{ paddingBottom: 12 }}>
              <button onClick={()=> setSelectedFriend(null)} style={{ marginBottom:12, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', padding:'8px 12px', borderRadius:999, fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                ← Back to Chats
              </button>
              <div className="glass-panel" style={{ padding:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36,height:36, borderRadius:'50%', background: selectedFriend.friendProfile.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>{selectedFriend.friendProfile.pseudonym[0]}</div>
                  <div>
                    <div style={{ fontWeight:800, color:'white' }}>{selectedFriend.friendProfile.pseudonym}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Metro Friend • Real-time</div>
                  </div>
                </div>
                <div style={{ maxHeight: 320, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                  {friendDMs.filter(dm=> (dm.senderId===user.id && dm.receiverId===selectedFriend.friendId) || (dm.senderId===selectedFriend.friendId && dm.receiverId===user.id)).map(dm=>{
                    const isMe = dm.senderId===user.id;
                    return (
                      <div key={dm.id} style={{ alignSelf: isMe?'flex-end':'flex-start', maxWidth:'78%', padding:'10px 14px', borderRadius: isMe?'18px 18px 6px 18px':'18px 18px 18px 6px', background: isMe?'#7B5DFF':'var(--bg-surface)', border: isMe?'none':'1px solid var(--border-subtle)', color: isMe?'white':'var(--text-primary)', fontSize:13 }}>
                        {dm.content}
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={(e)=>{ e.preventDefault(); const inp=(e.target as any).elements.msg.value; if(!inp.trim())return; handleSendDM(selectedFriend.friendId, inp.trim()); (e.target as any).elements.msg.value=''; }} style={{ display:'flex', gap:8 }}>
                  <input name="msg" placeholder={`Message ${selectedFriend.friendProfile.pseudonym}...`} style={{ flex:1, padding:'10px 14px', borderRadius:999, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'white', fontSize:13 }} />
                  <button type="submit" style={{ width:36,height:36, borderRadius:'50%', background:'#7B5DFF', border:'none', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>➤</button>
                </form>
              </div>
            </div>
          ) : (
            <ChatsScreen
              user={user}
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
      {(view === 'friends') && user && (
        <ConnectScreen currentUser={user} socket={socket} />
      )}

      {/* Profile Stats — 10 + Detail */}
      {view === 'profile' && user && (
        <ProfileStatsScreen user={user} />
      )}
      {view === 'profileStats' && user && (
        <ProfileStatsScreen user={user} />
      )}

      {/* Fallback for legacy station/train views */}
      {(view === 'station' || view === 'train') && (()=>{ const r = view==='station'?stationRoom:trainRoom; return r && user ? (
        <>
          <DiscoveryScreen room={r} context={context} currentUser={user} friendIds={friendIds} ranked={rankedMap[r.id]} vibe={vibeMap[r.id]} onConnect={handleConnect} onBlock={handleBlock} onReport={handleReport} onOpenChat={()=> openChat(view)} onProfileOpen={handleProfileOpen} />
          <div style={{ marginTop:14 }}><EngagementHub room={r} snapshot={engagement[r.id]||null} currentUser={user} socket={socket} onReaction={(tid,emoji,ttype,rid)=> handleReaction(tid,emoji,ttype as any,rid)} /></div>
        </>
      ) : null; })()}

      {/* Profile editor overlay */}
      {showProfileEditor && user && (
        <ProfileEditor user={user} onClose={()=> setShowProfileEditor(false)} onSaved={(np)=>{ setUser(np); showToast('Profile enhanced ✓'); track('profile_enhanced', np.id, { tags: np.interestTags.length }); }} />
      )}

      {/* Selected user profile */}
      {selectedUser && view!=='profile' && view!=='home' && (
        <ProfileDrawer
          user={selectedUser}
          isMe={selectedUser.id===user?.id}
          isFriend={friendIds.includes(selectedUser.id)}
          onClose={()=> setSelectedUser(null)}
          onConnect={()=> { if(selectedUser) handleConnect(selectedUser.id); setSelectedUser(null); }}
          onBlock={()=> { if(selectedUser) handleBlock(selectedUser.id); setSelectedUser(null); }}
          onReport={(reason)=> { if(selectedUser) handleReport(selectedUser.id, reason); setSelectedUser(null); }}
          onMessage={()=> setSelectedUser(null)}
        />
      )}

      {/* Station picker */}
      {showStationPicker && view==='home' && (
        <StationPicker onConfirm={(st,_line)=> handleStationPicked(st)} onDismiss={()=> setShowStationPicker(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:86, left:'50%', transform:'translateX(-50%)', padding:'10px 18px', borderRadius:999, background:'var(--bg-elevated)', border:'1px solid var(--border-card)', color:'white', fontSize:12, fontWeight:700, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', zIndex:100 }}>
          {toast}
        </div>
      )}

      {/* Commute window push banner (subtle) */}
      {commuteLive && pushPermission!=='granted' && pushPermission!=='denied' && view==='home' && (
        <div style={{ position:'fixed', bottom:86, left:12, right:12, maxWidth:520, margin:'0 auto', background:'linear-gradient(135deg, #1A1033, #1E1A3A)', border:'1px solid rgba(123,93,255,0.28)', borderRadius:'var(--radius-lg)', padding:'10px 12px', display:'flex', alignItems:'center', gap:8, zIndex:39 }}>
          <span style={{ fontSize:12, color:'white', fontWeight:700, flex:1 }}>Commute window live — 38+ online</span>
          <button onClick={requestPush} style={{ padding:'6px 12px', borderRadius:999, background:'#7B5DFF', color:'white', border:'none', fontWeight:800, fontSize:11 }}>Enable</button>
        </div>
      )}

      {view !== 'chat' && !showOnboarding && (
        <BottomNav active={navActive} onNavigate={handleBottomNav} unreadChats={friendDMs.filter(d=> !d.read && d.receiverId===user?.id).length} />
      )}
    </div>
  );
}

export default App;
