// Client-side geometry for the location hook: just enough to decide *when* to
// ask the server (nearest station changed, movement changed). The server's
// engine makes the actual call on station, direction and confidence.
import { DELHI_METRO_LINES } from '../data/metroData';

const R = 6371008.8;
const RAD = Math.PI / 180;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dφ = (lat2 - lat1) * RAD;
  const dλ = (lng2 - lng1) * RAD;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ALL_STATIONS = DELHI_METRO_LINES.flatMap(l => l.stations);

/** Nearest station by straight-line distance (no catchment weighting). */
export function nearestStationId(lat: number, lng: number): { id: string; distanceM: number } | null {
  let best: { id: string; distanceM: number } | null = null;
  for (const s of ALL_STATIONS) {
    const d = haversineM(lat, lng, s.lat, s.lng);
    if (!best || d < best.distanceM) best = { id: s.id, distanceM: d };
  }
  return best;
}

export type LocalMovement = 'still' | 'walking' | 'in_vehicle';

/**
 * Rough movement from the device's reported speed, or from displacement
 * between two fixes (ignoring moves smaller than their combined accuracy).
 * Thresholds match the server engine.
 */
export function localMovement(
  prev: { lat: number; lng: number; acc: number; t: number } | null,
  cur: { lat: number; lng: number; acc: number; t: number; speed: number | null }
): { movement: LocalMovement; speedMps: number | null } {
  let v: number | null = cur.speed !== null && Number.isFinite(cur.speed) && cur.speed >= 0 ? cur.speed : null;
  if (v === null && prev) {
    const dt = (cur.t - prev.t) / 1000;
    if (dt >= 3 && dt <= 180) {
      const disp = haversineM(prev.lat, prev.lng, cur.lat, cur.lng);
      const noise = prev.acc + cur.acc;
      const est = disp <= noise ? 0 : (disp - noise / 2) / dt;
      if (est <= 40) v = est; // faster than any metro: a GPS jump, ignore
    }
  }
  if (v === null) return { movement: 'still', speedMps: null };
  return { movement: v >= 4.5 ? 'in_vehicle' : v >= 0.7 ? 'walking' : 'still', speedMps: v };
}
