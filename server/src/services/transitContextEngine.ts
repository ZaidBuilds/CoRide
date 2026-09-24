import { v4 as uuidv4 } from 'uuid';
import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import type { MetroLine, TrainScheduleInfo } from '../types';
import { ScheduleEngine, stickyTrainSlot, trainSlot } from './scheduleEngine';
import {
  ContextSource,
  Detection,
  DetectInput,
  EngineState,
  Fix,
  Movement,
  MovementHint,
  step
} from './location/detectionEngine';
import { DirectionKey, allStationEntries, getLineTopology, getStationEntry, indexFromTerminalA } from './location/topology';
import { haversineM } from './location/geo';

// ─── Input / Output Types ───

export interface ContextInput {
  userId: string;
  timestamp: number;
  lat?: number;
  lng?: number;
  /** Fix accuracy (68% radius, metres). */
  accuracyM?: number;
  /** When the device took the fix (ms). Defaults to `timestamp`. */
  fixTimestamp?: number;
  cellTowerId?: string;
  /** Activity-recognition hint. Measured speed wins over it. */
  movementState?: MovementHint;
  speedKmh?: number;
  headingDegrees?: number;
  userConfirmedDirection?: string;
  routeHistory?: { lat: number; lng: number; t: number }[];
  userConfirmed?: boolean; // optional "Yes I'm on this train" tap
  /** Explicit station pick (v2 clients). */
  override?: { stationId: string; lineId?: string; direction?: string };
  /** Confirm the current context as-is (v2 clients). */
  confirm?: boolean;
  /**
   * Engine state bucket. Defaults to userId. Legacy clients that fire one
   * "WALKING" and one "IN_VEHICLE" request per detect get a bucket each, so
   * the forced movement of one cannot corrupt the other.
   */
  stateKey?: string;
  /** Evaluate from scratch and keep no state (unauthenticated callers). */
  ephemeral?: boolean;
}

export interface ConfidenceBreakdown {
  stationMatch: number;   // 0–30
  routeMatch: number;     // 0–25
  movementMatch: number;  // 0–20
  scheduleMatch: number;  // 0–20
  userConfirm: number;    // 0 or 50
}

export interface ContextResult {
  id: string;
  station: string;       // station id
  stationName: string;
  line: string;          // line id
  lineName: string;
  lineColor: string;
  direction: string;
  context: 'station' | 'train' | 'nearby';
  confidence: number;    // 0–1 normalized
  rawScore: number;      // 0–145 raw (legacy; derived from confidence)
  trainId?: string;
  scheduleInfo?: TrainScheduleInfo;
  breakdown: ConfidenceBreakdown;
  /** Plain-language explanation of what we used and how sure we are. */
  reason: string;

  // ── v2 fields (additive) ──
  /** Which signal the context rests on. */
  source: ContextSource;
  movement: Movement;
  directionKey: DirectionKey;
  /** False when `direction` is only the line's default guess. */
  directionKnown: boolean;
  /** Set while riding between two stations. */
  between: Detection['between'];
  /** 0–1 from `between.from` to `between.to`. */
  progress: number | null;
  /** Manual pick stays in force until this time (ms), unless the rider moves away. */
  stickyUntil: number | null;
  distanceM: number | null;
  accuracyM: number | null;
  speedKmh: number | null;
  /** Position held from an earlier fix (no GPS now). */
  held: boolean;
  /** Held too long: only a last-seen hint. */
  stale: boolean;
  lastFixAt: number | null;
  engineVersion: 2;
}

const STATE_IDLE_MS = 60 * 60_000;

export class TransitContextEngine {
  private static instance: TransitContextEngine;
  private scheduleEngine = ScheduleEngine.getInstance();
  private states = new Map<string, EngineState>();
  private lastSweep = 0;

  private constructor() {}

  public static getInstance(): TransitContextEngine {
    if (!TransitContextEngine.instance) {
      TransitContextEngine.instance = new TransitContextEngine();
    }
    return TransitContextEngine.instance;
  }

