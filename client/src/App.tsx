import { useState, useEffect, useCallback, useRef } from 'react';
import { BroadcastIcon as Radio, XIcon as X, BellIcon as Bell, MapPinIcon as MapPin } from '@phosphor-icons/react';
import type { Socket } from 'socket.io-client';
import { useSocket } from './hooks/useSocket';
import { setToken, getToken, authHeaders } from './utils/auth';
import { DiscoveryScreen } from './components/DiscoveryScreen';
import { ChatView } from './components/ChatView';
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
import { OnboardingScreen, type OnboardingStep, type LocationChoice } from './components/OnboardingScreen';
import { ONBOARDING_KEYS } from './components/onboarding/keys';
import { ChatsScreen, type ChatPeer } from './components/ChatsScreen';
import { DirectChatScreen } from './components/DirectChatScreen';
import { LiveTrackingScreen } from './components/LiveTrackingScreen';
import { ProfileStatsScreen } from './components/ProfileStatsScreen';
import { RoomScreen } from './components/RoomScreen';
import { useCommuteNotifications } from './hooks/useCommuteNotifications';
import { track } from './utils/analytics';
import { SafetyCenterScreen } from './components/safety/SafetyCenterScreen';
import { BlockedUsersScreen } from './components/safety/BlockedUsersScreen';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { Toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { IconButton } from './components/ui/IconButton';
import { Skeleton } from './components/ui/Skeleton';
import { ScreenHeader } from './components/ui/ScreenHeader';
import { EmptyState } from './components/ui/EmptyState';
import { BrandMark } from './components/ui/BrandMark';
import { flushOfflineQueue } from './utils/offlineQueue';
import { CheckInScreen } from './components/transit/CheckInScreen';
import { DELHI_METRO_LINES } from './data/metroData';
import { isNative, setRootBackHandler, dispatchBack } from './utils/nativeBridge';
import type { EngagementSnapshot } from './types/engagement';
import type {
  UserProfile,
  ContextRoom,
  ContextResult,
  FriendEntry,
  RankedTraveler
} from './types';
import { API } from './config';

/**
 * App shell + navigation.
 *
 * Tabs (BottomNav): home · people · liveTracking (Journey) · chats · profile.
 * Sub-screens are pushed on top of the current tab and popped by the on-screen
 * back arrow, the Android back button, or the browser back button:
 *   room · chat (station/train room chat) · dm (1:1 thread) · connect ·
 *   safetyCenter · blockedUsers · savedCommutes
 * Switching tabs resets that stack. Back at a tab root goes to Home; back on
 * Home minimises the app (native) — see utils/nativeBridge.ts.
 */
type Tab = 'home' | 'people' | 'liveTracking' | 'chats' | 'profile';
type SubView = 'room' | 'chat' | 'dm' | 'connect' | 'safetyCenter' | 'blockedUsers' | 'savedCommutes';
type View = Tab | SubView;

/** Screens that bring their own composer / full-height layout. */
const NO_NAV: View[] = ['chat', 'dm'];

const PROFILE_KEY = 'coride_profile';

const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [bootError, setBootError] = useState(false);
  const { socket, connected: socketConnected, status: socketStatus, attemptReconnect } = useSocket(user ? getToken() : null);
  const [context, setContext] = useState<ContextResult | null>(null);
  const [stationRoom, setStationRoom] = useState<ContextRoom | null>(null);
  const [trainRoom, setTrainRoom] = useState<ContextRoom | null>(null);

  // Navigation: a stack whose first entry is always a tab.
  const [stack, setStack] = useState<View[]>(['home']);
  const view = stack[stack.length - 1];
  const tab = stack[0] as Tab;

  const [chatTarget, setChatTarget] = useState<'station' | 'train'>('train');
  const [friends, setFriends] = useState<MetroFriend[]>([]);
  const [chatPeer, setChatPeer] = useState<ChatPeer | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [showCheckInScreen, setShowCheckInScreen] = useState(false);
  const [hasManualOverride, setHasManualOverride] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; pseudonym: string }[]>>({});
  const [engagement, setEngagement] = useState<Record<string, EngagementSnapshot>>({});
  const [rankedMap, setRankedMap] = useState<Record<string, RankedTraveler[]>>({});
  const [vibeMap, setVibeMap] = useState<Record<string, RankedTraveler[]>>({});
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[] | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(() => lsGet(ONBOARDING_KEYS.locationChoice) === 'granted');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedPresenceRoomId, setSelectedPresenceRoomId] = useState<string>('rajiv_chowk:blue:towards_noida');
  const [showOffline, setShowOffline] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => lsGet('coride_push_banner_dismissed') === new Date().toISOString().slice(0, 10));

  const routeHistoryRef = useRef<{ lat: number; lng: number; t: number }[]>([]);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const speedRef = useRef<number | undefined>(undefined);
  const firstFixRef = useRef(false);
  const nudgedRef = useRef(false);
  const scrollMemo = useRef<Record<string, number>>({});
  const userRef = useRef<UserProfile | null>(null);
  const roomsRef = useRef<{ station: ContextRoom | null; train: ContextRoom | null }>({ station: null, train: null });
  const manualRef = useRef(false);
  const pendingRequestRef = useRef(0);
  useEffect(() => {
    userRef.current = user;
    roomsRef.current = { station: stationRoom, train: trainRoom };
    manualRef.current = hasManualOverride;
  });

  const { permission: pushPermission, isLive: commuteLive, requestPermission: requestPush } = useCommuteNotifications(!!user);

  const showToast = useCallback((msg: string) => setToast(msg), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // ─── Navigation ───────────────────────────────────────────────────────────
  const rememberScroll = useCallback(() => {
    scrollMemo.current[stack.join('/')] = window.scrollY;
  }, [stack]);

  const push = useCallback((v: SubView) => {
    rememberScroll();
    setStack(s => (s[s.length - 1] === v ? s : [...s, v]));
    window.scrollTo(0, 0);
  }, [rememberScroll]);

  const goTab = useCallback((t: Tab) => {
    rememberScroll();
    setStack(s => {
      if (s.length === 1 && s[0] === t) {
        // Re-selecting the current tab scrolls it to the top.
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return s;
      }
      return [t];
    });
  }, [rememberScroll]);

  const pop = useCallback(() => {
    setStack(s => {
      const next = s.length > 1 ? s.slice(0, -1) : s[0] !== 'home' ? ['home' as View] : s;
      const y = scrollMemo.current[next.join('/')] ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
      return next;
    });
  }, []);

  const openDirectChat = useCallback((peer: ChatPeer) => {
    setChatPeer(peer);
    push('dm');
  }, [push]);

  // Root back handler — runs after any sheet/overlay registered via pushBackHandler.
  const backRef = useRef<() => boolean>(() => false);
  const rootBack = () => {
    if (onboardingSteps) return false;
    if (selectedUser) { setSelectedUser(null); return true; }
    if (showProfileEditor) { setShowProfileEditor(false); return true; }
    if (showCheckInScreen) { setShowCheckInScreen(false); return true; }
    if (showStationPicker) { setShowStationPicker(false); return true; }
    if (stack.length > 1 || stack[0] !== 'home') { pop(); return true; }
    return false;
  };
  useEffect(() => { backRef.current = rootBack; });
  useEffect(() => {
    setRootBackHandler(() => backRef.current());
    return () => setRootBackHandler(null);
  }, []);

  // Browser back button (web / PWA): keep one guard history entry while there
  // is somewhere to go back to, and route popstate through the same chain.
  const canGoBack = !onboardingSteps && (stack.length > 1 || stack[0] !== 'home' || !!selectedUser || showProfileEditor || showCheckInScreen || showStationPicker);
  const guardRef = useRef(false);
  useEffect(() => {
    if (isNative) return;
    const onPop = () => {
      guardRef.current = false;
      dispatchBack();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navKey = `${stack.join('/')}|${!!selectedUser}|${showProfileEditor}|${showCheckInScreen}|${showStationPicker}`;
  useEffect(() => {
    if (isNative || !canGoBack || guardRef.current) return;
    try { window.history.pushState({ corideGuard: true }, ''); guardRef.current = true; } catch { /* sandboxed iframe */ }
  }, [canGoBack, navKey]);

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  /** Resolves true when both rooms were detected and joined. */
  const detect = useCallback(async (activeSocket: Socket, profile: UserProfile, opts?: { userConfirmed?: boolean; userConfirmedDirection?: string; overrideCellTowerId?: string; overrideLat?: number; overrideLng?: number }): Promise<boolean> => {
    try {
      const lastPos = lastPosRef.current;
      const routeHistory = routeHistoryRef.current.length >= 2 ? routeHistoryRef.current : undefined;
      const geoSpeed = speedRef.current;
      const hasCellTower = !lastPos && !opts?.overrideCellTowerId;
      const cellTower = opts?.overrideCellTowerId ? opts.overrideCellTowerId : hasCellTower ? 'TOWER_DMRC_RC_CP' : undefined;
      const lat = opts?.overrideLat ?? lastPos?.lat;
      const lng = opts?.overrideLng ?? lastPos?.lng;
      const basePayload: Record<string, unknown> = {
        userId: profile.id,
        cellTowerId: cellTower,
        routeHistory,
        userConfirmed: !!opts?.userConfirmed
      };
      if (lat !== undefined) basePayload.lat = lat;
      if (lng !== undefined) basePayload.lng = lng;
      if (opts?.userConfirmedDirection) basePayload.userConfirmedDirection = opts.userConfirmedDirection;
      const stationRes = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...basePayload, movementState: 'WALKING', speedKmh: geoSpeed && geoSpeed < 8 ? geoSpeed : 3 })
      });
      if (!stationRes.ok) throw new Error(`detect ${stationRes.status}`);
      const stationData = await stationRes.json();
      setStationRoom(stationData.room);
      activeSocket.emit('join_room', { roomId: stationData.room.id, user: profile });
      const trainRes = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...basePayload, movementState: 'IN_VEHICLE', speedKmh: geoSpeed && geoSpeed >= 8 ? geoSpeed : 42 })
      });
      if (!trainRes.ok) throw new Error(`detect ${trainRes.status}`);
      const trainData = await trainRes.json();
      setContext(trainData.context);
      setTrainRoom(trainData.room);
      activeSocket.emit('join_room', { roomId: trainData.room.id, user: profile });
      track('context_detected', profile.id, { context: trainData.context, confidence: trainData.context.confidence, station: trainData.context.stationName, routeHistoryLen: routeHistory?.length || 0 });
      track('travelers_seen', profile.id, { station: trainData.context.stationName, stationCount: stationData.room.userCount, trainCount: trainData.room.userCount });
      return true;
    } catch (err) {
      console.error('Detection error:', err);
      return false;
    }
  }, []);

  const leaveCurrentRooms = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    const { station, train } = roomsRef.current;
    if (station) socket.emit('leave_room', { roomId: station.id, userId: u.id });
    if (train) socket.emit('leave_room', { roomId: train.id, userId: u.id });
  }, [socket]);

  // Sign in: restore the stored identity, or mint a new anonymous one. Re-runs
  // when the user taps "Try again" (bootAttempt). Ignores results from a
  // superseded run (StrictMode double-mount, rapid retries).
  const [bootAttempt, setBootAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const initWithProfile = (profile: UserProfile, token?: string) => {
      if (cancelled) return;
      if (token) setToken(token); // signed device token → authenticates every request
      setUser(profile);
      lsSet(PROFILE_KEY, JSON.stringify(profile));
      void detect(socket, profile);
      track('session_start', profile.id, { stationHint: 'auto' });
      track('activated_user', profile.id, {});
    };
    const fresh = async () => {
      const r = await fetch(`${API}/api/auth/random-profile`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      initWithProfile(data.profile, data.token);
    };
    const run = async () => {
      const stored = lsGet(PROFILE_KEY);
      try {
        if (stored) {
          let parsed: UserProfile | null = null;
          try { parsed = JSON.parse(stored); } catch { /* corrupt */ }
          if (!parsed?.id) {
            try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
            await fresh();
            return;
          }
          try {
            const r = await fetch(`${API}/api/auth/restore/${parsed.id}`, { headers: authHeaders() });
            if (!r.ok) throw new Error(String(r.status));
            const d = await r.json();
            initWithProfile(d.profile, d.token);
          } catch {
            // Offline or server restarting — keep the local identity so the app still opens.
            initWithProfile(parsed);
          }
        } else {
          await fresh();
        }
      } catch {
        if (!cancelled) setBootError(true);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [bootAttempt, detect, socket]);

  // ─── Socket listeners ─────────────────────────────────────────────────────
  const refreshUnread = useCallback(() => {
    if (!userRef.current || !getToken()) return;
    fetch(`${API}/api/chats`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { chats?: { unread?: number }[] }) => setUnreadChats((d.chats || []).reduce((n, c) => n + (c.unread || 0), 0)))
      .catch(() => {});
  }, []);

  const refreshFriends = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    fetch(`${API}/api/friends/${u.id}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setFriends((d.friends || []).map((f: FriendEntry) => ({ id: f.id, friendId: f.id, friendProfile: f.profile, connectedAtLine: '', connectedAtStation: '', createdAt: Date.now(), unreadCount: 0 }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onRoomUpdated = (roomData: ContextRoom) => {
      if (roomData.type === 'station') setStationRoom(roomData);
      else setTrainRoom(roomData);
      track('travelers_seen', undefined, { roomId: roomData.id, type: roomData.type, count: roomData.userCount ?? roomData.users?.length ?? 0 });
    };
    const onNewMessage = (msg: ContextRoom['messages'][number] & { roomId: string }) => {
      setStationRoom(prev => (prev && msg.roomId === prev.id ? { ...prev, messages: [...prev.messages, msg] } : prev));
      setTrainRoom(prev => (prev && msg.roomId === prev.id ? { ...prev, messages: [...prev.messages, msg] } : prev));
    };
    const onConnectionResult = (result: { success: boolean; message: string }) => {
      // A request from the profile sheet shows its own result inline.
      if (pendingRequestRef.current === 0) showToast(result.message);
      if (result.success) track('connection_request_sent', undefined, { message: result.message });
    };
    const onConnectionAccepted = ({ message, userA, userB }: { userA: string; userB: string; message: string }) => {
      showToast(message);
      refreshFriends();
      track('connection_accepted', undefined, { userA, userB });
      track('mutual_acceptance', undefined, { userA, userB });
    };
    const onMessageToast = (result: { message: string }) => showToast(result.message);
    const onNewDm = () => refreshUnread();
    const onLiveTick = (payload: { roomId: string; count: number; presence: unknown }) => {
      setStationRoom(prev => (prev && payload.roomId === prev.id ? ({ ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom) : prev));
      setTrainRoom(prev => (prev && payload.roomId === prev.id ? ({ ...prev, userCount: payload.count, presence: payload.presence } as ContextRoom) : prev));
    };
    const onCommuteLive = (payload: { title: string; body: string }) => {
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try { new Notification(payload.title, { body: payload.body, icon: '/favicon.svg' }); } catch { /* not allowed in this context */ }
      }
      track('commute_window_push_received', undefined, payload as unknown as Record<string, unknown>);
    };
    const onCommuteRoomLive = (p: { roomId: string; count: number }) => track('commute_window_room_live', undefined, p as unknown as Record<string, unknown>);
    const typingTimers = new Set<ReturnType<typeof setTimeout>>();
    const onTyping = (p: { roomId: string; userId: string; pseudonym: string }) => {
      setTypingUsers(prev => {
        const cur = prev[p.roomId] || [];
        if (cur.some(u => u.userId === p.userId)) return prev;
        return { ...prev, [p.roomId]: [...cur, { userId: p.userId, pseudonym: p.pseudonym }] };
      });
      const t = setTimeout(() => {
        typingTimers.delete(t);
        setTypingUsers(prev => ({ ...prev, [p.roomId]: (prev[p.roomId] || []).filter(u => u.userId !== p.userId) }));
      }, 4000);
      typingTimers.add(t);
    };
    const onStopTyping = (p: { roomId: string; userId: string }) => {
      setTypingUsers(prev => ({ ...prev, [p.roomId]: (prev[p.roomId] || []).filter(u => u.userId !== p.userId) }));
    };
    const onEngagement = (snap: EngagementSnapshot) => setEngagement(prev => ({ ...prev, [snap.roomId]: snap }));
    const onReaction = (p: { targetId: string; state: unknown; roomId?: string }) => {
      setEngagement(prev => {
        const next = { ...prev };
        const apply = (rid: string) => {
          next[rid] = { ...next[rid], reactions: { ...next[rid].reactions, [p.targetId]: p.state } } as EngagementSnapshot;
        };
        if (p.roomId && next[p.roomId]) { apply(p.roomId); return next; }
        for (const rid of Object.keys(next)) {
          if ((next[rid].reactions as Record<string, unknown>)[p.targetId] !== undefined || p.targetId === rid) { apply(rid); return next; }
        }
        const first = Object.keys(next)[0];
        if (first) apply(first);
        return next;
      });
    };
    const onGameError = (p: { error: string }) => showToast(p.error);

    socket.on('room_updated', onRoomUpdated);
    socket.on('new_message', onNewMessage);
    socket.on('connection_result', onConnectionResult);
    socket.on('connection_accepted', onConnectionAccepted);
    socket.on('block_result', onMessageToast);
    socket.on('report_result', onMessageToast);
    socket.on('moderation_action', onMessageToast);
    socket.on('new_dm', onNewDm);
    socket.on('live_count_tick', onLiveTick);
    socket.on('commute_window_live', onCommuteLive);
    socket.on('commute_window_room_live', onCommuteRoomLive);
    socket.on('user_typing', onTyping);
    socket.on('user_stop_typing', onStopTyping);
    socket.on('engagement_updated', onEngagement);
    socket.on('reaction_updated', onReaction);
    socket.on('game_error', onGameError);
    return () => {
      socket.off('room_updated', onRoomUpdated);
      socket.off('new_message', onNewMessage);
      socket.off('connection_result', onConnectionResult);
      socket.off('connection_accepted', onConnectionAccepted);
      socket.off('block_result', onMessageToast);
      socket.off('report_result', onMessageToast);
      socket.off('moderation_action', onMessageToast);
      socket.off('new_dm', onNewDm);
      socket.off('live_count_tick', onLiveTick);
      socket.off('commute_window_live', onCommuteLive);
      socket.off('commute_window_room_live', onCommuteRoomLive);
      socket.off('user_typing', onTyping);
      socket.off('user_stop_typing', onStopTyping);
      socket.off('engagement_updated', onEngagement);
      socket.off('reaction_updated', onReaction);
      socket.off('game_error', onGameError);
      typingTimers.forEach(clearTimeout);
    };
  }, [socket, showToast, refreshFriends, refreshUnread]);

  // Friends + unread badge: on sign-in, on resume, and every minute while visible.
  useEffect(() => {
    if (!user) return;
    refreshFriends();
    refreshUnread();
    const onVisible = () => { if (document.visibilityState === 'visible') { refreshUnread(); refreshFriends(); } };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => { if (document.visibilityState === 'visible') refreshUnread(); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(id); };
  }, [user?.id, refreshFriends, refreshUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving a thread or the chat list may have marked messages read.
  useEffect(() => { if (tab === 'chats') refreshUnread(); }, [stack.length, tab, refreshUnread]);

  // Offline queue auto-flush on reconnect
  useEffect(() => {
    if (!socketConnected || !user) return;
    flushOfflineQueue(
      (roomId, content) => { socket.emit('send_message', { roomId, user, content }); },
      (receiverId, content) => { socket.emit('send_dm', { senderId: user.id, receiverId, content }); }
    ).then(count => {
      if (count > 0) showToast(count === 1 ? 'Sent 1 queued message' : `Sent ${count} queued messages`);
    });
  }, [socketConnected, socket, user, showToast]);

  // Offline banner — only after the connection has been down for a moment, so
  // a normal app start (socket still "connecting") never flashes it.
  useEffect(() => {
    const down = !!user && (socketStatus === 'reconnecting' || socketStatus === 'offline');
    if (!down) return;
    const t = setTimeout(() => setShowOffline(true), 2500);
    return () => { clearTimeout(t); setShowOffline(false); };
  }, [socketStatus, user]);

  // ─── Onboarding / consent ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || onboardingSteps) return;
    let cancelled = false;
    (async () => {
      const steps: OnboardingStep[] = [];
      if (!lsGet(ONBOARDING_KEYS.termsAcceptedAt) || !lsGet(ONBOARDING_KEYS.ageConfirmed)) steps.push('welcome');
      const hasTags = (user.interestTags?.length || 0) >= 2;
      if (!hasTags && !lsGet(ONBOARDING_KEYS.onboarded)) steps.push('profile');
      if (!lsGet(ONBOARDING_KEYS.locationChoice) && 'geolocation' in navigator) {
        let state: PermissionState | 'unknown' = 'unknown';
        try { state = (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? 'unknown'; } catch { /* unsupported */ }
        if (state === 'granted') { lsSet(ONBOARDING_KEYS.locationChoice, 'granted'); setLocationEnabled(true); }
        else if (state === 'denied') lsSet(ONBOARDING_KEYS.locationChoice, 'denied');
        else steps.push('location');
      }
      if (!cancelled && steps.length) setOnboardingSteps(steps);
    })();
    return () => { cancelled = true; };
    // Only evaluated once per signed-in identity.
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingFinish = ({ profile, location }: { profile: UserProfile; location: LocationChoice }) => {
    setOnboardingSteps(null);
    setUser(profile);
    if (location === 'granted') {
      setLocationEnabled(true);
      showToast("You're all set");
    } else if (location === 'manual' || location === 'denied') {
      setShowCheckInScreen(true);
    } else {
      showToast("You're all set");
    }
    track('onboarding_complete', profile.id, { location });
  };

  // ─── Location (only after the user agreed in the disclosure) ──────────────
  useEffect(() => {
    if (!locationEnabled || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, speed } = pos.coords;
        lastPosRef.current = { lat: latitude, lng: longitude };
        routeHistoryRef.current.push({ lat: latitude, lng: longitude, t: Date.now() });
        if (routeHistoryRef.current.length > 8) routeHistoryRef.current.shift();
        if (speed !== null && speed !== undefined) speedRef.current = speed * 3.6;
        // First real fix: re-detect so the user lands in the right room
        // instead of the no-location default.
        if (!firstFixRef.current) {
          firstFixRef.current = true;
          const u = userRef.current;
          if (u && !manualRef.current) {
            leaveCurrentRooms();
            void detect(socket, u);
          }
        }
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          lsSet(ONBOARDING_KEYS.locationChoice, 'denied');
          setLocationEnabled(false);
        }
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationEnabled, detect, leaveCurrentRooms, socket]);

  // Low-confidence detection → suggest picking the station, once per session.
  useEffect(() => {
    if (!context || hasManualOverride || nudgedRef.current || onboardingSteps || showCheckInScreen) return;
    if (context.confidence < 0.6 && (view === 'home' || view === 'people')) {
      const t = setTimeout(() => { nudgedRef.current = true; setShowStationPicker(true); }, 1200);
      return () => clearTimeout(t);
    }
  }, [context, hasManualOverride, onboardingSteps, showCheckInScreen, view]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleStationPicked = (station: { id: string; name: string; lat: number; lng: number; cellTowerId?: string }) => {
    if (!user) return;
    leaveCurrentRooms();
    setHasManualOverride(true);
    setShowStationPicker(false);
    showToast(`Station set to ${station.name}`);
    void detect(socket, user, {
      userConfirmed: true,
      overrideCellTowerId: station.cellTowerId,
      overrideLat: station.lat,
      overrideLng: station.lng
    });
    track('manual_context_confirm', user.id, { stationId: station.id, stationName: station.name });
  };

  const handleHeroCheckIn = async (lineId: string, stationId: string, direction: string) => {
    if (!user) throw new Error('Still signing you in — try again in a moment.');
    leaveCurrentRooms();
    let stationLat = 28.6328;
    let stationLng = 77.2197;
    let stationName = stationId;
    const stObj = DELHI_METRO_LINES.find(l => l.id === lineId)?.stations.find(s => s.id === stationId);
    if (stObj) {
      stationLat = stObj.lat;
      stationLng = stObj.lng;
      stationName = stObj.name;
    }
    const ok = await detect(socket, user, {
      userConfirmed: true,
      userConfirmedDirection: direction || undefined,
      overrideLat: stationLat,
      overrideLng: stationLng,
      overrideCellTowerId: `TOWER_DMRC_${stationId.toUpperCase()}`
    });
    // CheckInScreen shows this error instead of a false "Checked in".
    if (!ok) throw new Error("Couldn't check you in. Check your connection and try again.");
    setHasManualOverride(true);
    showToast(`Checked in at ${stationName}${direction ? ` · ${direction}` : ''}`);
    setTimeout(() => {
      setShowCheckInScreen(false);
      goTab('people');
    }, 500);
  };

  const handleUseCommute = async (pattern: { id: string; stationId: string; stationName: string; lineId?: string; lineName?: string; lineColor?: string; direction?: string }, roomFromServer?: ContextRoom) => {
    if (!user) return;
    leaveCurrentRooms();
    showToast(`Joining ${pattern.stationName}`);
    track('commute_pattern_used', user.id, { patternId: pattern.id, station: pattern.stationName });
    setHasManualOverride(true);
    if (roomFromServer) {
      if (roomFromServer.type === 'station') {
        setStationRoom(roomFromServer);
        setContext({ stationName: pattern.stationName, lineName: pattern.lineName, lineColor: pattern.lineColor, direction: pattern.direction, confidence: 0.95, breakdown: { stationMatch: 30, routeMatch: 25, movementMatch: 10, scheduleMatch: 20, userConfirm: 50 }, rawScore: 135, station: pattern.stationId, line: pattern.lineId, id: '', reason: 'Saved commute' } as unknown as ContextResult);
      } else {
        setTrainRoom(roomFromServer);
      }
      socket.emit('join_room', { roomId: roomFromServer.id, user });
      goTab('people');
      return;
    }
    const station = { lat: 28.6328, lng: 77.2197, cellTowerId: `TOWER_DMRC_${pattern.stationId.toUpperCase()}` };
    const found = DELHI_METRO_LINES.flatMap(l => l.stations).find(s => s.id === pattern.stationId) as { lat: number; lng: number; cellTowerId?: string } | undefined;
    if (found) { station.lat = found.lat; station.lng = found.lng; if (found.cellTowerId) station.cellTowerId = found.cellTowerId; }
    void detect(socket, user, { userConfirmed: true, overrideCellTowerId: station.cellTowerId, overrideLat: station.lat, overrideLng: station.lng });
    goTab('people');
  };

  const handleConnect = (targetUserId: string) => {
    if (!user) return;
    socket.emit('connect_request', { fromUser: user, toUserId: targetUserId, contextLine: context?.lineName || '', contextStation: context?.stationName || '' });
    track('connection_request_sent', user.id, { toUserId: targetUserId, station: context?.stationName, line: context?.lineName });
    track('profile_open_to_connect', user.id, {});
  };
  /**
   * Connection request that resolves/rejects on the server's answer, so the
   * profile sheet can show "sent" or a real error (not an optimistic lie).
   */
  const sendConnectRequest = (targetUserId: string): Promise<void> => new Promise((resolve, reject) => {
    if (!user) { reject(new Error('Still signing you in — try again in a moment.')); return; }
    if (!socket.connected) { reject(new Error("You're offline. Try again when you're connected.")); return; }
    pendingRequestRef.current += 1;
    const done = () => { pendingRequestRef.current -= 1; clearTimeout(timer); socket.off('connection_result', onResult); };
    const onResult = (r: { success: boolean; message: string }) => {
      done();
      if (r.success) resolve(); else reject(new Error(r.message || "Couldn't send the request."));
    };
    const timer = setTimeout(() => { done(); reject(new Error('No response from the server. Try again.')); }, 8000);
    socket.on('connection_result', onResult);
    handleConnect(targetUserId);
  });
  const handleProfileOpen = (targetUserId: string) => {
    if (!user) return;
    track('profile_open', user.id, { targetUserId });
    track('profile_open_rate', user.id, {});
  };
  const handleBlock = (targetUserId: string) => {
    if (!user) return;
    socket.emit('block_user', { userId: user.id, blockedUserId: targetUserId });
    track('user_blocked', user.id, { targetUserId });
  };
  const activeRoom = view === 'chat' ? (chatTarget === 'station' ? stationRoom : trainRoom) : null;
  const handleReport = (targetUserId: string, reason: string) => {
    if (!user) return;
    const reportRoom = activeRoom || trainRoom || stationRoom;
    socket.emit('report_user', { reporterId: user.id, reportedUserId: targetUserId, reason, roomId: reportRoom?.id });
    track('user_reported', user.id, { targetUserId, reason });
  };
  const handleSendMessage = (content: string) => {
    if (!user || !activeRoom) return;
    socket.emit('send_message', { roomId: activeRoom.id, user, content });
    track('ephemeral_message_sent', user.id, { roomId: activeRoom.id, type: activeRoom.type });
  };
  const handleReaction = (targetId: string, emoji: string, targetType: 'message' | 'profile' | 'submission' = 'message', roomId?: string) => {
    if (!user) return;
    const rid = roomId || activeRoom?.id || trainRoom?.id || stationRoom?.id || '';
    socket.emit('reaction_toggle', { targetId, targetType, userId: user.id, emoji, roomId: rid });
    track('reaction_toggle', user.id, { targetId, emoji, targetType });
  };

  // ─── Room upkeep: heartbeat, engagement, ranking ──────────────────────────
  useEffect(() => {
    if (!user) return;
    let meaningfulSent = false;
    const id = setInterval(() => {
      if (stationRoom) socket.emit('heartbeat', { userId: user.id, roomId: stationRoom.id });
      if (trainRoom) socket.emit('heartbeat', { userId: user.id, roomId: trainRoom.id });
      if (!meaningfulSent) {
        const room = trainRoom || stationRoom;
        const cnt = room?.userCount || room?.users.length || 0;
        if (cnt >= 5) {
          meaningfulSent = true;
          track('meaningful_live_session', user.id, { roomId: room?.id, count: cnt, type: room?.type, durationSec: 60 });
        }
      }
    }, 25 * 1000);
    const t2 = setTimeout(() => {
      if (meaningfulSent) return;
      const room = trainRoom || stationRoom;
      const cnt = room?.userCount || 0;
      if (room && cnt >= 3) {
        track('meaningful_live_session', user.id, { roomId: room.id, count: cnt, type: room.type, durationSec: 90, fallback: true });
      }
    }, 90 * 1000);
    return () => { clearInterval(id); clearTimeout(t2); };
  }, [socket, user, stationRoom?.id, trainRoom?.id, stationRoom?.userCount, trainRoom?.userCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = [stationRoom?.id, trainRoom?.id].filter(Boolean) as string[];
    for (const id of ids) {
      socket.emit('fetch_engagement', { roomId: id });
      fetch(`${API}/api/engagement/${id}`).then(r => r.json()).then((snap: EngagementSnapshot) => {
        setEngagement(prev => ({ ...prev, [id]: snap }));
      }).catch(() => {});
    }
  }, [socket, stationRoom?.id, trainRoom?.id]);

  const fetchRanking = useCallback((room: ContextRoom, withVibe: boolean) => {
    const u = userRef.current;
    if (!u) return;
    fetch(`${API}/api/rank/${encodeURIComponent(room.id)}?viewerId=${u.id}`, { headers: authHeaders() })
      .then(r => r.json()).then(j => setRankedMap(prev => ({ ...prev, [room.id]: j.ranked || [] }))).catch(() => {});
    if (withVibe) {
      fetch(`${API}/api/vibe/${encodeURIComponent(room.id)}/${u.id}`, { headers: authHeaders() })
        .then(r => r.json()).then(j => setVibeMap(prev => ({ ...prev, [room.id]: j.vibe || [] }))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    for (const room of [stationRoom, trainRoom]) if (room) fetchRanking(room, true);
  }, [user?.id, stationRoom?.id, trainRoom?.id, stationRoom?.userCount, trainRoom?.userCount, fetchRanking]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || (!stationRoom && !trainRoom)) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      for (const room of [roomsRef.current.station, roomsRef.current.train]) if (room) fetchRanking(room, false);
    }, 20 * 1000);
    return () => clearInterval(id);
  }, [user?.id, stationRoom?.id, trainRoom?.id, fetchRanking]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ──────────────────────────────────────────────────────────────
  const friendIds = friends.map(f => f.friendId);
  const activePeopleRoom = trainRoom || stationRoom;
  const navHidden = NO_NAV.includes(view) || !!onboardingSteps || !user;
  const navActive: NavView = tab;
  const selectedRanked = selectedUser ? Object.values(rankedMap).flat().find(r => r.profile?.id === selectedUser.id) : undefined;
  const showPushBanner = commuteLive && !pushBannerDismissed && pushPermission === 'default' && view === 'home' && !onboardingSteps;

  const dismissPushBanner = () => {
    setPushBannerDismissed(true);
    lsSet('coride_push_banner_dismissed', new Date().toISOString().slice(0, 10));
  };

  // Chat thread without a room (e.g. room expired) → back to People.
  useEffect(() => {
    if (view === 'chat' && user && !activeRoom) pop();
    if (view === 'dm' && !chatPeer) pop();
  }, [view, user, activeRoom, chatPeer, pop]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="app-shell no-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {bootError ? (
          <EmptyState
            icon={<Radio size={24} />}
            title="Can't reach CoRide"
            description="Check your internet connection. If you're underground, try again at the next station."
            action={{ label: 'Try again', onClick: () => { setBootError(false); setBootAttempt(n => n + 1); } }}
          />
        ) : (
          <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <BrandMark size={64} />
            <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Connecting</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-shell ${navHidden ? 'no-nav' : ''}`.trim()}>
      {showOffline && (
        <div style={{ marginBottom: 12 }}>
          <OfflineBanner onRetry={attemptReconnect} isReconnecting={socketStatus === 'connecting'} />
        </div>
      )}

      <main id="main">
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
              onViewAllPeople={() => goTab('people')}
              onOpenRoom={roomId => {
                if (roomId) setSelectedPresenceRoomId(roomId);
                push('room');
              }}
              onOpenProfile={u => { setSelectedUser(u); handleProfileOpen(u.id); }}
              onJoinRoom={roomId => {
                const room = stationRoom?.id === roomId ? stationRoom : trainRoom?.id === roomId ? trainRoom : null;
                if (room) { setChatTarget(room.type === 'train' ? 'train' : 'station'); push('chat'); }
              }}
              onOpenLiveTracking={() => goTab('liveTracking')}
              onOpenCheckIn={() => setShowCheckInScreen(true)}
            />
            <div style={{ marginTop: 16 }}>
              <SavedCommutes userId={user.id} currentStationId={context?.station} onUse={handleUseCommute} />
            </div>
          </>
        )}

        {/* People */}
        {view === 'people' && (
          activePeopleRoom ? (
            <>
              <LiveRoomHeader room={activePeopleRoom} />
              <div style={{ height: 12 }} />
              {context && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 8px 12px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="type-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', minWidth: 0 }}>
                      <MapPin size={14} aria-hidden="true" style={{ color: hasManualOverride ? 'var(--success-text)' : 'var(--info-text)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hasManualOverride ? 'You picked' : 'Detected'}: <strong style={{ color: 'var(--text-primary)' }}>{context.stationName}</strong>
                      </span>
                    </span>
                    <button type="button" className="link-btn" onClick={() => setShowCheckInScreen(true)} aria-label="Change station or direction">Change</button>
                  </div>
                  <ContextConfidenceBadge context={context} />
                </div>
              )}
              <DiscoveryScreen
                room={activePeopleRoom}
                context={context}
                currentUser={user}
                friendIds={friendIds}
                ranked={rankedMap[activePeopleRoom.id]}
                vibe={vibeMap[activePeopleRoom.id]}
                isLoading={!rankedMap[activePeopleRoom.id]}
                onConnect={handleConnect}
                onBlock={handleBlock}
                onReport={handleReport}
                onProfileOpen={handleProfileOpen}
              />
              <div style={{ marginTop: 16 }}>
                <EngagementHub room={activePeopleRoom} snapshot={engagement[activePeopleRoom.id] || null} currentUser={user} socket={socket} onReaction={(tid, emoji, ttype, rid) => handleReaction(tid, emoji, ttype, rid)} />
              </div>
            </>
          ) : (
            <div aria-busy="true">
              <span className="sr-only">Finding your room…</span>
              <Skeleton height={112} borderRadius="var(--radius-xl)" style={{ marginBottom: 16 }} />
              {[0, 1, 2].map(i => (
                <div key={i} className="traveler-card" style={{ gap: 12, marginBottom: 10, pointerEvents: 'none' }}>
                  <Skeleton width={48} height={48} borderRadius="50%" delayMs={i * 120} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton width="50%" height={14} delayMs={i * 120 + 60} />
                    <Skeleton width="80%" height={12} delayMs={i * 120 + 120} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <Button type="button" variant="secondary" icon={<MapPin size={16} aria-hidden="true" />} onClick={() => setShowCheckInScreen(true)}>
                  Choose your station
                </Button>
              </div>
            </div>
          )
        )}

        {/* Journey */}
        {view === 'liveTracking' && (
          <LiveTrackingScreen
            currentUser={user}
            friends={friends}
            currentContext={context}
            activeRoom={trainRoom || stationRoom}
            onOpenChat={fid => {
              const f = friends.find(x => x.id === fid || x.friendId === fid);
              if (f) openDirectChat({ id: f.friendId, pseudonym: f.friendProfile.pseudonym, username: f.friendProfile.username, avatarBg: f.friendProfile.avatarBg });
            }}
            onOpenProfile={p => setSelectedUser(p)}
            onContextUpdated={c => setContext(c)}
            onOpenCheckIn={() => setShowCheckInScreen(true)}
          />
        )}

        {/* Room chat (station / train) */}
        {view === 'chat' && activeRoom && (
          <ChatView
            room={activeRoom}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onBack={pop}
            socket={socket}
            typingUsers={typingUsers[activeRoom.id] || []}
            reactions={engagement[activeRoom.id]?.reactions as Parameters<typeof ChatView>[0]['reactions']}
            onReaction={(tid, emoji) => handleReaction(tid, emoji, 'message', activeRoom.id)}
          />
        )}

        {/* Chats list */}
        {view === 'chats' && (
          <ChatsScreen
            friends={friends}
            socket={socket}
            onSelect={(id, peer) => {
              const f = friends.find(x => x.friendId === id || x.id === id);
              if (f) openDirectChat({ id: f.friendId, pseudonym: f.friendProfile.pseudonym, username: f.friendProfile.username, avatarBg: f.friendProfile.avatarBg });
              else if (peer) openDirectChat(peer);
            }}
          />
        )}

        {/* 1:1 thread — full-screen above the shell and tab bar */}
        {view === 'dm' && chatPeer && (
          <div className="animate-push" style={{ position: 'fixed', inset: 0, maxWidth: 'var(--shell-max)', margin: '0 auto', zIndex: 60, background: 'var(--bg-base)' }}>
            <DirectChatScreen
              currentUser={user}
              peer={chatPeer}
              socket={socket}
              onBack={pop}
              onBlocked={() => { refreshFriends(); pop(); showToast('Blocked'); }}
            />
          </div>
        )}

        {/* Friends & requests */}
        {view === 'connect' && (
          <>
            <ScreenHeader title="Friends & requests" onBack={pop} />
            <ConnectScreen
              currentUser={user}
              socket={socket}
              onOpenChat={fid => {
                const f = friends.find(x => x.friendId === fid);
                openDirectChat(f ? { id: f.friendId, pseudonym: f.friendProfile.pseudonym, username: f.friendProfile.username, avatarBg: f.friendProfile.avatarBg } : { id: fid });
              }}
              onOpenSafetyCenter={() => push('safetyCenter')}
            />
          </>
        )}

        {/* My profile */}
        {view === 'profile' && (
          <ProfileStatsScreen
            user={user}
            onEdit={() => setShowProfileEditor(true)}
            onOpenSafetyCenter={() => push('safetyCenter')}
            onOpenBlockedUsers={() => push('blockedUsers')}
            onOpenConnections={() => push('connect')}
            onOpenSavedCommutes={() => push('savedCommutes')}
            onAccountDeleted={() => {
              // ProfileStatsScreen clears storage and reloads; this is the fallback.
              setUser(null);
              showToast('Account deleted');
            }}
          />
        )}

        {view === 'savedCommutes' && (
          <>
            <ScreenHeader title="Saved commutes" onBack={pop} />
            <SavedCommutes userId={user.id} currentStationId={context?.station} onUse={handleUseCommute} />
          </>
        )}

        {view === 'safetyCenter' && (
          <SafetyCenterScreen onBack={pop} onOpenBlockedUsers={() => push('blockedUsers')} />
        )}

        {view === 'blockedUsers' && (
          <BlockedUsersScreen onBack={pop} onUnblocked={() => showToast('Unblocked')} />
        )}

        {/* Live room presence */}
        {view === 'room' && (
          <RoomScreen
            currentUser={user}
            initialRoomId={selectedPresenceRoomId}
            onBack={pop}
            onProfileOpen={u => setSelectedUser(u)}
            onConnect={targetId => handleConnect(targetId)}
            socket={socket}
            socketConnected={socketConnected}
          />
        )}
      </main>

      {/* Profile editor overlay */}
      {showProfileEditor && (
        <ProfileEditor
          user={user}
          onClose={() => setShowProfileEditor(false)}
          onSaved={np => { setUser(np); lsSet(PROFILE_KEY, JSON.stringify(np)); showToast('Profile saved'); track('profile_enhanced', np.id, { tags: np.interestTags.length }); }}
        />
      )}

      {/* Traveler profile sheet */}
      <ProfileSheet
        open={selectedUser !== null && view !== 'profile'}
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
              sharedTags={selectedRanked?.mutualTags ?? (selectedUser.interestTags || []).filter(t => user.interestTags?.includes(t))}
            />
            <ProfileSheetActions
              travelerName={selectedUser.pseudonym}
              initialState={selectedUser.id === user.id ? 'self' : friendIds.includes(selectedUser.id) ? 'already-friends' : 'idle'}
              onSendRequest={() => sendConnectRequest(selectedUser.id)}
              onReport={() => {
                handleReport(selectedUser.id, 'General report');
                setSelectedUser(null);
              }}
              onBlock={() => {
                handleBlock(selectedUser.id);
                setSelectedUser(null);
              }}
            />
          </>
        )}
      </ProfileSheet>

      {/* Station picker (low-confidence nudge or manual) */}
      {showStationPicker && !showCheckInScreen && (
        <StationPicker onConfirm={st => handleStationPicked(st)} onDismiss={() => setShowStationPicker(false)} />
      )}

      {/* Full-screen check-in */}
      {showCheckInScreen && (
        <CheckInScreen
          onCheckIn={handleHeroCheckIn}
          onCancel={() => setShowCheckInScreen(false)}
          initialLineId={context?.line || 'blue'}
          initialStationId={context?.station || 'rajiv_chowk'}
          initialDirection={context?.direction}
        />
      )}

      {/* Peak-hour notification opt-in (home only, dismissible, once a day) */}
      {showPushBanner && (
        <div
          role="region"
          aria-label="Notifications"
          className="card animate-fade-in"
          style={{ position: 'fixed', bottom: 'calc(var(--nav-offset) + 12px)', left: 16, right: 16, maxWidth: 488, margin: '0 auto', zIndex: 39, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px 8px 16px', boxShadow: 'var(--shadow-float)', background: 'var(--bg-elevated)' }}
        >
          <Bell size={22} aria-hidden="true" style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
          <span className="type-label" style={{ flex: 1, color: 'var(--text-primary)' }}>
            Peak hour. Get a nudge when people on your line are riding?
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => { void requestPush(); dismissPushBanner(); }}>Turn on</Button>
          <IconButton label="Dismiss" variant="plain" onClick={dismissPushBanner}><X size={20} aria-hidden="true" /></IconButton>
        </div>
      )}

      <Toast message={toast} onDismiss={dismissToast} aboveNav={!navHidden} />

      {onboardingSteps && (
        <OnboardingScreen user={user} steps={onboardingSteps} onFinish={handleOnboardingFinish} />
      )}

      {!navHidden && (
        <BottomNav active={navActive} onNavigate={v => goTab(v as Tab)} unreadChats={unreadChats} />
      )}
    </div>
  );
}

export default App;
