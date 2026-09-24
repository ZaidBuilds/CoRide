import type { MetroLine, MetroStation } from '../../types';

export interface LineSegment {
  /** Where this branch leaves the main line; undefined for the trunk. */
  branchFrom?: MetroStation;
  stations: MetroStation[];
}

function km(a: MetroStation, b: MetroStation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * metroData lists a line's stations as one array, with branches (e.g. the Blue
 * Line's Vaishali branch) appended after the trunk. Drawing that array as one
 * path joins the trunk's terminus to the branch's first stop. This splits it:
 * a station starts a branch when it is far from the previous entry but close to
 * an earlier one — that earlier station is the branch point.
 */
export function segmentLine(line: MetroLine): LineSegment[] {
  const segments: LineSegment[] = [];
  let current: LineSegment = { stations: [] };
  line.stations.forEach((st, i) => {
    if (i > 0) {
      const prev = line.stations[i - 1];
      const gap = km(prev, st);
      if (gap > 3) {
        let nearest: MetroStation | null = null;
        let nearestKm = Infinity;
        for (let j = 0; j < i - 1; j++) {
          const d = km(line.stations[j], st);
          if (d < nearestKm) { nearestKm = d; nearest = line.stations[j]; }
        }
        if (nearest && nearestKm < gap * 0.5) {
          segments.push(current);
          current = { branchFrom: nearest, stations: [] };
        }
      }
    }
    current.stations.push(st);
  });
  segments.push(current);
  return segments;
}

/** Polylines for the map: branches start at their branch point so the track is continuous. */
export function linePaths(line: MetroLine): [number, number][][] {
  return segmentLine(line).map(seg => {
    const pts = seg.branchFrom ? [seg.branchFrom, ...seg.stations] : seg.stations;
    return pts.map(s => [s.lat, s.lng] as [number, number]);
  });
}

/** Readable text colour on a line-colour background (yellow needs dark text). */
export function textOnLineColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // ~0.18 is where white and near-black give equal contrast.
  return lum > 0.18 ? '#111318' : '#FFFFFF';
}
