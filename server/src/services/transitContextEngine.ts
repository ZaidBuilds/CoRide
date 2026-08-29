import { v4 as uuidv4 } from 'uuid';
import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import type { MetroStation, MetroLine, TrainScheduleInfo } from '../types';
import { ScheduleEngine } from './scheduleEngine';

// ─── Input / Output Types ───

export interface ContextInput {
  userId: string;
  timestamp: number;
  lat?: number;
  lng?: number;
  cellTowerId?: string;
  movementState: 'STILL' | 'WALKING' | 'IN_VEHICLE';
  speedKmh?: number;
  routeHistory?: { lat: number; lng: number; t: number }[];
  userConfirmed?: boolean; // optional "Yes I'm on this train" tap
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
  rawScore: number;      // 0–145 raw
  trainId?: string;
  scheduleInfo?: TrainScheduleInfo;
  breakdown: ConfidenceBreakdown;
  reason: string;
}

export class TransitContextEngine {
  private static instance: TransitContextEngine;
  private scheduleEngine = ScheduleEngine.getInstance();

  private constructor() {}

  public static getInstance(): TransitContextEngine {
    if (!TransitContextEngine.instance) {
      TransitContextEngine.instance = new TransitContextEngine();
    }
    return TransitContextEngine.instance;
  }

  /**
   * Core method: evaluates raw sensor signals → returns context assignment
   * with weighted confidence score.
   */
  public evaluate(input: ContextInput): ContextResult {
    const breakdown: ConfidenceBreakdown = {
      stationMatch: 0,
      routeMatch: 0,
      movementMatch: 0,
      scheduleMatch: 0,
      userConfirm: 0
    };

    // ── Signal A: Station location match (+30) ──
    const activeLines = getActiveMetroLines().length ? getActiveMetroLines() : DELHI_METRO_LINES;
    let matchedStation: MetroStation | null = null;
    let matchedLine: MetroLine = activeLines[0];
    let stationDistanceM = Infinity;

    // Try cell tower first
    if (input.cellTowerId) {
      for (const line of activeLines) {
        const found = line.stations.find(s => s.cellTowerId === input.cellTowerId);
        if (found) {
          matchedStation = found;
          matchedLine = line;
          stationDistanceM = 50; // cell tower implies close proximity
          break;
        }
      }
    }

    // Fall back to lat/lng nearest-station match
    if (!matchedStation && input.lat !== undefined && input.lng !== undefined) {
      let minDist = Infinity;
      for (const line of activeLines) {
        for (const st of line.stations) {
          const d = this.haversine(input.lat, input.lng, st.lat, st.lng);
          if (d < minDist) {
            minDist = d;
            matchedStation = st;
            matchedLine = line;
            stationDistanceM = d;
          }
        }
      }
    }

    // Default fallback
    if (!matchedStation) {
      matchedStation = activeLines[0].stations[Math.floor(activeLines[0].stations.length / 2)] || DELHI_METRO_LINES[0].stations[6];
      matchedLine = activeLines[0];
      stationDistanceM = 200;
    }

    // Score station proximity: fused — cellTower + lat/lng agreement boosts
    // MVP2: fused bonus if both signals agree on same station
    let fusedBonus = 0;
    if (input.cellTowerId && input.lat !== undefined && input.lng !== undefined && matchedStation) {
      // verify lat/lng nearest also points to same station within 200m
      let nearestViaGps: MetroStation | null = null;
      let dMin = Infinity;
      for (const line of activeLines) {
        for (const st of line.stations) {
          const d = this.haversine(input.lat, input.lng, st.lat, st.lng);
          if (d < dMin) { dMin = d; nearestViaGps = st; }
        }
      }
      if (nearestViaGps && nearestViaGps.id === matchedStation.id && dMin <= 250) fusedBonus = 5;
    }
    // Score station proximity: ≤100m = 30pts, ≤300m = 25pts, ≤500m = 15pts, ≤1000m = 8, ≤2000m=5
    if (stationDistanceM <= 100) breakdown.stationMatch = Math.min(30, 30 + fusedBonus);
    else if (stationDistanceM <= 300) breakdown.stationMatch = Math.min(30, 25 + fusedBonus);
    else if (stationDistanceM <= 500) breakdown.stationMatch = 15 + Math.min(5, fusedBonus);
    else if (stationDistanceM <= 1000) breakdown.stationMatch = 8;
    else if (stationDistanceM <= 2000) breakdown.stationMatch = 3;
    else breakdown.stationMatch = 0;
    // clamp 0-30
    breakdown.stationMatch = Math.max(0, Math.min(30, breakdown.stationMatch));

    // ── Signal B: Movement pattern (+20) — MVP2: consistency check with speed ──
    const speed = input.speedKmh ?? 0;
    if (input.movementState === 'IN_VEHICLE') {
      if (speed >= 15) breakdown.movementMatch = 20;
      else if (speed >= 8) breakdown.movementMatch = 15;
      else if (speed > 0) breakdown.movementMatch = 8; // IN_VEHICLE claimed but crawling — likely station
      else breakdown.movementMatch = 12; // no speed data — assume vehicle
    } else if (input.movementState === 'WALKING') {
      if (speed >= 12) breakdown.movementMatch = 5; // WALKING but metro speed — inconsistent
      else breakdown.movementMatch = 10;
    } else { // STILL
      if (speed >= 12) breakdown.movementMatch = 4; // STILL but moving fast — inconsistent
      else breakdown.movementMatch = 5;
    }

    // ── Signal C: Route geometry match (+25) — MVP2: direction-aware ──
    if (input.routeHistory && input.routeHistory.length >= 2) {
      const routeScore = this.scoreRouteGeometry(input.routeHistory, matchedLine);
      // direction consistency bonus/penalty if we can infer direction
      const inferredDir = this.inferDirectionFromHistory(input.routeHistory, matchedLine);
      let dirScore = routeScore;
      if (inferredDir) dirScore = Math.min(25, routeScore + 3);
      breakdown.routeMatch = dirScore;
    } else if (input.movementState === 'IN_VEHICLE' && speed > 15) {
      breakdown.routeMatch = 15;
    } else if (input.movementState === 'IN_VEHICLE' && speed >= 8) {
      breakdown.routeMatch = 8;
    }

    // ── Signal D+E: Schedule window match (+20) — real window check + direction inference ──
    const inferred = input.routeHistory && input.routeHistory.length >= 2
      ? this.inferDirectionFromHistory(input.routeHistory, matchedLine)
      : null;
    const direction = inferred || `Towards ${matchedLine.terminalB}`;
    const nowDate = input.timestamp ? new Date(input.timestamp) : new Date();
    const scheduleInfo = this.scheduleEngine.getScheduleForStation(
      matchedLine.id, matchedStation.id, direction, nowDate
    );
    breakdown.scheduleMatch = this.scheduleEngine.getScheduleMatchScore(nowDate);
    // MVP2: stale signal decay — if routeHistory last point is >2min old, dampen schedule+route
    if (input.routeHistory && input.routeHistory.length) {
      const lastT = input.routeHistory[input.routeHistory.length - 1].t;
      const ageMs = nowDate.getTime() - lastT;
      if (ageMs > 120_000) {
        breakdown.scheduleMatch = Math.max(3, breakdown.scheduleMatch - 5);
        breakdown.routeMatch = Math.max(0, breakdown.routeMatch - 5);
      }
    }
    // Overall timestamp staleness
    const ageMsTotal = Date.now() - input.timestamp;
    let timeDecay = 1;
    if (ageMsTotal > 180_000) timeDecay = 0.92;
    if (ageMsTotal > 600_000) timeDecay = 0.80;

    // ── Signal F: User confirmation (+50) ──
    if (input.userConfirmed) {
      breakdown.userConfirm = 50;
    }

    // ── Compute total — apply time decay ──
    const rawScore = breakdown.stationMatch + breakdown.routeMatch +
      breakdown.movementMatch + breakdown.scheduleMatch + breakdown.userConfirm;
    const decayedRaw = Math.round(rawScore * timeDecay);
    const confidence = Math.min(decayedRaw / 145, 1.0);

    // ── Determine context tier — MVP2: nearby as distinct low-confidence bucket ──
    let context: 'station' | 'train' | 'nearby';
    if (input.movementState === 'IN_VEHICLE' && confidence >= 0.5 && breakdown.stationMatch >= 8) {
      context = 'train';
    } else if (breakdown.stationMatch >= 18 && confidence >= 0.35) {
      context = 'station';
    } else {
      context = 'nearby';
    }

    const reason = this.buildReasonString(context, matchedStation, matchedLine, breakdown, confidence);

    return {
      id: uuidv4(),
      station: matchedStation.id,
      stationName: matchedStation.name,
      line: matchedLine.id,
      lineName: matchedLine.name,
      lineColor: matchedLine.color,
      direction,
      context,
      confidence: Math.round(confidence * 100) / 100,
      rawScore: decayedRaw,
      trainId: scheduleInfo.trainId,
      scheduleInfo,
      breakdown,
      reason
    };
  }

