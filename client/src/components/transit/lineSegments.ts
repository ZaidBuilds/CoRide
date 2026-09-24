import type { MetroLine, MetroStation } from '../../types';
import { readableInk } from '../../utils/lineStyle';

export interface LineSegment {
  /** Where this branch leaves the main line; undefined for the trunk. */
  branchFrom?: MetroStation;
  stations: MetroStation[];
  /** Terminal this segment runs to (branch lines only). */
  terminal?: string;
}

/**
 * Branches that metroData lists as stations appended after the main line.
 * Mirrors server/src/services/location/topology.ts (BRANCHES): keep in sync.
 * `forkId` is the last shared station present in the data; `branchFirstId`
 * is the first branch station (everything after it in the array belongs to
 * the branch).
 */
const BRANCHES: Record<string, { forkId: string; branchFirstId: string; mainTerminal: string; branchTerminal: string }> = {
  blue: { forkId: 'yamuna_bank', branchFirstId: 'laxmi_nagar', mainTerminal: 'Noida Electronic City', branchTerminal: 'Vaishali' },
  // The real fork is Ashok Park Main, which metroData does not list; Punjabi
  // Bagh is the nearest shared station present.
  green: { forkId: 'punjabi_bagh', branchFirstId: 'kirti_nagar_g', mainTerminal: 'Inderlok', branchTerminal: 'Kirti Nagar' },
};

