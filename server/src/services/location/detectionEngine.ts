/**
 * Location & presence detection engine — pure functions.
 *
 *   step(previousState, input) → { state, detection }
 *
 * No clocks, no I/O, no singletons: time comes in as `input.now`, and the
 * caller owns where state is stored (TransitContextEngine keeps one per user).
 * That makes every behaviour below unit-testable with synthetic fixes.
 *
 * What it does, in order:
 *  1. Apply explicit user input (manual station pick, direction flip, confirm).
 *  2. Grade the GPS fix (age, accuracy) and classify movement from speed and
 *     fix history (still / walking / in_vehicle, with a linger so a train
 *     dwelling at a platform is still a train).
 *  3. Rank stations by haversine distance minus a per-station catchment
 *     radius, preferring the rider's current line at interchanges.
 *  4. Hysteresis: only move the committed station when a new one wins on N
 *     consecutive fixes, or wins clearly. On a train, follow the track instead.
 *  5. Direction from the ordered sequence of committed stations (branch-aware),
 *     then device heading, then the last known direction.
 *  6. Confidence 0–1 with a source and a plain-language reason. With no usable
 *     fix, hold the last confident context for a TTL (decaying), dead-reckon a
 *     moving train by typical timings, then admit we don't know.
 *  7. Manual picks are sticky until the rider moves ~1.5 stations away or 30
 *     minutes pass.
 */
import { accuracyQuality, haversineM, median, proximityLikelihood } from './geo';
import {
  DirectionKey,
  LineTopology,
  ResolvedDirection,
  allStationEntries,
  catchmentRadiusM,
  directionFromHeading,
  directionFromSequence,
  directionFromString,
  directionLabel,
  getLineTopology,
  getStationEntry,
  hubStationIds,
  locateOnLine,
  routesContaining,
  stationsBetween
} from './topology';

export type Movement = 'still' | 'walking' | 'in_vehicle' | 'unknown';
export type ContextSource = 'gps' | 'manual' | 'last_checkin' | 'schedule' | 'none';
export type ContextKind = 'station' | 'train' | 'nearby';
export type MovementHint = 'STILL' | 'WALKING' | 'IN_VEHICLE';

export const TUNING = {
  /** Consecutive fixes a new nearest station must win before we switch. */
  SWITCH_CONSECUTIVE: 2,
  /** Fixes worse than this are ignored entirely (cell-level noise). */
  MAX_USABLE_ACCURACY_M: 1000,
  /** Fixes worse than this never move the committed station on their own. */
  NO_SWITCH_ACCURACY_M: 300,
  /** Accuracy assumed when an older client sends none. */
  DEFAULT_ACCURACY_M: 65,
  /** A fix older than this (by its own timestamp) is stale. */
  FIX_MAX_AGE_MS: 2 * 60_000,
  STILL_MPS: 0.7,     // < 2.5 km/h
  WALK_MPS: 2.8,      // < 10 km/h
  VEHICLE_MPS: 4.5,   // ≥ 16 km/h
  MAX_PLAUSIBLE_MPS: 40,
  /** Stay "in vehicle" this long after the last fast reading (platform dwell, signal stops). */
  VEHICLE_LINGER_MS: 90_000,
  /** Hold the last confident context without GPS for… */
  HOLD_STATION_MS: 10 * 60_000,
  HOLD_UNDERGROUND_STATION_MS: 15 * 60_000,
  HOLD_TRAIN_MS: 6 * 60_000,
  /** Manual picks: sticky for 30 min or until the rider moves ~1.5 stations away. */
  MANUAL_TTL_MS: 30 * 60_000,
  MANUAL_RELEASE_STATIONS: 1.5,
  /** Typical run + dwell per station, for dead reckoning underground. */
  SECONDS_PER_STATION: 150,
  /** Max distance from the track to count as riding it. */
  ON_TRACK_M: 350,
  /** A remembered direction expires after this long without confirmation. */
  DIRECTION_MEMORY_MS: 20 * 60_000
};

export interface Fix {
  lat: number;
  lng: number;
  /** 68% horizontal accuracy radius in metres, as reported by the device. */
  accuracyM?: number;
  /** GPS (Doppler) speed, m/s. */
  speedMps?: number;
  /** Course over ground, degrees. Meaningless when stationary. */
  headingDeg?: number;
  /** When the fix was taken (device clock), ms. */
  t: number;
}

