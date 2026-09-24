/**
 * Network topology derived from metroData: ordered routes per line (so the
 * Blue Line's Vaishali branch and the Green Line's Kirti Nagar branch are real
 * branches rather than stations appended after the terminal), track segments,
 * interchange hubs and station catchment radii.
 *
 * metroData keeps its flat `stations[]` shape (the client depends on it); the
 * branch structure lives here.
 */
import { DELHI_METRO_LINES } from '../../data/metroData';
import type { MetroLine, MetroStation } from '../../types';
import { bearingDeg, angleDiffDeg, distanceM, projectOnSegment, LatLng } from './geo';

export type DirectionKey = 'towards_a' | 'towards_b';

export interface Route {
  id: string;
  lineId: string;
  /** Station ids from terminal A outwards. */
  stationIds: string[];
  /** Human name of this route's B-end terminal. */
  terminalName: string;
}

export interface Segment {
  /** Earlier station in route order (towards terminal A). */
  aId: string;
  /** Later station in route order (towards the B-end). */
  bId: string;
}

export interface LineTopology {
  line: MetroLine;
  routes: Route[];
  segments: Segment[];
  stations: Map<string, MetroStation>;
  /** Mean distance between consecutive stations on this line. */
  meanSpacingM: number;
}

export interface StationEntry {
  station: MetroStation;
  line: MetroLine;
}

/**
 * Branch definitions. `forkId` is the last shared station present in the data;
 * `branchFirstId` is the first station of the branch as listed in metroData
 * (every station after it in the array belongs to the branch).
 */
const BRANCHES: Record<string, { forkId: string; branchFirstId: string; mainTerminal: string; branchTerminal: string }> = {
  blue: { forkId: 'yamuna_bank', branchFirstId: 'laxmi_nagar', mainTerminal: 'Noida Electronic City', branchTerminal: 'Vaishali' },
  // The real fork is Ashok Park Main, which metroData does not list; Punjabi
  // Bagh is the nearest shared station present.
  green: { forkId: 'punjabi_bagh', branchFirstId: 'kirti_nagar_g', mainTerminal: 'Inderlok', branchTerminal: 'Kirti Nagar' }
};

