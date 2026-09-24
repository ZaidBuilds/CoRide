/**
 * Integration tests for /api/context/detect (engine v2 fields, rooms, manual
 * picks, legacy compatibility). Boots the real server like api.test.ts.
 *
 *   npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { DELHI_METRO_LINES } from '../data/metroData';

const SERVER_DIR = path.join(__dirname, '..', '..');
let DATA_DIR = '';
let BASE = '';
let proc: ChildProcess | null = null;
let output = '';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

before(async () => {
  DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coride-ctx-test-'));
  const port = await freePort();
  proc = spawn(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR,
      AUTH_SECRET: 'test-secret-0123456789-0123456789-abcdef',
      ADMIN_TOKEN: 'test-admin-token',
      REDIS_URL: 'redis://127.0.0.1:1',
      DATABASE_URL: '',
      BEACHHEAD_LINE: 'all'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stdout!.on('data', d => { output += d.toString(); });
  proc.stderr!.on('data', d => { output += d.toString(); });
  BASE = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`server did not start:\n${output}`);
});

after(() => {
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
});

async function newUser(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/random-profile`);
  assert.equal(r.status, 200);
  return (await r.json()).token;
}

async function detect(token: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${BASE}/api/context/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  assert.equal(r.status, 200);
  return r.json();
}

function st(id: string) {
  for (const l of DELHI_METRO_LINES) {
    const s = l.stations.find(x => x.id === id);
    if (s) return s;
  }
  throw new Error(id);
}

test('v2 detect: a good fix at Karol Bagh returns the station, new fields, and both rooms', async () => {
  const token = await newUser();
  const s = st('karol_bagh');
  const body = await detect(token, { v: 2, lat: s.lat, lng: s.lng, accuracyM: 15, fixAt: Date.now() });
  const c = body.context;
  // Legacy fields are all still there.
  for (const k of ['id', 'station', 'stationName', 'line', 'lineName', 'lineColor', 'direction', 'context', 'confidence', 'rawScore', 'trainId', 'scheduleInfo', 'breakdown', 'reason']) {
    assert.ok(k in c, `missing ${k}`);
  }
  assert.equal(c.station, 'karol_bagh');
  assert.equal(c.context, 'station');
  assert.equal(c.source, 'gps');
  assert.equal(c.engineVersion, 2);
  assert.equal(c.between, null);
  assert.equal(c.progress, null);
  assert.equal(c.stickyUntil, null);
  assert.equal(c.directionKnown, false);
  assert.equal(typeof c.reason, 'string');
  assert.match(c.reason, /Karol Bagh/);
  assert.ok(c.confidence >= 0.7);
  assert.equal(body.rooms.station.id, 'station:karol_bagh');
  assert.match(body.rooms.train.id, /^train:blue:towards_b:train_blue_fwd_\d+$/);
  assert.equal(body.room.id, body.rooms.station.id);
});

test('v2 detect: riding the Blue Line gives train context, direction and a stable train room', async () => {
  const token = await newUser();
  const kb = st('karol_bagh');
  const jw = st('jhandewalan');
  const now = Date.now();
  const a = await detect(token, { v: 2, lat: kb.lat, lng: kb.lng, accuracyM: 20, speedKmh: 45, fixAt: now });
  const b = await detect(token, { v: 2, lat: jw.lat, lng: jw.lng, accuracyM: 20, speedKmh: 45, fixAt: now + 1000 });
  assert.equal(b.context.context, 'train');
  assert.equal(b.context.movement, 'in_vehicle');
  assert.equal(b.context.directionKnown, true);
  assert.equal(b.context.directionKey, 'towards_b');
  assert.equal(b.room.id, b.rooms.train.id);
  assert.equal(a.rooms.train.id, b.rooms.train.id, 'train room does not change mid-ride');
});

test('v2 override: a manual pick on an interchange is sticky and honours the line', async () => {
  const token = await newUser();
  const body = await detect(token, { v: 2, override: { stationId: 'rajiv_chowk', lineId: 'yellow', direction: 'Towards Samaypur Badli' } });
  assert.equal(body.context.station, 'rajiv_chowk_y');
  assert.equal(body.context.line, 'yellow');
  assert.equal(body.context.source, 'manual');
  assert.equal(body.context.direction, 'Towards Samaypur Badli');
  assert.ok(body.context.stickyUntil > Date.now() + 29 * 60_000);
  // A later GPS fix nearby does not undo the pick.
  const rc = st('rajiv_chowk');
  const again = await detect(token, { v: 2, lat: rc.lat + 0.002, lng: rc.lng, accuracyM: 30 });
  assert.equal(again.context.source, 'manual');
  assert.equal(again.context.station, 'rajiv_chowk_y');
});

test('v2 with no location says so instead of inventing a station', async () => {
  const token = await newUser();
  const body = await detect(token, { v: 2 });
  assert.equal(body.context.source, 'none');
  assert.equal(body.context.confidence, 0);
  assert.equal(body.context.context, 'nearby');
  assert.match(body.context.reason, /don't know where you are/);
});

test('legacy detect (no v) still works and the fake cell id is only a weak hint', async () => {
  const token = await newUser();
  const body = await detect(token, { cellTowerId: 'TOWER_DMRC_RC_CP', movementState: 'WALKING', speedKmh: 3 });
  assert.ok(body.room && body.room.id);
  assert.equal(body.rooms, undefined);
  assert.equal(body.context.station, 'rajiv_chowk');
  assert.equal(body.context.context, 'nearby');
  assert.ok(body.context.confidence <= 0.2);
  assert.equal(typeof body.context.breakdown.stationMatch, 'number');
  assert.equal(typeof body.context.rawScore, 'number');
});

test('legacy check-in (station coords + userConfirmed) becomes a manual pick', async () => {
  const token = await newUser();
  const s = st('hauz_khas_m');
  const body = await detect(token, { lat: s.lat, lng: s.lng, userConfirmed: true, cellTowerId: 'TOWER_DMRC_HAUZ_KHAS_M', movementState: 'WALKING' });
  assert.equal(body.context.station, 'hauz_khas_m');
  assert.equal(body.context.source, 'manual');
});

test('direction override keeps the rider’s station', async () => {
  const token = await newUser();
  const s = st('karol_bagh');
  await detect(token, { v: 2, lat: s.lat, lng: s.lng, accuracyM: 15 });
  const r = await fetch(`${BASE}/api/context/direction-override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lineId: 'blue', direction: 'Towards Dwarka Sector 21' })
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.context.station, 'karol_bagh');
  assert.equal(body.context.direction, 'Towards Dwarka Sector 21');
  assert.equal(body.context.directionKey, 'towards_a');
});

test('detect rejects nothing but ignores garbage fields', async () => {
  const token = await newUser();
  const body = await detect(token, { v: 2, lat: 'abc', lng: 9999, accuracyM: -5, fixAt: 'x', override: { stationId: '../../etc' }, movementState: 'FLYING' });
  assert.equal(body.context.source, 'none');
});