export interface DirectionState extends ResolvedDirection {
  lineId: string;
  source: 'sequence' | 'heading' | 'manual' | 'default' | 'memory';
  t: number;
}

export interface ManualOverride {
  stationId: string;
  lineId: string;
  direction?: ResolvedDirection;
  setAt: number;
}

export interface Detection {
  stationId: string | null;
  lineId: string | null;
  context: ContextKind;
  movement: Movement;
  direction: string;
  directionKey: DirectionKey;
  directionKnown: boolean;
  routeId?: string;
  /** 0–1. */
  confidence: number;
  source: ContextSource;
  reason: string;
  between: { fromStationId: string; fromStationName: string; toStationId: string; toStationName: string } | null;
  /** 0–1 from `between.from` to `between.to`. */
  progress: number | null;
  /** Distance from the fix to the station, when a fix was used. */
  distanceM: number | null;
  accuracyM: number | null;
  speedKmh: number | null;
  /** Epoch ms until which a manual pick overrides GPS. */
  stickyUntil: number | null;
  /** True when this is an older position being held without fresh GPS. */
  held: boolean;
  /** True when we have given up holding and the position is just a last-seen hint. */
  stale: boolean;
  lastFixAt: number | null;
}

export interface EngineState {
  stationId?: string;
  lineId?: string;
  pending?: { stationId: string; lineId: string; count: number };
  /** Committed stations in visit order (current line only), newest last. */
  visits: { stationId: string; lineId: string; t: number }[];
  fixes: { lat: number; lng: number; acc: number; t: number; speedMps?: number }[];
  movement: Movement;
  lastVehicleAt?: number;
  lastSpeedMps?: number;
  direction?: DirectionState;
  manual?: ManualOverride;
  manualDirection?: DirectionState & { setAt: number };
  lastGood?: { detection: Detection; t: number };
  lastFixAt?: number;
  /** Stable train slot, owned by the caller (schedule engine). */
  train?: { lineId: string; key: DirectionKey; slot: number };
  updatedAt: number;
}

export interface DetectInput {
  now: number;
  fix?: Fix;
  movementHint?: MovementHint;
  /** Rider picked a station (and optionally a line and direction). */
  override?: { stationId: string; lineId?: string; direction?: string };
  /** Rider flipped direction ("Towards X") on a line. */
  directionOverride?: { lineId: string; direction: string };
  /** Rider tapped "yes, that's right" on the current context. */
  confirm?: boolean;
  /** Restrict station candidates (BEACHHEAD_LINE). */
  lineFilter?: (lineId: string) => boolean;
}

export function initialState(now: number): EngineState {
  return { visits: [], fixes: [], movement: 'unknown', updatedAt: now };
}

function cloneState(s: EngineState): EngineState {
  return {
    ...s,
    pending: s.pending && { ...s.pending },
    visits: [...s.visits],
    fixes: [...s.fixes],
    manual: s.manual && { ...s.manual },
    train: s.train && { ...s.train }
  };
}

// ─── Station ranking ───────────────────────────────────────────────────────

export interface Candidate {
  stationId: string;
  lineId: string;
  distanceM: number;
  radiusM: number;
  /** How plausible it is that the fix was taken at this station, 0–1. */
  likelihood: number;
}

/**
 * Stations ordered by distance beyond their catchment (haversine − radius), so
 * a big interchange 300 m away can beat a small halt 200 m away.
 */
export function rankStations(p: { lat: number; lng: number }, accuracyM: number, lineFilter?: (lineId: string) => boolean, limit = 6): Candidate[] {
  const out: Candidate[] = [];
  for (const { station, line } of allStationEntries()) {
    if (lineFilter && !lineFilter(line.id)) continue;
    const d = haversineM(p.lat, p.lng, station.lat, station.lng);
    const r = catchmentRadiusM(station.id);
    out.push({ stationId: station.id, lineId: line.id, distanceM: d, radiusM: r, likelihood: proximityLikelihood(d, r, accuracyM) });
  }
  out.sort((a, b) => (a.distanceM - a.radiusM) - (b.distanceM - b.radiusM));
  return out.slice(0, limit);
}