function km(a: MetroStation, b: MetroStation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function ordered(line: MetroLine): MetroStation[] {
  return [...line.stations].sort((a, b) => a.order - b.order);
}

/**
 * Splits a line into its trunk and branches. Known branches (BRANCHES) are
 * used as-is; otherwise a station starts a branch when it is far from the
 * previous entry but close to an earlier one (that earlier station is the
 * branch point), so a newly added branch still draws sensibly.
 */
export function segmentLine(line: MetroLine): LineSegment[] {
  const stations = ordered(line);
  const known = BRANCHES[line.id];
  if (known) {
    const forkIdx = stations.findIndex(s => s.id === known.forkId);
    const branchIdx = stations.findIndex(s => s.id === known.branchFirstId);
    if (forkIdx >= 0 && branchIdx > forkIdx) {
      return [
        { stations: stations.slice(0, branchIdx), terminal: known.mainTerminal },
        { branchFrom: stations[forkIdx], stations: stations.slice(branchIdx), terminal: known.branchTerminal },
      ];
    }
  }

  const segments: LineSegment[] = [];
  let current: LineSegment = { stations: [] };
  stations.forEach((st, i) => {
    if (i > 0) {
      const prev = stations[i - 1];
      const gap = km(prev, st);
      if (gap > 3) {
        let nearest: MetroStation | null = null;
        let nearestKm = Infinity;
        for (let j = 0; j < i - 1; j++) {
          const d = km(stations[j], st);
          if (d < nearestKm) { nearestKm = d; nearest = stations[j]; }
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

/** Readable text colour on a line-colour background. Prefer readableInk from utils/lineStyle. */
export function textOnLineColor(hex: string): string {
  return readableInk(hex);
}

/** Short line label for small pills: "Blue Line" → "Blue", "Airport Express (Orange)" → "Airport Express". */
export function shortLineName(line: MetroLine): string {
  return line.name.replace(/\s*\(.*\)/, '').replace(/ Line$/, '');
}

/** "Rajiv Chowk (Connaught Place)" → "Rajiv Chowk". For compact labels only. */
export function shortStationName(name: string): string {
  return name.split(' (')[0].trim();
}

/**
 * The two terminals a rider at `stationId` can be heading to. On a branched
 * line the B-end is named only when the station is past the fork; on the
 * shared trunk it stays "Noida Electronic City / Vaishali".
 */
export function terminalsAt(line: MetroLine, stationId?: string): { a: string; b: string } {
  const segs = segmentLine(line);
  if (segs.length > 1 && stationId) {
    const branchIdx = segs.findIndex((s, i) => i > 0 && s.stations.some(st => st.id === stationId));
    if (branchIdx > 0 && segs[branchIdx].terminal) return { a: line.terminalA, b: segs[branchIdx].terminal! };
    const main = segs[0];
    const fork = segs[1].branchFrom;
    const forkAt = fork ? main.stations.findIndex(s => s.id === fork.id) : -1;
    const at = main.stations.findIndex(s => s.id === stationId);
    if (forkAt >= 0 && at > forkAt && main.terminal) return { a: line.terminalA, b: main.terminal };
  }
  return { a: line.terminalA, b: line.terminalB };
}

// ── Route diagram layout ─────────────────────────────────────────────────────

/** One track column of a diagram row. */
export interface RailCell {
  /** A station node sits in this column. */
  node: boolean;
  /** Track runs from the row's top edge to its centre. */
  top: boolean;
  /** Track runs from the row's centre to its bottom edge. */
  bottom: boolean;
  /**
   * Branch track leaving column 0 at this row's centre ('fork', continues at
   * the bottom) or joining it ('merge', arrives from the top). Draw the curve
   * instead of straight bars for this cell.
   */
  curve?: 'fork' | 'merge';
}

export type RailGroup = 'trunk' | 'main' | 'branch';

export interface RailRow {
  station: MetroStation;
  /** Column the station's node is drawn in. */
  col: 0 | 1;
  group: RailGroup;
  cells: RailCell[];
  /** This station is where the line splits. */
  isFork: boolean;
}

export interface RailLayout {
  rows: RailRow[];
  columns: 1 | 2;
  /** Terminals of the two tails after the fork, for section labels. */
  mainTerminal?: string;
  branchTerminal?: string;
  fork?: MetroStation;
}

const none = (): RailCell => ({ node: false, top: false, bottom: false });

/**
 * Rows for a vertical route diagram in travel order. Towards terminal B the
 * trunk runs down column 0 to the fork, the main tail continues in column 0
 * and the branch runs in column 1 (its track passes alongside the main tail).
 * Towards terminal A the same rows are reversed and the fork becomes a merge.
 * Lines with more than one branch append extra branches as plain sections.
 */
export function railLayout(line: MetroLine, towardsA: boolean): RailLayout {
  const segs = segmentLine(line);
  const trunkSeg = segs[0];
  const branch = segs[1];
  const forkIdx = branch?.branchFrom ? trunkSeg.stations.findIndex(s => s.id === branch.branchFrom!.id) : -1;

  let rows: RailRow[];
  let columns: 1 | 2 = 1;

  if (!branch || forkIdx < 0 || forkIdx === trunkSeg.stations.length - 1) {
    // Simple line (or an unrecognised shape): every segment in one column.
    const all = segs.flatMap(s => s.stations);
    rows = all.map((station, i) => ({
      station, col: 0, group: 'trunk', isFork: false,
      cells: [{ node: true, top: i > 0, bottom: i < all.length - 1 }],
    }));
  } else {
    columns = 2;
    const trunk = trunkSeg.stations.slice(0, forkIdx + 1);
    const tail = trunkSeg.stations.slice(forkIdx + 1);
    const br = branch.stations;
    rows = [
      ...trunk.map((station, i): RailRow => {
        const isFork = i === trunk.length - 1;
        return {
          station, col: 0, group: 'trunk', isFork,
          cells: [
            { node: true, top: i > 0, bottom: true },
            // The branch leaves here: its track continues down column 1.
            isFork ? { node: false, top: false, bottom: true, curve: 'fork' } : none(),
          ],
        };
      }),
      ...tail.map((station, i): RailRow => ({
        station, col: 0, group: 'main', isFork: false,
        cells: [
          { node: true, top: true, bottom: i < tail.length - 1 },
          { node: false, top: true, bottom: true },
        ],
      })),
      ...br.map((station, i): RailRow => ({
        station, col: 1, group: 'branch', isFork: false,
        cells: [none(), { node: true, top: true, bottom: i < br.length - 1 }],
      })),
    ];
    // Any further branches (none today) as plain column-1 sections.
    for (const extra of segs.slice(2)) {
      extra.stations.forEach((station, i) => rows.push({
        station, col: 1, group: 'branch', isFork: false,
        cells: [none(), { node: true, top: i > 0, bottom: i < extra.stations.length - 1 }],
      }));
    }
  }

  if (towardsA) {
    rows = [...rows].reverse().map(r => ({
      ...r,
      cells: r.cells.map(c => ({
        node: c.node, top: c.bottom, bottom: c.top,
        curve: c.curve === 'fork' ? 'merge' : c.curve === 'merge' ? 'fork' : undefined,
      })),
    }));
  }

  return {
    rows,
    columns,
    mainTerminal: columns === 2 ? trunkSeg.terminal ?? shortStationName(trunkSeg.stations[trunkSeg.stations.length - 1].name) : undefined,
    branchTerminal: columns === 2 ? branch?.terminal ?? shortStationName(branch!.stations[branch!.stations.length - 1].name) : undefined,
    fork: columns === 2 ? trunkSeg.stations[forkIdx] : undefined,
  };
}