  private inferDirectionFromHistory(
    history: { lat: number; lng: number; t: number }[],
    line: MetroLine
  ): string | null {
    if (history.length < 2) return null;
    const indices: number[] = [];
    for (const p of history) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < line.stations.length; i++) {
        const d = this.haversine(p.lat, p.lng, line.stations[i].lat, line.stations[i].lng);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (bestD <= 800) indices.push(best);
    }
    if (indices.length < 2) return null;
    const first = indices[0], last = indices[indices.length - 1];
    if (last > first) return `Towards ${line.terminalB}`;
    if (last < first) return `Towards ${line.terminalA}`;
    return null;
  }

  private scoreRouteGeometry(
    history: { lat: number; lng: number; t: number }[],
    line: MetroLine
  ): number {
    // Check if route history follows known metro line station sequence
    let matchCount = 0;
    for (const point of history) {
      for (const st of line.stations) {
        const d = this.haversine(point.lat, point.lng, st.lat, st.lng);
        if (d < 500) {
          matchCount++;
          break;
        }
      }
    }
    const ratio = matchCount / history.length;
    // movement monotonic bonus: if points move sequentially along line, boost
    let seqBonus = 0;
    if (history.length >= 3) {
      const inferred = this.inferDirectionFromHistory(history, line);
      if (inferred) seqBonus = 3;
    }
    return Math.min(25, Math.round(ratio * 22) + seqBonus);
  }

  private buildReasonString(
    context: string,
    station: MetroStation,
    line: MetroLine,
    breakdown: ConfidenceBreakdown,
    confidence: number
  ): string {
    const parts: string[] = [];
    if (breakdown.stationMatch >= 20) parts.push(`Near ${station.name} (cell tower fix)`);
    if (breakdown.movementMatch >= 15) parts.push('IN_VEHICLE motion detected');
    if (breakdown.routeMatch >= 15) parts.push('Route follows metro geometry');
    if (breakdown.scheduleMatch >= 15) parts.push('Within train schedule window');
    if (breakdown.userConfirm > 0) parts.push('User confirmed');
    return `${context.toUpperCase()}: ${parts.join(' + ')} → ${Math.round(confidence * 100)}% confidence`;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
