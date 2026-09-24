/**
 * Unit tests for the pure location engine (no server, no clock).
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELHI_METRO_LINES } from '../../data/metroData';
import { haversineM } from './geo';
import { catchmentRadiusM, getLineTopology, hubStationIds, indexFromTerminalA } from './topology';
import { EngineState, Fix, TUNING, classifyMovement, nearestStation, step, DetectInput } from './detectionEngine';
import { stickyTrainSlot, trainSlot } from '../scheduleEngine';

const T0 = Date.UTC(2026, 8, 24, 3, 30); // 09:00 IST

function st(id: string) {
  for (const l of DELHI_METRO_LINES) {
    const s = l.stations.find(x => x.id === id);
    if (s) return s;
  }
  throw new Error(`no station ${id}`);
}

/** Point `metres` from a station along a bearing (small-distance approximation). */
function offset(id: string, metres: number, bearingDeg: number): { lat: number; lng: number } {
  const s = st(id);
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (metres * Math.cos(b)) / 111_320;
  const dLng = (metres * Math.sin(b)) / (111_320 * Math.cos((s.lat * Math.PI) / 180));
  return { lat: s.lat + dLat, lng: s.lng + dLng };
}

function at(id: string, t: number, extra: Partial<Fix> = {}): Fix {
  const s = st(id);
  return { lat: s.lat, lng: s.lng, accuracyM: 20, t, ...extra };
}

/** Run a sequence of inputs through the engine, returning every detection. */
function run(inputs: DetectInput[], start?: EngineState) {
  let state = start;
  const out = [];
  for (const i of inputs) {
    const r = step(state, i);
    state = r.state;
    out.push(r.detection);
  }
  return { state: state!, detections: out, last: out[out.length - 1] };
}

/** Ride a train through the given stations, one fix per station, 2 min apart, at ~43 km/h. */
function ride(ids: string[], t0 = T0) {
  return ids.map((id, i) => ({ now: t0 + i * 120_000, fix: at(id, t0 + i * 120_000, { speedMps: 12 }) }));
}

// ─── Geometry & data ───────────────────────────────────────────────────────

test('haversine: Rajiv Chowk → Barakhamba Road is ~0.6 km', () => {
  const d = haversineM(st('rajiv_chowk').lat, st('rajiv_chowk').lng, st('barakhamba_road').lat, st('barakhamba_road').lng);
  assert.ok(d > 450 && d < 800, `got ${d}`);
});

test('station data: consecutive stations on each route are distinct and not absurdly far apart', () => {
  for (const line of DELHI_METRO_LINES) {
    const topo = getLineTopology(line.id)!;
    for (const seg of topo.segments) {
      const a = topo.stations.get(seg.aId)!;
      const b = topo.stations.get(seg.bId)!;
      const d = haversineM(a.lat, a.lng, b.lat, b.lng);
      // metroData lists a subset of stations, so gaps can span several real
      // stops; anything under 300 m or over 17 km is a data error.
      assert.ok(d > 300 && d < 17_000, `${line.id}: ${a.id} → ${b.id} is ${Math.round(d)} m`);
    }
  }
});

test('topology: Blue and Green lines have two routes that share a trunk', () => {
  const blue = getLineTopology('blue')!;
  assert.equal(blue.routes.length, 2);
  const branch = blue.routes.find(r => r.terminalName === 'Vaishali')!;
  assert.deepEqual(branch.stationIds.slice(branch.stationIds.indexOf('yamuna_bank'), branch.stationIds.indexOf('yamuna_bank') + 2), ['yamuna_bank', 'laxmi_nagar']);
  assert.ok(!blue.segments.some(s => s.aId === 'noida_electronic_city' && s.bId === 'laxmi_nagar'), 'no fake track from Electronic City to Laxmi Nagar');
  const green = getLineTopology('green')!;
  assert.equal(green.routes.length, 2);
  assert.ok(!green.segments.some(s => s.aId === 'inderlok_g' && s.bId === 'kirti_nagar_g'));
});