  /** Evaluate a detection request for a user and return the context. */
  public evaluate(input: ContextInput): ContextResult {
    const now = input.timestamp || Date.now();
    this.sweep(now);
    const key = input.stateKey || input.userId;
    const lines = activeLines();
    const activeIds = new Set(lines.map(l => l.id));
    const lineFilter = activeIds.size === DELHI_METRO_LINES.length ? undefined : (id: string) => activeIds.has(id);

    const dInput: DetectInput = { now, movementHint: input.movementState, lineFilter };

    let fix: Fix | undefined;
    if (input.lat !== undefined && input.lng !== undefined && Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
      fix = {
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        speedMps: input.speedKmh !== undefined ? input.speedKmh / 3.6 : undefined,
        headingDeg: input.headingDegrees,
        t: input.fixTimestamp ?? now
      };
    }

    if (input.override) {
      dInput.override = input.override;
    } else if (input.userConfirmed && fix) {
      // Legacy manual pick: the client sends the picked station's own
      // coordinates (+ a cell id) with userConfirmed. Turn that into a pick.
      const picked = legacyPickedStation(fix, input.cellTowerId);
      if (picked) {
        dInput.override = { stationId: picked, direction: input.userConfirmedDirection };
        fix = undefined; // the coordinates are the station's, not the rider's
      } else {
        dInput.confirm = true;
      }
    } else if (input.userConfirmed || input.confirm) {
      dInput.confirm = true;
    }
    if (input.userConfirmedDirection && !dInput.override) {
      const lineId = this.states.get(key)?.manual?.lineId || this.states.get(key)?.lineId;
      if (lineId) dInput.directionOverride = { lineId, direction: input.userConfirmedDirection };
    }
    dInput.fix = fix;

    const { state, detection } = step(input.ephemeral ? undefined : this.states.get(key), dInput);

    // Cell tower only (no GPS, nothing known yet): a rough hint, never a claim.
    let det = detection;
    if (!det.stationId && input.cellTowerId) {
      const cell = allStationEntries().find(e => e.station.cellTowerId === input.cellTowerId && (!lineFilter || lineFilter(e.line.id)));
      if (cell) {
        det = {
          ...det,
          stationId: cell.station.id,
          lineId: cell.line.id,
          direction: `Towards ${cell.line.terminalB}`,
          confidence: 0.2,
          reason: `No GPS yet. A rough network hint points to ${cell.station.name}. Pick your station to be sure.`
        };
      }
    }

    const result = this.toResult(det, state, now, lines);
    if (!input.ephemeral) this.states.set(key, state);
    return result;
  }

  /** One-tap direction flip, applied to every state bucket of this user. */
  public overrideDirection(userId: string, lineId: string, direction: string, now = Date.now()): void {
    for (const [k, prev] of this.states.entries()) {
      if (k !== userId && !k.startsWith(`${userId}#`)) continue;
      this.states.set(k, step(prev, { now, directionOverride: { lineId, direction } }).state);
    }
    if (!this.states.has(userId)) this.states.set(userId, step(undefined, { now, directionOverride: { lineId, direction } }).state);
  }