function buildLine(line: MetroLine): LineTopology {
  const ordered = [...line.stations].sort((a, b) => a.order - b.order);
  const ids = ordered.map(s => s.id);
  const stations = new Map(ordered.map(s => [s.id, s] as const));
  const branch = BRANCHES[line.id];
  let routes: Route[];
  const forkIdx = branch ? ids.indexOf(branch.forkId) : -1;
  const branchIdx = branch ? ids.indexOf(branch.branchFirstId) : -1;
  if (branch && forkIdx >= 0 && branchIdx > forkIdx) {
    routes = [
      { id: `${line.id}:main`, lineId: line.id, stationIds: ids.slice(0, branchIdx), terminalName: branch.mainTerminal },
      { id: `${line.id}:branch`, lineId: line.id, stationIds: [...ids.slice(0, forkIdx + 1), ...ids.slice(branchIdx)], terminalName: branch.branchTerminal }
    ];
  } else {
    routes = [{ id: `${line.id}:main`, lineId: line.id, stationIds: ids, terminalName: line.terminalB }];
  }
  const seen = new Set<string>();
  const segments: Segment[] = [];
  let total = 0;
  for (const r of routes) {
    for (let i = 1; i < r.stationIds.length; i++) {
      const key = `${r.stationIds[i - 1]}>${r.stationIds[i]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({ aId: r.stationIds[i - 1], bId: r.stationIds[i] });
      total += distanceM(stations.get(r.stationIds[i - 1])!, stations.get(r.stationIds[i])!);
    }
  }
  return { line, routes, segments, stations, meanSpacingM: segments.length ? total / segments.length : 1200 };
}

// ── Caches (metroData is static; rebuilt only if a different lines array is passed) ──
let cachedFor: MetroLine[] | null = null;
let topoByLine = new Map<string, LineTopology>();
let entries: StationEntry[] = [];
let entryById = new Map<string, StationEntry>();
let hubOf = new Map<string, string>();
let hubMembers = new Map<string, string[]>();

/** Same physical station on different lines: within this distance of each other. */
const HUB_RADIUS_M = 350;

function ensure(lines: MetroLine[] = DELHI_METRO_LINES): void {
  if (cachedFor === lines) return;
  cachedFor = lines;
  topoByLine = new Map(lines.map(l => [l.id, buildLine(l)] as const));
  entries = lines.flatMap(line => line.stations.map(station => ({ station, line })));
  entryById = new Map(entries.map(e => [e.station.id, e] as const));
  hubOf = new Map();
  hubMembers = new Map();
  // Group interchange stations that sit at the same place on different lines.
  for (const e of entries) {
    if (hubOf.has(e.station.id)) continue;
    const hub = e.station.id;
    const members = [hub];
    hubOf.set(hub, hub);
    if (e.station.isInterchange) {
      for (const o of entries) {
        if (hubOf.has(o.station.id) || o.line.id === e.line.id || !o.station.isInterchange) continue;
        if (distanceM(e.station, o.station) <= HUB_RADIUS_M) {
          hubOf.set(o.station.id, hub);
          members.push(o.station.id);
        }
      }
    }
    hubMembers.set(hub, members);
  }
}

export function getLineTopology(lineId: string, lines?: MetroLine[]): LineTopology | undefined {
  ensure(lines);
  return topoByLine.get(lineId);
}

export function allStationEntries(lines?: MetroLine[]): StationEntry[] {
  ensure(lines);
  return entries;
}

export function getStationEntry(stationId: string, lines?: MetroLine[]): StationEntry | undefined {
  ensure(lines);
  return entryById.get(stationId);
}

/** Station ids (one per line) that are the same physical interchange as this one. */
export function hubStationIds(stationId: string, lines?: MetroLine[]): string[] {
  ensure(lines);
  const hub = hubOf.get(stationId);
  return hub ? hubMembers.get(hub) || [stationId] : [stationId];
}

/**
 * Catchment radius: how far from the station's reference point a rider can be
 * while still "at" the station (entrances, concourse, platforms). Large
 * interchanges sprawl; a three-line hub like Kashmere Gate spans ~300 m.
 */
export function catchmentRadiusM(stationId: string, lines?: MetroLine[]): number {
  const e = getStationEntry(stationId, lines);
  if (!e) return 175;
  const hubLines = hubStationIds(stationId, lines).length;
  const declared = 1 + (e.station.interchangeLines?.length || 0);
  const n = Math.max(hubLines, e.station.isInterchange ? declared : 1);
  if (n >= 3) return 350;
  if (n === 2) return 275;
  return 175;
}

export function routesContaining(topo: LineTopology, stationId: string): Route[] {
  return topo.routes.filter(r => r.stationIds.includes(stationId));
}

/** True when the station lies on every route of the line (before the fork). */
export function isTrunkStation(topo: LineTopology, stationId: string): boolean {
  return topo.routes.every(r => r.stationIds.includes(stationId));
}

export interface ResolvedDirection {
  key: DirectionKey;
  label: string;
  /** Route id when the branch is known; undefined on the trunk heading to the fork. */
  routeId?: string;
}

/** Human label for a direction, naming the branch only when it is known. */
export function directionLabel(topo: LineTopology, key: DirectionKey, atStationId?: string, routeId?: string): ResolvedDirection {
  if (key === 'towards_a') return { key, label: `Towards ${topo.line.terminalA}` };
  if (routeId) {
    const r = topo.routes.find(x => x.id === routeId);
    if (r) return { key, label: `Towards ${r.terminalName}`, routeId };
  }
  if (atStationId && topo.routes.length > 1 && !isTrunkStation(topo, atStationId)) {
    const r = routesContaining(topo, atStationId)[0];
    if (r) return { key, label: `Towards ${r.terminalName}`, routeId: r.id };
  }
  if (topo.routes.length === 1) return { key, label: `Towards ${topo.line.terminalB}`, routeId: topo.routes[0].id };
  // On the trunk heading for the fork: we cannot know which branch yet.
  return { key, label: `Towards ${topo.line.terminalB}` };
}

/**
 * Direction from an ordered list of distinct stations visited on one line
 * (oldest first). Uses the most recent pair that shares a route and is close
 * together in route order (|Δ| ≤ 3, so one GPS glitch across the city is
 * ignored). Returns null when the sequence says nothing.
 */
export function directionFromSequence(topo: LineTopology, visited: string[]): ResolvedDirection | null {
  for (let i = visited.length - 1; i >= 1; i--) {
    const to = visited[i];
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
      const from = visited[j];
      if (from === to) continue;
      const shared = topo.routes.filter(r => r.stationIds.includes(from) && r.stationIds.includes(to));
      if (!shared.length) continue;
      const r = shared[0];
      const delta = r.stationIds.indexOf(to) - r.stationIds.indexOf(from);
      if (delta === 0 || Math.abs(delta) > 3) continue;
      if (delta < 0) return directionLabel(topo, 'towards_a', to);
      const routeId = shared.length === 1 ? r.id : undefined;
      return directionLabel(topo, 'towards_b', to, routeId);
    }
  }
  return null;
}

/**
 * Direction from the device's course over ground while moving. Compares it to
 * the bearing of the track towards the next and previous station on every
 * route through this station. Needs ≤ 40° agreement.
 */
export function directionFromHeading(topo: LineTopology, stationId: string, headingDeg: number): ResolvedDirection | null {
  const here = topo.stations.get(stationId);
  if (!here) return null;
  let best: { diff: number; key: DirectionKey; routeId?: string } | null = null;
  const routes = routesContaining(topo, stationId);
  for (const r of routes) {
    const i = r.stationIds.indexOf(stationId);
    const next = r.stationIds[i + 1];
    const prev = r.stationIds[i - 1];
    if (next) {
      const d = angleDiffDeg(headingDeg, bearingDeg(here, topo.stations.get(next)!));
      if (!best || d < best.diff) best = { diff: d, key: 'towards_b', routeId: routes.length > 1 && !isTrunkStation(topo, next) ? r.id : undefined };
    }
    if (prev) {
      const d = angleDiffDeg(headingDeg, bearingDeg(here, topo.stations.get(prev)!));
      if (!best || d < best.diff) best = { diff: d, key: 'towards_a' };
    }
  }
  if (!best || best.diff > 40) return null;
  return directionLabel(topo, best.key, stationId, best.routeId);
}

/** Parse a "Towards X" string (from a picker or an older client) into a direction. */
export function directionFromString(topo: LineTopology, text: string): ResolvedDirection {
  const t = text.toLowerCase().replace(/^towards\s+/, '').trim();
  const a = topo.line.terminalA.toLowerCase();
  if (t && (a.includes(t) || t.includes(a))) return directionLabel(topo, 'towards_a');
  for (const r of topo.routes) {
    const n = r.terminalName.toLowerCase();
    if (topo.routes.length > 1 && t && (t === n || (t.includes(n) && !t.includes('/')))) {
      return directionLabel(topo, 'towards_b', undefined, r.id);
    }
  }
  return directionLabel(topo, 'towards_b');
}

export interface LinePosition {
  segment: Segment;
  /** Fraction from segment.aId to segment.bId. */
  t: number;
  crossTrackM: number;
}

/** Closest track segment on a line to a point. */
export function locateOnLine(topo: LineTopology, p: LatLng): LinePosition | null {
  let best: LinePosition | null = null;
  for (const seg of topo.segments) {
    const a = topo.stations.get(seg.aId)!;
    const b = topo.stations.get(seg.bId)!;
    const proj = projectOnSegment(p, a, b);
    if (!best || proj.crossTrackM < best.crossTrackM) best = { segment: seg, t: proj.t, crossTrackM: proj.crossTrackM };
  }
  return best;
}

/** Stations strictly between two stations on a shared route, in travel order (for visit bookkeeping). */
export function stationsBetween(topo: LineTopology, fromId: string, toId: string): string[] {
  const r = topo.routes.find(x => x.stationIds.includes(fromId) && x.stationIds.includes(toId));
  if (!r) return [];
  const i = r.stationIds.indexOf(fromId);
  const j = r.stationIds.indexOf(toId);
  if (Math.abs(j - i) <= 1) return [];
  return i < j ? r.stationIds.slice(i + 1, j) : r.stationIds.slice(j + 1, i).reverse();
}

/**
 * The next station after `stationId` in a direction. On the trunk towards the
 * fork with the branch unknown this returns the main route's next station
 * (both routes share it until the fork itself).
 */
export function nextStationId(topo: LineTopology, stationId: string, key: DirectionKey, routeId?: string): string | undefined {
  const candidates = routeId ? topo.routes.filter(r => r.id === routeId) : routesContaining(topo, stationId);
  const r = candidates.find(x => x.stationIds.includes(stationId)) || routesContaining(topo, stationId)[0];
  if (!r) return undefined;
  const i = r.stationIds.indexOf(stationId);
  return key === 'towards_b' ? r.stationIds[i + 1] : r.stationIds[i - 1];
}

/**
 * Stations from terminal A (0 = terminal A). Branch routes share the trunk as a
 * prefix, so this is the same number on every route through the station, which
 * keeps train identity stable when a rider crosses the fork.
 */
export function indexFromTerminalA(topo: LineTopology, stationId: string): number {
  const r = routesContaining(topo, stationId)[0];
  return r ? Math.max(0, r.stationIds.indexOf(stationId)) : 0;
}
