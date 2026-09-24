/**
 * useLocationContext — the rider's live metro context (station / train /
 * direction) from GPS, battery-aware and honest about what it knows.
 *
 * - Watches position only while `enabled` (the app gates this behind the
 *   location disclosure) and the app is visible. High accuracy only while
 *   moving; cached fixes are accepted while still.
 * - Calls POST /api/context/detect (engine v2) only when it matters: first
 *   fix, nearest station or movement changed, accuracy improved a lot, or
 *   every ≥20 s while moving / ≥60 s while still. With no fix (underground)
 *   it still checks in on that cadence so the server can hold, decay and say
 *   so.
 * - Exposes permission state and a status the UI can explain.
 * - confirm() and override() work without GPS (manual picks are sticky on
 *   the server until the rider moves ~1.5 stations or 30 min pass).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API } from '../config';
import { authHeaders } from '../utils/auth';
import { localMovement, nearestStationId, type LocalMovement } from '../utils/geo';
import type { ContextResult, ContextRoom } from '../types';

export type LocationStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable' | 'error';
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unknown';
export type ContextSource = 'gps' | 'manual' | 'last_checkin' | 'schedule' | 'none';

/** The server's context (engine v2 adds these fields to the legacy shape). */
export interface LocationContext extends ContextResult {
  source?: ContextSource;
  movement?: 'still' | 'walking' | 'in_vehicle' | 'unknown';
  directionKey?: 'towards_a' | 'towards_b';
  directionKnown?: boolean;
  between?: { fromStationId: string; fromStationName: string; toStationId: string; toStationName: string } | null;
  progress?: number | null;
  stickyUntil?: number | null;
  distanceM?: number | null;
  accuracyM?: number | null;
  speedKmh?: number | null;
  held?: boolean;
  stale?: boolean;
  lastFixAt?: number | null;
}

export interface LocationRooms {
  station: ContextRoom | null;
  train: ContextRoom | null;
}

export interface UseLocationContextOptions {
  /** Start watching GPS. False until the user agreed to the location disclosure. */
  enabled: boolean;
  /** Signed-in user id. Nothing is sent until there is one. */
  userId?: string | null;
  /** Ask the server once even without location, so the app still gets rooms. Default true. */
  detectWithoutLocation?: boolean;
}

export interface UseLocationContext {
  context: LocationContext | null;
  rooms: LocationRooms;
  status: LocationStatus;
  permission: LocationPermission;
  confidence: number;
  source: ContextSource | null;
  reason: string;
  /** Device time of the last GPS fix we received (ms), or null. */
  lastFixAt: number | null;
  /** "Yes, that's right": makes the current context sticky. */
  confirm: () => Promise<boolean>;
  /** Manual pick. Sticky until the rider moves ~1.5 stations away or 30 min pass. */
  override: (stationId: string, lineId?: string, direction?: string) => Promise<boolean>;
  /** Force a detect now (e.g. pull-to-refresh). */
  refresh: () => void;
}

const MOVING_INTERVAL_MS = 20_000;
const STILL_INTERVAL_MS = 60_000;
const TICK_MS = 5_000;
/** Stay in "moving" (high-accuracy) mode this long after the last movement, so a platform stop doesn't flap the GPS mode. */
const MOVING_LINGER_MS = 120_000;

interface LastFix {
  lat: number;
  lng: number;
  acc: number;
  t: number;
  speed: number | null;
  heading: number | null;
}

interface Sent {
  at: number;
  stationId: string | null;
  movement: LocalMovement | null;
  acc: number | null;
}