  /** Drop a user's detection state (account deletion, sign-out). */
  public forget(userId: string): void {
    for (const k of Array.from(this.states.keys())) if (k === userId || k.startsWith(`${userId}#`)) this.states.delete(k);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 5 * 60_000) return;
    this.lastSweep = now;
    for (const [k, s] of this.states.entries()) if (now - s.updatedAt > STATE_IDLE_MS) this.states.delete(k);
  }

  private toResult(det: Detection, state: EngineState, now: number, lines: MetroLine[]): ContextResult {
    // Nothing known at all: a neutral placeholder the client must not present as a location.
    let stationId = det.stationId;
    let lineId = det.lineId;
    if (!stationId || !lineId) {
      const fallbackLine = (det.lineId && lines.find(l => l.id === det.lineId)) || lines.find(l => l.stations.some(s => s.id === 'rajiv_chowk')) || lines[0];
      const fallback = fallbackLine.stations.find(s => s.id === 'rajiv_chowk') || fallbackLine.stations[Math.floor(fallbackLine.stations.length / 2)];
      stationId = fallback.id;
      lineId = fallbackLine.id;
      det = { ...det, direction: det.direction || `Towards ${fallbackLine.terminalB}` };
    }
    const entry = getStationEntry(stationId)!;
    const line = entry.line;
    const topo = getLineTopology(line.id);

    // Stable train identity for the ride (see scheduleEngine.trainSlot).
    const idx = topo ? indexFromTerminalA(topo, stationId) : 0;
    const slot = stickyTrainSlot(state.train, line.id, det.directionKey, trainSlot(idx, det.directionKey, now));
    state.train = { lineId: line.id, key: det.directionKey, slot };
    const scheduleInfo = this.scheduleEngine.getScheduleForStation(line.id, stationId, det.direction, new Date(now), {
      directionKey: det.directionKey,
      routeId: det.routeId,
      slot
    });

    const confidence = Math.round(det.confidence * 100) / 100;
    return {
      id: uuidv4(),
      station: stationId,
      stationName: entry.station.name,
      line: line.id,
      lineName: line.name,
      lineColor: line.color,
      direction: det.direction,
      context: det.context,
      confidence,
      rawScore: Math.round(confidence * 145),
      trainId: scheduleInfo.trainId,
      scheduleInfo,
      breakdown: legacyBreakdown(det, this.scheduleEngine.getScheduleMatchScore(new Date(now))),
      reason: det.reason,
      source: det.source,
      movement: det.movement,
      directionKey: det.directionKey,
      directionKnown: det.directionKnown,
      between: det.between,
      progress: det.progress,
      stickyUntil: det.stickyUntil,
      distanceM: det.distanceM,
      accuracyM: det.accuracyM,
      speedKmh: det.speedKmh,
      held: det.held,
      stale: det.stale,
      lastFixAt: det.lastFixAt,
      engineVersion: 2
    };
  }
}

let activeCache: { env: string; lines: MetroLine[] } | null = null;
/** getActiveMetroLines() returns a new array per call when filtered; memoise by env. */
function activeLines(): MetroLine[] {
  const env = (process.env.BEACHHEAD_LINE || 'all').toLowerCase();
  if (!activeCache || activeCache.env !== env) {
    const l = getActiveMetroLines();
    activeCache = { env, lines: l.length ? l : DELHI_METRO_LINES };
  }
  return activeCache.lines;
}

/**
 * Older clients check in by sending the picked station's coordinates with
 * userConfirmed and a cell id (the real one, or `TOWER_DMRC_<STATION_ID>`).
 */
function legacyPickedStation(fix: Fix, cellTowerId?: string): string | null {
  const near = allStationEntries().filter(e => haversineM(fix.lat, fix.lng, e.station.lat, e.station.lng) <= 60);
  if (!near.length) return null;
  if (cellTowerId) {
    const byCell = near.find(e => e.station.cellTowerId === cellTowerId);
    if (byCell) return byCell.station.id;
    const m = /^TOWER_DMRC_(.+)$/.exec(cellTowerId);
    if (m) {
      const id = m[1].toLowerCase();
      if (getStationEntry(id)) return id;
    }
  }
  return near[0].station.id;
}

/** The legacy 0–145 breakdown, reconstructed from the new detection for old clients. */
function legacyBreakdown(det: Detection, scheduleMatch: number): ConfidenceBreakdown {
  const stationMatch = det.source === 'manual' ? 30
    : det.context === 'station' ? Math.round(18 + 12 * det.confidence)
    : det.context === 'train' ? 20 : Math.round(15 * det.confidence);
  return {
    stationMatch: Math.max(0, Math.min(30, stationMatch)),
    routeMatch: det.directionKnown ? 20 : 5,
    movementMatch: det.movement === 'in_vehicle' ? 20 : det.movement === 'walking' ? 10 : 5,
    scheduleMatch,
    userConfirm: det.source === 'manual' ? 50 : 0
  };
}