test('catchment: three-line hubs are larger than plain stations', () => {
  assert.equal(catchmentRadiusM('kashmere_gate'), 350);
  assert.ok(catchmentRadiusM('rajiv_chowk') >= 275);
  assert.equal(catchmentRadiusM('karol_bagh'), 175);
  assert.ok(hubStationIds('rajiv_chowk').includes('rajiv_chowk_y'));
});

// ─── Nearest station ───────────────────────────────────────────────────────

test('nearest station with a noisy fix: 150 m off Karol Bagh at ±120 m still resolves to Karol Bagh', () => {
  const p = offset('karol_bagh', 150, 200);
  const c = nearestStation(p, 120);
  assert.equal(c?.stationId, 'karol_bagh');
  const r = step(undefined, { now: T0, fix: { ...p, accuracyM: 120, t: T0 } });
  assert.equal(r.detection.stationId, 'karol_bagh');
  assert.equal(r.detection.context, 'station');
  assert.equal(r.detection.source, 'gps');
  assert.ok(r.detection.confidence < 0.85, 'a ±120 m fix is not near-certain');
});

test('a fix far from any station is "nearby" with low confidence, never "station"', () => {
  const p = offset('karol_bagh', 900, 0);
  const r = step(undefined, { now: T0, fix: { ...p, accuracyM: 30, t: T0 } });
  assert.equal(r.detection.context, 'nearby');
  assert.ok(r.detection.confidence <= 0.45);
  assert.match(r.detection.reason, /away/);
});

test('a hopeless fix (±2 km) is ignored, and we say we do not know', () => {
  const r = step(undefined, { now: T0, fix: { ...at('karol_bagh', T0), accuracyM: 2000 } });
  assert.equal(r.detection.stationId, null);
  assert.equal(r.detection.source, 'none');
  assert.match(r.detection.reason, /too weak/);
});

test('interchange: at Rajiv Chowk we stay on the line we arrived on', () => {
  const { last } = run([
    ...ride(['patel_chowk']).map(i => ({ ...i, override: { stationId: 'patel_chowk' } })),
  ]);
  assert.equal(last.lineId, 'yellow');
  const s0 = step(undefined, { now: T0, fix: at('patel_chowk', T0) }).state;
  const r = step(s0, { now: T0 + 60_000, fix: at('rajiv_chowk', T0 + 60_000, { accuracyM: 15 }) });
  assert.equal(r.detection.stationId, 'rajiv_chowk_y');
  assert.equal(r.detection.lineId, 'yellow');
});

// ─── Hysteresis ────────────────────────────────────────────────────────────

test('hysteresis: one fix near the next station does not switch; two consecutive do', () => {
  const s0 = step(undefined, { now: T0, fix: at('rajiv_chowk', T0) }).state;
  assert.equal(s0.stationId, 'rajiv_chowk');
  const mid = offset('barakhamba_road', 60, 250); // closer to Barakhamba, noisy
  const one = step(s0, { now: T0 + 20_000, fix: { ...mid, accuracyM: 150, t: T0 + 20_000 } });
  assert.equal(one.detection.stationId, 'rajiv_chowk', 'single fix must not switch');
  assert.match(one.detection.reason, /Barakhamba Road/);
  const two = step(one.state, { now: T0 + 40_000, fix: { ...mid, accuracyM: 150, t: T0 + 40_000 } });
  assert.equal(two.detection.stationId, 'barakhamba_road');
});

test('hysteresis: fixes alternating between two stations never flap', () => {
  let state = step(undefined, { now: T0, fix: at('ramesh_nagar', T0) }).state;
  const seen = new Set<string>();
  for (let i = 1; i <= 8; i++) {
    const id = i % 2 ? 'moti_nagar' : 'ramesh_nagar';
    const r = step(state, { now: T0 + i * 15_000, fix: { ...at(id, T0 + i * 15_000), accuracyM: 200 } });
    state = r.state;
    seen.add(r.detection.stationId!);
  }
  assert.deepEqual([...seen], ['ramesh_nagar']);
});