function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export function useLocationContext({ enabled, userId, detectWithoutLocation = true }: UseLocationContextOptions): UseLocationContext {
  const [context, setContext] = useState<LocationContext | null>(null);
  const [rooms, setRooms] = useState<LocationRooms>({ station: null, train: null });
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [isVisible, setIsVisible] = useState(visible);

  const fixRef = useRef<LastFix | null>(null);
  const lastMovingAtRef = useRef(0);
  const movementRef = useRef<LocalMovement>('still');
  const sentRef = useRef<Sent>({ at: 0, stationId: null, movement: null, acc: null });
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const userRef = useRef(userId);
  const enabledRef = useRef(enabled);
  const gotFixRef = useRef(false);
  useEffect(() => {
    userRef.current = userId;
    enabledRef.current = enabled;
  });

  /** Moving → switch to high accuracy at once; back to low power only after a quiet spell. */
  const markMoving = useCallback((isMoving: boolean) => {
    const now = Date.now();
    if (isMoving) {
      lastMovingAtRef.current = now;
      setMoving(true);
    } else if (now - lastMovingAtRef.current > MOVING_LINGER_MS) {
      setMoving(false);
    }
  }, []);

  // ── Server call ─────────────────────────────────────────────────────────
  const send = useCallback(async (extra?: Record<string, unknown>): Promise<boolean> => {
    const uid = userRef.current;
    if (!uid) return false;
    if (inFlightRef.current && !extra) {
      queuedRef.current = true;
      return false;
    }
    inFlightRef.current = true;
    const fix = enabledRef.current ? fixRef.current : null;
    const body: Record<string, unknown> = { v: 2, userId: uid, ...extra };
    if (fix) {
      body.lat = fix.lat;
      body.lng = fix.lng;
      body.accuracyM = Math.round(fix.acc);
      body.fixAt = fix.t;
      if (fix.speed !== null) body.speedKmh = Math.round(fix.speed * 3.6 * 10) / 10;
      if (fix.heading !== null && fix.speed !== null && fix.speed > 1) body.headingDegrees = fix.heading;
    }
    const station = fix ? nearestStationId(fix.lat, fix.lng)?.id ?? null : null;
    sentRef.current = { at: Date.now(), stationId: station, movement: fix ? movementRef.current : null, acc: fix?.acc ?? null };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${API}/api/context/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`detect ${res.status}`);
      const data = await res.json();
      const ctx: LocationContext = data.context;
      setContext(ctx);
      setRooms({
        station: data.rooms?.station ?? (data.room?.type === 'station' ? data.room : null),
        train: data.rooms?.train ?? (data.room?.type === 'train' ? data.room : null)
      });
      markMoving(ctx.movement === 'in_vehicle' || ctx.movement === 'walking' || movementRef.current !== 'still');
      setStatus(prev => (prev === 'denied' || prev === 'unavailable' ? prev : enabledRef.current ? (gotFixRef.current ? 'ok' : 'locating') : 'idle'));
      return true;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return false;
      setStatus(prev => (prev === 'denied' || prev === 'unavailable' ? prev : 'error'));
      return false;
    } finally {
      inFlightRef.current = false;
      if (abortRef.current === ctrl) abortRef.current = null;
      if (queuedRef.current) {
        queuedRef.current = false;
        void send();
      }
    }
  }, [markMoving]);

  /** Decide whether a fresh fix (or the passage of time) warrants a server call. */
  const maybeSend = useCallback((force = false) => {
    if (!userRef.current || !visible()) return;
    const now = Date.now();
    const last = sentRef.current;
    const fix = fixRef.current;
    const isMoving = movementRef.current !== 'still';
    const interval = isMoving ? MOVING_INTERVAL_MS : STILL_INTERVAL_MS;
    if (force || last.at === 0) { void send(); return; }
    if (fix) {
      const nearest = nearestStationId(fix.lat, fix.lng)?.id ?? null;
      if (nearest !== last.stationId || movementRef.current !== last.movement) { void send(); return; }
      if (last.acc !== null && last.acc > 200 && fix.acc < 100) { void send(); return; }
    }
    if (now - last.at >= interval) void send();
  }, [send]);

  // ── Initial detect (also without location, so the app has rooms) ──────
  useEffect(() => {
    if (!userId) return;
    sentRef.current = { at: 0, stationId: null, movement: null, acc: null };
    if (!enabled && detectWithoutLocation) void send();
  }, [userId, enabled, detectWithoutLocation, send]);

  // ── Permission state ────────────────────────────────────────────────────
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const apply = () => { if (status && !cancelled) setPermission(status.state as LocationPermission); };
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then(s => { status = s; apply(); s.addEventListener('change', apply); })
      .catch(() => { /* not supported (some WebViews) */ });
    return () => { cancelled = true; status?.removeEventListener('change', apply); };
  }, []);

  // ── Visibility: pause GPS and detects while hidden ──────────────────────
  useEffect(() => {
    const onVis = () => setIsVisible(visible());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Position watch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) { setStatus('idle'); return; }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { setStatus('unavailable'); return; }
    if (!isVisible) return; // resumes (and re-detects) when visible again
    setStatus(s => (s === 'ok' ? s : 'locating'));

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const c = pos.coords;
        const cur: LastFix = {
          lat: c.latitude,
          lng: c.longitude,
          acc: Number.isFinite(c.accuracy) ? c.accuracy : 100,
          t: pos.timestamp || Date.now(),
          speed: c.speed ?? null,
          heading: c.heading ?? null
        };
        const m = localMovement(fixRef.current, cur);
        fixRef.current = cur;
        movementRef.current = m.movement;
        gotFixRef.current = true;
        setLastFixAt(cur.t);
        setPermission('granted');
        markMoving(m.movement !== 'still');
        maybeSend();
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) { setStatus('denied'); setPermission('denied'); }
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus(s => (s === 'ok' ? s : 'unavailable'));
        // TIMEOUT: keep going; the tick still checks in so the server can hold/decay.
      },
      // High accuracy (GPS radio) only while moving; while still, a cached
      // network fix up to 30 s old is fine and far cheaper.
      moving
        ? { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
        : { enableHighAccuracy: false, maximumAge: 30_000, timeout: 30_000 }
    );

    // Cadence tick: sends on schedule even when no fixes arrive (underground).
    const tick = setInterval(() => maybeSend(), TICK_MS);
    // Coming back to the foreground: check in right away.
    maybeSend(sentRef.current.at === 0 || Date.now() - sentRef.current.at > MOVING_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
    };
  }, [enabled, isVisible, moving, maybeSend, markMoving]);

  // Abort an in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Actions ─────────────────────────────────────────────────────────────
  const confirm = useCallback(() => send({ confirm: true }), [send]);
  const override = useCallback(
    (stationId: string, lineId?: string, direction?: string) =>
      send({ override: { stationId, ...(lineId ? { lineId } : {}), ...(direction ? { direction } : {}) } }),
    [send]
  );
  const refresh = useCallback(() => maybeSend(true), [maybeSend]);

  return {
    context,
    rooms,
    status,
    permission,
    confidence: context?.confidence ?? 0,
    source: context?.source ?? null,
    reason: context?.reason ?? '',
    lastFixAt: lastFixAt ?? context?.lastFixAt ?? null,
    confirm,
    override,
    refresh
  };
}