/** Best station for a fix. At an interchange, stays on `preferLineId` when that line serves the same hub. */
export function nearestStation(p: { lat: number; lng: number }, accuracyM: number, preferLineId?: string, lineFilter?: (lineId: string) => boolean): Candidate | null {
  const ranked = rankStations(p, accuracyM, lineFilter);
  const best = ranked[0];
  if (!best || !preferLineId || best.lineId === preferLineId) return best || null;
  for (const id of hubStationIds(best.stationId)) {
    const e = getStationEntry(id);
    if (!e || e.line.id !== preferLineId || (lineFilter && !lineFilter(e.line.id))) continue;
    const d = haversineM(p.lat, p.lng, e.station.lat, e.station.lng);
    const r = catchmentRadiusM(id);
    return { stationId: id, lineId: e.line.id, distanceM: d, radiusM: r, likelihood: proximityLikelihood(d, r, accuracyM) };
  }
  return best;
}

// ─── Movement ──────────────────────────────────────────────────────────────

export function classifyMovement(
  fixes: EngineState['fixes'],
  current: { speedMps?: number } | undefined,
  hint: MovementHint | undefined,
  prev: Movement,
  lastVehicleAt: number | undefined,
  now: number
): { movement: Movement; speedMps?: number; lastVehicleAt?: number } {
  let v: number | undefined;
  if (current && current.speedMps !== undefined && Number.isFinite(current.speedMps) && current.speedMps >= 0) {
    v = current.speedMps;
  } else if (fixes.length >= 2) {
    // Speed from displacement between recent fixes, ignoring moves smaller
    // than the combined accuracy (that is noise, not travel).
    const vs: number[] = [];
    let sharpest = Infinity;
    const recent = fixes.slice(-4);
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1];
      const b = recent[i];
      const dt = (b.t - a.t) / 1000;
      if (dt < 3 || dt > 180) continue;
      const disp = haversineM(a.lat, a.lng, b.lat, b.lng);
      const noise = a.acc + b.acc;
      const speed = disp <= noise ? 0 : (disp - noise * 0.5) / dt;
      // Faster than any metro (Airport Express tops out ~33 m/s): a GPS jump.
      if (speed > TUNING.MAX_PLAUSIBLE_MPS) continue;
      vs.push(speed);
      sharpest = Math.min(sharpest, Math.max(a.acc, b.acc));
    }
    // One pair of fixes only counts when both are sharp; otherwise a single
    // noisy jump would read as a train ride.
    v = vs.length >= 2 || (vs.length === 1 && sharpest <= 50) ? median(vs) : undefined;
  }

  let m: Movement;
  if (v === undefined) {
    m = hint === 'IN_VEHICLE' ? 'in_vehicle' : hint === 'WALKING' ? 'walking' : hint === 'STILL' ? 'still' : prev;
  } else if (v >= TUNING.VEHICLE_MPS) m = 'in_vehicle';
  else if (v >= TUNING.WALK_MPS) m = prev === 'in_vehicle' ? 'in_vehicle' : 'walking'; // 10–16 km/h: slow train or a brisk cyclist
  else if (v >= TUNING.STILL_MPS) m = 'walking';
  else m = 'still';

  let lva = lastVehicleAt;
  if (m === 'in_vehicle' && (v === undefined ? hint === 'IN_VEHICLE' : v >= TUNING.WALK_MPS)) lva = now;
  else if (m !== 'in_vehicle' && prev === 'in_vehicle' && lva !== undefined && now - lva < TUNING.VEHICLE_LINGER_MS) m = 'in_vehicle';
  return { movement: m, speedMps: v, lastVehicleAt: lva };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function stationName(id: string): string {
  return getStationEntry(id)?.station.name || id;
}