test('hysteresis: a sharp fix inside another station wins immediately', () => {
  const s0 = step(undefined, { now: T0, fix: at('rajiv_chowk', T0) }).state;
  const r = step(s0, { now: T0 + 20_000, fix: at('mandi_house', T0 + 20_000, { accuracyM: 15 }) });
  assert.equal(r.detection.stationId, 'mandi_house');
});

// ─── Movement ──────────────────────────────────────────────────────────────

test('movement: still, walking and in-vehicle from fix history; train dwell stays in-vehicle', () => {
  const base = st('karol_bagh');
  const f = (dm: number, t: number) => ({ lat: base.lat + dm / 111_320, lng: base.lng, acc: 10, t });
  assert.equal(classifyMovement([f(0, 0), f(5, 20_000)], undefined, undefined, 'unknown', undefined, 20_000).movement, 'still');
  assert.equal(classifyMovement([f(0, 0), f(40, 20_000)], undefined, undefined, 'unknown', undefined, 20_000).movement, 'walking');
  const v = classifyMovement([f(0, 0), f(300, 20_000)], undefined, undefined, 'unknown', undefined, 20_000);
  assert.equal(v.movement, 'in_vehicle');
  // 30 s later the train is stopped at a platform: still a train.
  const dwell = classifyMovement([f(300, 20_000), f(302, 50_000)], { speedMps: 0 }, undefined, 'in_vehicle', v.lastVehicleAt, 50_000);
  assert.equal(dwell.movement, 'in_vehicle');
  // Two minutes stopped: they got off.
  const off = classifyMovement([f(302, 50_000), f(303, 20_000 + TUNING.VEHICLE_LINGER_MS + 5_000)], { speedMps: 0 }, undefined, 'in_vehicle', v.lastVehicleAt, 20_000 + TUNING.VEHICLE_LINGER_MS + 5_000);
  assert.equal(off.movement, 'still');
});

// ─── Direction ─────────────────────────────────────────────────────────────

test('direction on the Blue Line, eastbound: trunk says both terminals', () => {
  const { last } = run(ride(['karol_bagh', 'jhandewalan', 'rk_ashram_marg']));
  assert.equal(last.context, 'train');
  assert.equal(last.directionKey, 'towards_b');
  assert.equal(last.directionKnown, true);
  assert.equal(last.direction, 'Towards Noida Electronic City / Vaishali');
  assert.equal(last.source, 'gps');
});

test('direction on the Blue Line, westbound', () => {
  const { last } = run(ride(['rk_ashram_marg', 'jhandewalan', 'karol_bagh']));
  assert.equal(last.directionKey, 'towards_a');
  assert.equal(last.direction, 'Towards Dwarka Sector 21');
});

test('Vaishali branch: after Yamuna Bank → Laxmi Nagar the direction names Vaishali', () => {
  const { last } = run(ride(['indraprastha', 'yamuna_bank', 'laxmi_nagar', 'nirman_vihar']));
  assert.equal(last.direction, 'Towards Vaishali');
  assert.equal(last.routeId, 'blue:branch');
  assert.equal(last.directionKey, 'towards_b');
});

test('Noida branch: after Yamuna Bank → Akshardham the direction names Noida Electronic City', () => {
  const { last } = run(ride(['indraprastha', 'yamuna_bank', 'akshardham']));
  assert.equal(last.direction, 'Towards Noida Electronic City');
});

test('from Vaishali westbound through the fork is towards Dwarka', () => {
  const { last } = run(ride(['nirman_vihar', 'laxmi_nagar', 'yamuna_bank', 'indraprastha']));
  assert.equal(last.direction, 'Towards Dwarka Sector 21');
});

test('Green Line branch: Punjabi Bagh → Kirti Nagar is the Kirti Nagar branch', () => {
  const { last } = run(ride(['peera_garhi', 'punjabi_bagh', 'kirti_nagar_g']));
  assert.equal(last.direction, 'Towards Kirti Nagar');
});

