import { DELHI_METRO_LINES, getActiveMetroLines } from '../data/metroData';
import { TrainScheduleInfo } from '../types';
import { DirectionKey, directionFromString, getLineTopology, indexFromTerminalA, nextStationId } from './location/topology';

/** Typical run + dwell between stations, and the dwell part of it. */
export const SECONDS_PER_STATION = 150;
export const DWELL_SECONDS = 25;
/** Train identity buckets. Fixed (not peak-dependent) so every rider computes the same bucket. */
export const HEADWAY_MS = 4 * 60_000;
const IST_OFFSET_MS = 330 * 60_000;

/**
 * Which train a rider is on, as a number that stays constant for the whole
 * ride. Going towards B we bucket the train's departure time from terminal A
 * (now − stations travelled × typical time); going towards A, its arrival time
 * at terminal A (now + stations left × typical time). Two riders on the same
 * physical train get the same slot even if they boarded at different stations,
 * and the slot does not change as the train moves. Station index is counted
 * from terminal A, identical on every branch, so crossing the fork keeps it.
 */
export function trainSlot(indexFromA: number, key: DirectionKey, nowMs: number): number {
  const offset = indexFromA * SECONDS_PER_STATION * 1000;
  return Math.floor((key === 'towards_b' ? nowMs - offset : nowMs + offset) / HEADWAY_MS);
}

/**
 * Keep the previous slot while it is within one headway of the new estimate.
 * Stops a rider hopping between train rooms because of bucket-edge jitter or
 * a slow run between stations.
 */
export function stickyTrainSlot(
  prev: { lineId: string; key: DirectionKey; slot: number } | undefined,
  lineId: string,
  key: DirectionKey,
  slot: number
): number {
  return prev && prev.lineId === lineId && prev.key === key && Math.abs(prev.slot - slot) <= 1 ? prev.slot : slot;
}

export function trainIdFor(lineId: string, key: DirectionKey, slot: number): string {
  return `train_${lineId}_${key === 'towards_b' ? 'fwd' : 'rev'}_${slot}`;
}

/** When the train in `slot` is (roughly) at the station `indexFromA` stations from terminal A. */
export function trainTimeAtStation(slot: number, indexFromA: number, key: DirectionKey): number {
  const offset = indexFromA * SECONDS_PER_STATION * 1000;
  const anchor = slot * HEADWAY_MS + HEADWAY_MS / 2;
  return key === 'towards_b' ? anchor + offset : anchor - offset;
}

/** "9:07 AM" in Delhi time, whatever the server's timezone. */
export function formatIst(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export class ScheduleEngine {
  private static instance: ScheduleEngine;

  private constructor() {}

  public static getInstance(): ScheduleEngine {
    if (!ScheduleEngine.instance) {
      ScheduleEngine.instance = new ScheduleEngine();
    }
    return ScheduleEngine.instance;
  }

  /** Returns minutes delta to nearest scheduled train (0 = right on schedule) */
  public getMinutesDeltaToNearestTrain(timeDate: Date = new Date()): number {
    const minutes = timeDate.getMinutes();
    const hours = timeDate.getHours();
    const minsSinceMidnight = hours * 60 + minutes;
    // Peak vs off-peak interval
    const isPeak = (hours >= 8 && hours <= 10) || (hours >= 17 && hours <= 20);
    const interval = isPeak ? 4 : 6; // 4 min peak, 6 min off-peak
    const offset = 3;
    // Find nearest departure slot
    // brute force: check nearest few intervals around current time
    let bestDelta = Infinity;
    for (let d = -2; d <= 2; d++) {
      const slot = Math.floor(minsSinceMidnight / interval) * interval + offset + d * interval;
      const delta = Math.abs(minsSinceMidnight - slot);
      if (delta < bestDelta) bestDelta = delta;
    }
    return bestDelta;
  }

  /** Returns confidence score 0-20 based on schedule proximity */
  public getScheduleMatchScore(timeDate: Date = new Date()): number {
    const delta = this.getMinutesDeltaToNearestTrain(timeDate);
    if (delta <= 2) return 20;
    if (delta <= 4) return 15;
    if (delta <= 7) return 8;
    return 3;
  }

  public getScheduleForStation(
    lineId: string,
    stationId: string,
    direction: string,
    timeDate: Date = new Date(),
    opts: { directionKey?: DirectionKey; routeId?: string; slot?: number } = {}
  ): TrainScheduleInfo {
    const activeLines = getActiveMetroLines().length ? getActiveMetroLines() : DELHI_METRO_LINES;
    const line = activeLines.find(l => l.id === lineId) || DELHI_METRO_LINES.find(l => l.id === lineId) || activeLines[0] || DELHI_METRO_LINES[0];
    const topo = getLineTopology(line.id);
    const station = line.stations.find(s => s.id === stationId) || line.stations[0];

    // Direction and next station come from the route topology, so a train
    // heading for Vaishali names Laxmi Nagar next, not Akshardham.
    const resolved = topo ? directionFromString(topo, direction) : null;
    const key: DirectionKey = opts.directionKey || resolved?.key || 'towards_b';
    const routeId = opts.routeId || resolved?.routeId;
    const nextId = topo ? nextStationId(topo, station.id, key, routeId) : undefined;
    const nextStation = (nextId && line.stations.find(s => s.id === nextId)) || station;

    const now = timeDate.getTime();
    const idx = topo ? indexFromTerminalA(topo, station.id) : 0;
    const slot = opts.slot ?? trainSlot(idx, key, now);
    const atStationMs = trainTimeAtStation(slot, idx, key);
    const departureTimeFormatted = formatIst(atStationMs);

    return {
      trainId: trainIdFor(line.id, key, slot),
      lineId: line.id,
      direction,
      departureTimeFormatted,
      trainLabel: `${departureTimeFormatted.replace(/ [AP]M$/, '')} Train`,
      currentStationName: station.name,
      nextStationName: nextStation.name,
      estimatedArrivalSeconds: SECONDS_PER_STATION - DWELL_SECONDS,
      dwellSeconds: DWELL_SECONDS
    };
  }
}