function fmtDistance(m: number): string {
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

function fmtMinutes(ms: number): string {
  const min = Math.round(ms / 60_000);
  return min <= 1 ? '1 min' : `${min} min`;
}

function round2(x: number): number {
  return Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;
}

/** Average spacing to this station's neighbours on its line. */
export function localSpacingM(topo: LineTopology, stationId: string): number {
  const here = topo.stations.get(stationId);
  if (!here) return topo.meanSpacingM;
  const ds: number[] = [];
  for (const r of routesContaining(topo, stationId)) {
    const i = r.stationIds.indexOf(stationId);
    for (const j of [i - 1, i + 1]) {
      const n = r.stationIds[j] && topo.stations.get(r.stationIds[j]);
      if (n) ds.push(haversineM(here.lat, here.lng, n.lat, n.lng));
    }
  }
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : topo.meanSpacingM;
}

function routeGap(topo: LineTopology, a: string, b: string): number {
  const r = topo.routes.find(x => x.stationIds.includes(a) && x.stationIds.includes(b));
  return r ? Math.abs(r.stationIds.indexOf(a) - r.stationIds.indexOf(b)) : Infinity;
}

function commitStation(s: EngineState, stationId: string, lineId: string, now: number): void {
  if (s.stationId === stationId) return;
  if (s.lineId !== lineId) {
    // Changed line (interchange). Seed the new line's sequence with the hub
    // station we were at, so direction resolves on the very next station.
    const seed = s.stationId ? hubStationIds(s.stationId).find(id => getStationEntry(id)?.line.id === lineId) : undefined;
    s.visits = seed && seed !== stationId ? [{ stationId: seed, lineId, t: now }] : [];
  } else if (s.stationId) {
    const topo = getLineTopology(lineId);
    if (topo) for (const mid of stationsBetween(topo, s.stationId, stationId)) s.visits.push({ stationId: mid, lineId, t: now });
  }
  s.visits.push({ stationId, lineId, t: now });
  if (s.visits.length > 8) s.visits.splice(0, s.visits.length - 8);
  s.stationId = stationId;
  s.lineId = lineId;
}

function orientBetween(topo: LineTopology, aId: string, bId: string, t: number, key: DirectionKey): { between: Detection['between']; progress: number } {
  const [from, to, progress] = key === 'towards_a' ? [bId, aId, 1 - t] : [aId, bId, t];
  return {
    between: {
      fromStationId: from,
      fromStationName: topo.stations.get(from)?.name || from,
      toStationId: to,
      toStationName: topo.stations.get(to)?.name || to
    },
    progress: Math.round(progress * 100) / 100
  };
}

/** Where a train probably is `elapsedMs` after `fromId`, at typical run + dwell times. */
export function deadReckon(topo: LineTopology, fromId: string, key: DirectionKey, routeId: string | undefined, elapsedMs: number): { stationId: string; nextId?: string; progress: number } {
  const r = (routeId && topo.routes.find(x => x.id === routeId && x.stationIds.includes(fromId))) || routesContaining(topo, fromId)[0];
  if (!r) return { stationId: fromId, progress: 0 };
  const step = key === 'towards_b' ? 1 : -1;
  const i0 = r.stationIds.indexOf(fromId);
  const travelled = elapsedMs / 1000 / TUNING.SECONDS_PER_STATION;
  let i = i0 + step * Math.floor(travelled);
  const last = step > 0 ? r.stationIds.length - 1 : 0;
  if ((step > 0 && i >= last) || (step < 0 && i <= last)) return { stationId: r.stationIds[last], progress: 0 };
  i = Math.max(0, Math.min(r.stationIds.length - 1, i));
  return { stationId: r.stationIds[i], nextId: r.stationIds[i + step], progress: Math.round((travelled % 1) * 100) / 100 };
}

// ─── GPS station tracking with hysteresis ──────────────────────────────────

function trackStation(s: EngineState, fix: Fix, acc: number, cand: Candidate, now: number): void {
  if (!s.stationId || !s.lineId) {
    if (acc <= 500) commitStation(s, cand.stationId, cand.lineId, now);
    return;
  }
  if (cand.stationId === s.stationId) {
    s.pending = undefined;
    return;
  }
  const cur = getStationEntry(s.stationId);
  if (!cur) {
    commitStation(s, cand.stationId, cand.lineId, now);
    return;
  }
  const curD = haversineM(fix.lat, fix.lng, cur.station.lat, cur.station.lng);
  const curR = catchmentRadiusM(s.stationId);

  // On a train: follow the track. Nearest-station flips at the midpoint of
  // every segment; the last station passed is what matters.
  if (s.movement === 'in_vehicle') {
    const topo = getLineTopology(s.lineId);
    const pos = topo && locateOnLine(topo, fix);
    if (topo && pos && pos.crossTrackM <= TUNING.ON_TRACK_M + acc) {
      const { aId, bId } = pos.segment;
      const nearEnough = (id: string) => {
        const st = topo.stations.get(id)!;
        return haversineM(fix.lat, fix.lng, st.lat, st.lng) <= catchmentRadiusM(id) + Math.min(acc, 150);
      };
      if (aId === s.stationId || bId === s.stationId) {
        const other = aId === s.stationId ? bId : aId;
        if (nearEnough(other)) commitStation(s, other, s.lineId, now);
      } else {
        const behind = routeGap(topo, s.stationId, aId) <= routeGap(topo, s.stationId, bId) ? aId : bId;
        const ahead = behind === aId ? bId : aId;
        commitStation(s, nearEnough(ahead) ? ahead : behind, s.lineId, now);
      }
      s.pending = undefined;
      return;
    }
    // Off this line's track: changed line or not on the metro. Fall through.
  }

  // Too noisy to move us — unless we are obviously somewhere else entirely.
  if (acc > TUNING.NO_SWITCH_ACCURACY_M && curD <= 3000) return;

  const clearWin =
    (cand.distanceM <= cand.radiusM && acc <= 100 && curD > curR + 2 * acc) ||
    curD - cand.distanceM > Math.max(1500, 3 * acc);
  if (clearWin) {
    commitStation(s, cand.stationId, cand.lineId, now);
    s.pending = undefined;
    return;
  }
  if (s.pending && s.pending.stationId === cand.stationId) s.pending.count += 1;
  else s.pending = { stationId: cand.stationId, lineId: cand.lineId, count: 1 };
  if (s.pending.count >= TUNING.SWITCH_CONSECUTIVE) {
    commitStation(s, cand.stationId, cand.lineId, now);
    s.pending = undefined;
  }
}

// ─── Main step ─────────────────────────────────────────────────────────────

export function step(prev: EngineState | undefined, input: DetectInput): { state: EngineState; detection: Detection } {
  const now = input.now;
  const s = prev ? cloneState(prev) : initialState(now);
  s.updatedAt = now;
  const notes: string[] = [];

  // 1. Explicit user input
  if (input.override) {
    const e = resolveStation(input.override.stationId, input.override.lineId);
    if (e) {
      const topo = getLineTopology(e.lineId)!;
      const dir = input.override.direction ? directionFromString(topo, input.override.direction) : undefined;
      s.manual = { stationId: e.stationId, lineId: e.lineId, direction: dir, setAt: now };
      s.manualDirection = dir ? { ...dir, lineId: e.lineId, source: 'manual', t: now, setAt: now } : undefined;
      commitStation(s, e.stationId, e.lineId, now);
      s.pending = undefined;
    }
  }
  if (input.directionOverride) {
    const topo = getLineTopology(input.directionOverride.lineId);
    if (topo) {
      const dir = directionFromString(topo, input.directionOverride.direction);
      s.manualDirection = { ...dir, lineId: topo.line.id, source: 'manual', t: now, setAt: now };
      if (s.manual && s.manual.lineId === topo.line.id) s.manual.direction = dir;
    }
  }
  if (input.confirm && !input.override && s.stationId && s.lineId) {
    const known = s.direction && s.direction.lineId === s.lineId && s.direction.source !== 'default' ? s.direction : undefined;
    s.manual = { stationId: s.stationId, lineId: s.lineId, direction: known && { key: known.key, label: known.label, routeId: known.routeId }, setAt: now };
  }

  // 2. Grade the fix
  const fix = input.fix;
  let acc: number | undefined;
  let usable = false;
  let fixProblem: string | undefined;
  if (fix) {
    acc = fix.accuracyM !== undefined && Number.isFinite(fix.accuracyM) && fix.accuracyM > 0 ? fix.accuracyM : TUNING.DEFAULT_ACCURACY_M;
    if (now - fix.t > TUNING.FIX_MAX_AGE_MS) fixProblem = `your last GPS fix is ${fmtMinutes(now - fix.t)} old`;
    else if (acc > TUNING.MAX_USABLE_ACCURACY_M) fixProblem = `GPS is too weak (±${fmtDistance(acc)})`;
    else usable = true;
  }
  if (usable && fix && acc !== undefined) {
    s.fixes.push({ lat: fix.lat, lng: fix.lng, acc, t: fix.t, speedMps: fix.speedMps });
    s.fixes = s.fixes.filter(f => now - f.t <= 5 * 60_000).slice(-6);
    s.lastFixAt = Math.max(s.lastFixAt || 0, fix.t);
  }

  // 3. Movement
  const mv = classifyMovement(usable ? s.fixes : [], usable ? fix : undefined, input.movementHint, s.movement, s.lastVehicleAt, now);
  s.movement = mv.movement;
  s.lastVehicleAt = mv.lastVehicleAt;
  if (mv.speedMps !== undefined) s.lastSpeedMps = mv.speedMps;
  const speedKmh = usable && mv.speedMps !== undefined ? Math.round(mv.speedMps * 3.6) : null;

  // 4. Release a manual pick that has expired or that the rider has left behind
  if (s.manual) {
    if (now - s.manual.setAt > TUNING.MANUAL_TTL_MS) {
      notes.push(`your pick of ${stationName(s.manual.stationId)} expired after 30 min`);
      s.manual = undefined;
      s.manualDirection = undefined;
    } else if (usable && fix && acc !== undefined && acc <= 150) {
      const e = getStationEntry(s.manual.stationId);
      const topo = getLineTopology(s.manual.lineId);
      if (e && topo) {
        const d = haversineM(fix.lat, fix.lng, e.station.lat, e.station.lng);
        const limit = Math.max(1200, TUNING.MANUAL_RELEASE_STATIONS * localSpacingM(topo, e.station.id));
        if (d - acc > limit) {
          notes.push(`you've moved ${fmtDistance(d)} from ${e.station.name}, so we switched back to GPS`);
          s.manual = undefined;
          s.manualDirection = undefined;
          s.pending = undefined;
          // Let GPS re-acquire from scratch rather than from the old pick.
          s.stationId = undefined;
          s.lineId = undefined;
          s.visits = [];
          s.direction = undefined;
        }
      }
    }
  }
  if (s.manualDirection && now - s.manualDirection.setAt > TUNING.MANUAL_TTL_MS) s.manualDirection = undefined;

  // 5. GPS station tracking
  if (usable && fix && acc !== undefined && !s.manual) {
    const cand = nearestStation(fix, acc, s.lineId, input.lineFilter);
    if (cand) trackStation(s, fix, acc, cand, now);
  }

  const stationId = s.manual?.stationId ?? s.stationId;
  const lineId = s.manual?.lineId ?? s.lineId;
  const lastFixAt = s.lastFixAt ?? null;
  const stickyUntil = s.manual ? s.manual.setAt + TUNING.MANUAL_TTL_MS : null;
  const noteText = notes.length ? ` (${notes.join('; ')})` : '';

  if (!stationId || !lineId) {
    const detection: Detection = {
      stationId: null, lineId: null, context: 'nearby', movement: s.movement,
      direction: '', directionKey: 'towards_b', directionKnown: false,
      confidence: 0, source: 'none',
      reason: (fixProblem ? `We can't place you yet: ${fixProblem}.` : "We don't know where you are yet.") + ' Pick your station to join a room.' + noteText,
      between: null, progress: null, distanceM: null, accuracyM: acc ?? null, speedKmh,
      stickyUntil, held: false, stale: false, lastFixAt
    };
    return { state: s, detection };
  }

  // 6. Direction
  const topo = getLineTopology(lineId)!;
  let dir: DirectionState | undefined;
  if (s.manualDirection && s.manualDirection.lineId === lineId) dir = s.manualDirection;
  else if (s.manual?.direction) dir = { ...s.manual.direction, lineId, source: 'manual', t: s.manual.setAt };
  if (!dir) {
    const seq = s.visits.filter(v => v.lineId === lineId).map(v => v.stationId);
    const fromSeq = directionFromSequence(topo, seq);
    if (fromSeq) dir = { ...fromSeq, lineId, source: 'sequence', t: now };
  }
  if (!dir && usable && fix?.headingDeg !== undefined && s.movement === 'in_vehicle' && (mv.speedMps ?? 0) >= TUNING.VEHICLE_MPS) {
    const h = directionFromHeading(topo, stationId, fix.headingDeg);
    if (h) dir = { ...h, lineId, source: 'heading', t: now };
  }
  if (!dir && s.direction && s.direction.lineId === lineId && s.direction.source !== 'default' && now - s.direction.t < TUNING.DIRECTION_MEMORY_MS) {
    // Remembered; re-label so the branch name appears once we pass the fork.
    const relabel = directionLabel(topo, s.direction.key, stationId, s.direction.routeId);
    dir = { ...s.direction, ...relabel, source: 'memory' };
  }
  const directionKnown = !!dir;
  if (!dir) dir = { ...directionLabel(topo, 'towards_b', stationId), lineId, source: 'default', t: now };
  if (dir.source !== 'memory' || !s.direction) s.direction = dir;

  const base = {
    stationId, lineId, movement: s.movement,
    direction: dir.label, directionKey: dir.key, directionKnown, routeId: dir.routeId,
    accuracyM: usable ? acc ?? null : null, speedKmh, stickyUntil, lastFixAt
  };
  const station = topo.stations.get(stationId)!;
  const lineName = topo.line.name;
  const dirText = directionKnown ? ` · ${dir.label}` : '';

  // 7a. Manual pick in force
  if (s.manual) {
    let confidence = 0.9 - 0.2 * ((now - s.manual.setAt) / TUNING.MANUAL_TTL_MS);
    let gpsNote = '';
    let distanceM: number | null = null;
    if (usable && fix && acc !== undefined) {
      distanceM = Math.round(haversineM(fix.lat, fix.lng, station.lat, station.lng));
      if (distanceM - acc > catchmentRadiusM(stationId) + 300) {
        confidence -= 0.15;
        gpsNote = ` GPS puts you about ${fmtDistance(distanceM)} away.`;
      }
    }
    const detection: Detection = {
      ...base,
      context: s.movement === 'in_vehicle' ? 'train' : 'station',
      confidence: round2(confidence), source: 'manual',
      reason: `You picked ${station.name} on the ${lineName}${dirText}.${gpsNote} Stays until you move away or for 30 min.`,
      between: null, progress: null, distanceM, held: false, stale: false
    };
    return { state: s, detection };
  }

  // 7b. Fresh GPS
  if (usable && fix && acc !== undefined) {
    const d = haversineM(fix.lat, fix.lng, station.lat, station.lng);
    const r = catchmentRadiusM(stationId);
    const q = accuracyQuality(acc);
    const prox = proximityLikelihood(d, r, acc);
    let detection: Detection;
    if (s.movement === 'in_vehicle') {
      const pos = locateOnLine(topo, fix);
      const onTrack = !!pos && pos.crossTrackM <= TUNING.ON_TRACK_M + acc;
      const atStation = d <= r + Math.min(acc, 150);
      if (onTrack || atStation) {
        let between: Detection['between'] = null;
        let progress: number | null = null;
        if (!atStation && pos) ({ between, progress } = orientBetween(topo, pos.segment.aId, pos.segment.bId, pos.t, dir.key));
        const confidence = 0.3 + 0.3 * q + (directionKnown ? 0.2 : 0) + (dir.source === 'sequence' ? 0.1 : 0) + (onTrack ? 0.05 : 0);
        const where = between ? `between ${between.fromStationName} and ${between.toStationName}` : `at ${station.name}`;
        const speed = speedKmh !== null ? `Moving at ${speedKmh} km/h` : 'Moving';
        detection = {
          ...base, context: 'train', confidence: round2(Math.min(0.95, confidence)), source: 'gps',
          reason: `${speed} on the ${lineName} ${where}${directionKnown ? ` · ${dir.label}` : ' · direction not known yet'}.${noteText}`,
          between, progress, distanceM: Math.round(d), held: false, stale: false
        };
      } else {
        detection = {
          ...base, context: 'nearby', confidence: round2(Math.min(0.35, 0.1 + 0.25 * prox * q)), source: 'gps',
          reason: `You're moving but not along a metro line. Nearest station: ${station.name}, ${fmtDistance(d)} away.${noteText}`,
          between: null, progress: null, distanceM: Math.round(d), held: false, stale: false
        };
      }
    } else if (d <= r || (d <= r + acc && acc <= 100)) {
      const settling = !!s.pending;
      const confidence = 0.45 + 0.45 * q * prox + (settling ? -0.1 : 0.05);
      detection = {
        ...base, context: 'station', confidence: round2(Math.min(0.95, confidence)), source: 'gps',
        reason: `GPS puts you at ${station.name} (±${fmtDistance(acc)})${settling ? `, but you may be heading to ${stationName(s.pending!.stationId)}` : ''}.${noteText}`,
        between: null, progress: null, distanceM: Math.round(d), held: false, stale: false
      };
    } else {
      const pendingEntry = s.pending && getStationEntry(s.pending.stationId);
      const pendingD = pendingEntry ? haversineM(fix.lat, fix.lng, pendingEntry.station.lat, pendingEntry.station.lng) : Infinity;
      detection = {
        ...base, context: 'nearby', confidence: round2(Math.min(0.45, 0.1 + 0.35 * prox * q)), source: 'gps',
        reason: pendingEntry && pendingD < d
          ? `You may be at ${pendingEntry.station.name} (${fmtDistance(pendingD)} away, ±${fmtDistance(acc)}); confirming on the next fix.${noteText}`
          : `Nearest station is ${station.name}, ${fmtDistance(d)} away (±${fmtDistance(acc)}).${noteText}`,
        between: null, progress: null, distanceM: Math.round(d), held: false, stale: false
      };
    }
    if (detection.confidence >= 0.5) s.lastGood = { detection, t: now };
    return { state: s, detection };
  }

  // 7c. No usable GPS: hold, dead-reckon, then admit it
  const why = fixProblem ? fixProblem[0].toUpperCase() + fixProblem.slice(1) : 'No GPS signal';
  const lg = s.lastGood;
  if (lg && lg.detection.stationId && lg.detection.lineId) {
    const age = now - lg.t;
    const lgTopo = getLineTopology(lg.detection.lineId)!;
    const lgStation = lgTopo.stations.get(lg.detection.stationId)!;
    const ttl = lg.detection.context === 'train' ? TUNING.HOLD_TRAIN_MS
      : lgStation.isUnderground ? TUNING.HOLD_UNDERGROUND_STATION_MS : TUNING.HOLD_STATION_MS;
    const ug = lgStation.isUnderground ? ' (underground station)' : lg.detection.context === 'train' ? ' (probably underground)' : '';
    // A direction flip made while GPS is out still applies to the held context.
    const dirNow = lg.detection.lineId === lineId
      ? { direction: dir.label, directionKey: dir.key, directionKnown, routeId: dir.routeId }
      : {};
    const lgDir = { ...lg.detection, ...dirNow };
    if (age <= ttl) {
      const decayed = lg.detection.confidence * (1 - 0.5 * (age / ttl));
      if (lgDir.context === 'train' && lgDir.directionKnown && age > 90_000) {
        const est = deadReckon(lgTopo, lg.detection.stationId, lgDir.directionKey, lgDir.routeId, age);
        const orient = est.nextId
          ? (lgDir.directionKey === 'towards_a'
              ? orientBetween(lgTopo, est.nextId, est.stationId, 1 - est.progress, 'towards_a')
              : orientBetween(lgTopo, est.stationId, est.nextId, est.progress, 'towards_b'))
          : { between: null, progress: null };
        const where = orient.between ? `probably between ${orient.between.fromStationName} and ${orient.between.toStationName}` : `probably at ${stationName(est.stationId)}`;
        const detection: Detection = {
          ...lgDir,
          stationId: est.stationId, movement: s.movement,
          confidence: round2(Math.min(0.5, decayed)), source: 'schedule',
          reason: `${why} for ${fmtMinutes(age)}${ug}. Estimating from typical train times: ${where}.`,
          between: orient.between, progress: orient.progress,
          distanceM: null, accuracyM: null, speedKmh: null, stickyUntil, held: true, stale: false, lastFixAt
        };
        return { state: s, detection };
      }
      const detection: Detection = {
        ...lgDir,
        movement: s.movement,
        confidence: round2(decayed), source: 'last_checkin',
        reason: `${why} for ${fmtMinutes(age)}${ug}. Showing where we last placed you: ${lgStation.name}.`,
        distanceM: null, accuracyM: null, speedKmh: null, stickyUntil, held: true, stale: false, lastFixAt
      };
      return { state: s, detection };
    }
    const detection: Detection = {
      ...lgDir,
      context: 'nearby', movement: s.movement,
      confidence: round2(Math.max(0.05, Math.min(0.25, lg.detection.confidence * 0.3))), source: 'last_checkin',
      reason: `${why} for ${fmtMinutes(age)}. Last seen near ${lgStation.name}. Tap to confirm where you are.`,
      between: null, progress: null, distanceM: null, accuracyM: null, speedKmh: null, stickyUntil, held: false, stale: true, lastFixAt
    };
    return { state: s, detection };
  }

  const detection: Detection = {
    ...base,
    context: 'nearby', confidence: 0.15, source: 'last_checkin',
    reason: `${why}. Last rough position was near ${station.name}. Tap to confirm where you are.`,
    between: null, progress: null, distanceM: null, held: false, stale: true
  };
  return { state: s, detection };
}

/** A station id (optionally with a line) → the station entry to use. */
function resolveStation(stationId: string, lineId?: string): { stationId: string; lineId: string } | null {
  const e = getStationEntry(stationId);
  if (!e) return null;
  if (!lineId || e.line.id === lineId) return { stationId: e.station.id, lineId: e.line.id };
  // Same interchange, other line (e.g. picked "Rajiv Chowk" + Yellow).
  const alt = hubStationIds(stationId).map(id => getStationEntry(id)).find(x => x && x.line.id === lineId);
  return alt ? { stationId: alt.station.id, lineId: alt.line.id } : { stationId: e.station.id, lineId: e.line.id };
}