test('between two stations: progress along the segment in the direction of travel', () => {
  const kb = st('karol_bagh');
  const jw = st('jhandewalan');
  const t1 = T0 + 120_000;
  const { last } = run([
    ...ride(['rajendra_place', 'karol_bagh']),
    { now: t1 + 30_000, fix: { lat: kb.lat + (jw.lat - kb.lat) * 0.4, lng: kb.lng + (jw.lng - kb.lng) * 0.4, accuracyM: 25, speedMps: 13, t: t1 + 30_000 } }
  ]);
  assert.equal(last.context, 'train');
  assert.equal(last.between?.fromStationId, 'karol_bagh');
  assert.equal(last.between?.toStationId, 'jhandewalan');
  assert.ok(last.progress! > 0.3 && last.progress! < 0.5, `progress ${last.progress}`);
  assert.match(last.reason, /between Karol Bagh and Jhandewalan/);
});

test('a skipped fix mid-ride still advances the station and keeps the sequence', () => {
  // Fixes at Karol Bagh then just past RK Ashram Marg: Jhandewalan was passed without a fix.
  const rk = st('rk_ashram_marg');
  const rc = st('rajiv_chowk');
  const { state, last } = run([
    ...ride(['karol_bagh']),
    { now: T0 + 240_000, fix: { lat: rk.lat + (rc.lat - rk.lat) * 0.3, lng: rk.lng + (rc.lng - rk.lng) * 0.3, accuracyM: 30, speedMps: 12, t: T0 + 240_000 } }
  ]);
  assert.equal(state.stationId, 'rk_ashram_marg');
  assert.deepEqual(state.visits.map(v => v.stationId), ['karol_bagh', 'jhandewalan', 'rk_ashram_marg']);
  assert.equal(last.directionKey, 'towards_b');
});

// ─── No GPS: hold, dead-reckon, decay ─────────────────────────────────────

test('underground: holds the last station for a while with decaying confidence, then says it is stale', () => {
  const start = step(undefined, { now: T0, fix: at('rajiv_chowk', T0, { accuracyM: 15 }) });
  assert.equal(start.detection.context, 'station');
  const c0 = start.detection.confidence;
  assert.ok(c0 >= 0.7, `good fix confidence ${c0}`);

  const held = step(start.state, { now: T0 + 5 * 60_000 });
  assert.equal(held.detection.stationId, 'rajiv_chowk');
  assert.equal(held.detection.source, 'last_checkin');
  assert.equal(held.detection.held, true);
  assert.ok(held.detection.confidence < c0 && held.detection.confidence > 0.4);
  assert.match(held.detection.reason, /No GPS signal for 5 min \(underground station\)/);

  const later = step(held.state, { now: T0 + 12 * 60_000 });
  assert.ok(later.detection.confidence < held.detection.confidence);

  const gone = step(later.state, { now: T0 + 16 * 60_000 });
  assert.equal(gone.detection.stale, true);
  assert.equal(gone.detection.context, 'nearby');
  assert.ok(gone.detection.confidence <= 0.25);
  assert.match(gone.detection.reason, /Tap to confirm/);
});

test('underground train: dead-reckons by typical timings and says so', () => {
  const { state, last } = run(ride(['rk_ashram_marg', 'rajiv_chowk']));
  assert.equal(last.directionKnown, true);
  const r = step(state, { now: T0 + 120_000 + 4 * 60_000 });
  assert.equal(r.detection.source, 'schedule');
  assert.equal(r.detection.context, 'train');
  assert.ok(r.detection.confidence <= 0.5);
  assert.ok(r.detection.between, 'estimates a segment');
  assert.match(r.detection.reason, /typical train times/);
});

test('a stale or weak fix counts as no fix', () => {
  const s0 = step(undefined, { now: T0, fix: at('karol_bagh', T0) }).state;
  const old = step(s0, { now: T0 + 5 * 60_000, fix: at('mandi_house', T0 + 1_000) });
  assert.equal(old.detection.stationId, 'karol_bagh');
  assert.equal(old.detection.held, true);
  assert.match(old.detection.reason, /GPS fix is \d+ min old/);
});

// ─── Manual override ──────────────────────────────────────────────────────

