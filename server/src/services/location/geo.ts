/**
 * Pure geodesy helpers for the location engine. No state, no I/O.
 *
 * Distances are metres, bearings degrees clockwise from true north.
 */

const EARTH_RADIUS_M = 6371008.8;
const RAD = Math.PI / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance (haversine). Accurate to well under a metre at city scale. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * RAD;
  const φ2 = lat2 * RAD;
  const Δφ = (lat2 - lat1) * RAD;
  const Δλ = (lng2 - lng1) * RAD;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceM(a: LatLng, b: LatLng): number {
  return haversineM(a.lat, a.lng, b.lat, b.lng);
}

/** Initial bearing from a to b, 0–360. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = a.lat * RAD;
  const φ2 = b.lat * RAD;
  const Δλ = (b.lng - a.lng) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** Smallest absolute difference between two bearings, 0–180. */
export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export interface SegmentProjection {
  /** Fraction along a→b of the closest point, clamped to 0..1. */
  t: number;
  /** Distance from p to the closest point on the segment. */
  crossTrackM: number;
  /** Segment length. */
  lengthM: number;
}

/**
 * Project p onto the segment a→b using a local equirectangular plane centred
 * on the segment. Metro segments are 0.5–6 km, so the flat-earth error is
 * negligible here, unlike for nearest-station ranking where we use haversine.
 */
export function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): SegmentProjection {
  const lat0 = ((a.lat + b.lat) / 2) * RAD;
  const kx = Math.cos(lat0) * EARTH_RADIUS_M * RAD;
  const ky = EARTH_RADIUS_M * RAD;
  const bx = (b.lng - a.lng) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lng - a.lng) * kx;
  const py = (p.lat - a.lat) * ky;
  const len2 = bx * bx + by * by;
  const lengthM = Math.sqrt(len2);
  let t = len2 > 0 ? (px * bx + py * by) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = bx * t - px;
  const cy = by * t - py;
  return { t, crossTrackM: Math.sqrt(cx * cx + cy * cy), lengthM };
}

/**
 * How much to trust a fix, 0–1, from its reported horizontal accuracy (the
 * radius of 68% confidence). Unknown accuracy is treated as mediocre.
 */
export function accuracyQuality(accuracyM: number | undefined): number {
  if (accuracyM === undefined || !Number.isFinite(accuracyM)) return 0.6;
  if (accuracyM <= 20) return 1;
  if (accuracyM <= 50) return 0.9;
  if (accuracyM <= 100) return 0.75;
  if (accuracyM <= 250) return 0.5;
  if (accuracyM <= 500) return 0.3;
  return 0.15;
}

/**
 * Likelihood (0–1) that a fix with the given accuracy was taken inside a
 * circle of `radiusM` around a point `distanceM` away. 1 when inside the
 * circle, then a Gaussian fall-off scaled by the fix's accuracy, so a noisy fix
 * 300 m out is still plausible while a sharp fix 300 m out is not.
 */
export function proximityLikelihood(distanceM: number, radiusM: number, accuracyM: number): number {
  const outside = Math.max(0, distanceM - radiusM);
  const sigma = Math.max(25, accuracyM);
  return Math.exp(-0.5 * (outside / sigma) ** 2);
}

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