test('manual pick is sticky nearby, released after moving ~1.5 stations away', () => {
  const pick = step(undefined, { now: T0, override: { stationId: 'hauz_khas', lineId: 'yellow', direction: 'Towards Samaypur Badli' } });
  assert.equal(pick.detection.source, 'manual');
  assert.equal(pick.detection.stationId, 'hauz_khas');
  assert.equal(pick.detection.direction, 'Towards Samaypur Badli');
  assert.equal(pick.detection.stickyUntil, T0 + 30 * 60_000);

  // GPS 600 m away (still near): pick stands.
  const near = step(pick.state, { now: T0 + 60_000, fix: { ...offset('hauz_khas', 600, 90), accuracyM: 20, t: T0 + 60_000 } });
  assert.equal(near.detection.source, 'manual');
  assert.equal(near.detection.stationId, 'hauz_khas');

  // One station north (Green Park) is still within 1.5 stations: pick stands.
  const one = step(near.state, { now: T0 + 3 * 60_000, fix: at('green_park', T0 + 3 * 60_000, { accuracyM: 20 }) });
  assert.equal(one.detection.source, 'manual');

  // Two stations north (AIIMS): > 1.5 stations → back to GPS.
  const moved = step(one.state, { now: T0 + 6 * 60_000, fix: at('aiims', T0 + 6 * 60_000, { accuracyM: 20 }) });
  assert.equal(moved.detection.source, 'gps');
  assert.equal(moved.detection.stationId, 'aiims');
  assert.equal(moved.detection.stickyUntil, null);
  assert.match(moved.detection.reason, /switched back to GPS/);
});

test('manual pick expires after 30 minutes', () => {
  const pick = step(undefined, { now: T0, override: { stationId: 'rajiv_chowk' } });
  const still = step(pick.state, { now: T0 + 29 * 60_000 });
  assert.equal(still.detection.source, 'manual');
  const expired = step(still.state, { now: T0 + 31 * 60_000, fix: at('karol_bagh', T0 + 31 * 60_000) });
  assert.equal(expired.detection.source, 'gps');
  assert.equal(expired.detection.stationId, 'karol_bagh');
});

test('manual pick on an interchange honours the chosen line', () => {
  const r = step(undefined, { now: T0, override: { stationId: 'rajiv_chowk', lineId: 'yellow' } });
  assert.equal(r.detection.stationId, 'rajiv_chowk_y');
  assert.equal(r.detection.lineId, 'yellow');
});

test('confirm makes the current GPS context sticky', () => {
  const s0 = step(undefined, { now: T0, fix: at('karol_bagh', T0) }).state;
  const c = step(s0, { now: T0 + 1000, confirm: true });
  assert.equal(c.detection.source, 'manual');
  assert.equal(c.detection.stationId, 'karol_bagh');
});

test('direction flip overrides the detected direction', () => {
  const { state } = run(ride(['karol_bagh', 'jhandewalan']));
  const r = step(state, { now: T0 + 300_000, directionOverride: { lineId: 'blue', direction: 'Towards Dwarka Sector 21' } });
  assert.equal(r.detection.direction, 'Towards Dwarka Sector 21');
  assert.equal(r.detection.directionKey, 'towards_a');
});

// ─── Train identity ───────────────────────────────────────────────────────

test('train slot: riders on the same train share it; it stays constant during the ride', () => {
  const topo = getLineTopology('blue')!;
  const iKB = indexFromTerminalA(topo, 'karol_bagh');
  const iRC = indexFromTerminalA(topo, 'rajiv_chowk');
  const tKB = T0 + 30_000;
  const tRC = tKB + (iRC - iKB) * 150_000;
  const a = trainSlot(iKB, 'towards_b', tKB);
  assert.equal(trainSlot(iRC, 'towards_b', tRC), a);
  // Westbound too.
  const w = trainSlot(iRC, 'towards_a', tKB);
  assert.equal(trainSlot(iKB, 'towards_a', tKB + (iRC - iKB) * 150_000), w);
  // Jitter of one headway keeps the previous slot.
  assert.equal(stickyTrainSlot({ lineId: 'blue', key: 'towards_b', slot: a }, 'blue', 'towards_b', a + 1), a);
  assert.equal(stickyTrainSlot({ lineId: 'blue', key: 'towards_b', slot: a }, 'blue', 'towards_b', a + 3), a + 3);
});
