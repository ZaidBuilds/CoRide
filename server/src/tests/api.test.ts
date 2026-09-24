/**
 * End-to-end API tests: boots the real server (ts-node, transpile-only) on a
 * random port with a throwaway DATA_DIR, then exercises auth on the locked
 * routes, validation, JSON error handling, account deletion and graceful
 * shutdown. Redis is pointed at a closed port on purpose — presence routes
 * must degrade to 503, never crash.
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

const SERVER_DIR = path.join(__dirname, '..', '..');
const ADMIN = 'test-admin-token';
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

async function startServer(env: Record<string, string>): Promise<{ proc: ChildProcess; base: string }> {
  const port = await freePort();
  const child = spawn(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATA_DIR,
      AUTH_SECRET: 'test-secret-0123456789-0123456789-abcdef',
      ADMIN_TOKEN: ADMIN,
      REDIS_URL: 'redis://127.0.0.1:1',
      DATABASE_URL: '',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout!.on('data', d => { output += d.toString(); });
  child.stderr!.on('data', d => { output += d.toString(); });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${output}`);
    try {
      const r = await fetch(`${base}/healthz`);
      if (r.ok) return { proc: child, base };
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  child.kill('SIGKILL');
  throw new Error(`server did not start:\n${output}`);
}

type Json = any;
async function api(method: string, p: string, opts: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; body: Json; headers: Headers }> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.raw !== undefined) { body = opts.raw; headers['Content-Type'] = 'application/json'; }
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers['Content-Type'] = 'application/json'; }
  const r = await fetch(`${BASE}${p}`, { method, headers, body });
  const text = await r.text();
  let parsed: Json = text;
  try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, body: parsed, headers: r.headers };
}

async function newUser(): Promise<{ id: string; token: string }> {
  const r = await api('GET', '/api/auth/random-profile');
  assert.equal(r.status, 200);
  return { id: r.body.profile.id, token: r.body.token };
}

before(async () => {
  DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coride-test-'));
  const s = await startServer({});
  proc = s.proc;
  BASE = s.base;
});

after(async () => {
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
});

test('healthz reports status without auth', async () => {
  const r = await api('GET', '/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.persistence.mode, 'file');
});

test('security headers are set', async () => {
  const r = await api('GET', '/api/metro/beachhead');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('unknown API routes and malformed JSON return JSON errors', async () => {
  const nf = await api('GET', '/api/does-not-exist');
  assert.equal(nf.status, 404);
  assert.equal(nf.body.error, 'Not found');
  const bad = await api('POST', '/api/analytics/event', { raw: '{"event":' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Malformed JSON/);
});

test('presence routes degrade to 503 (not a crash) when Redis is down', async () => {
  const u = await newUser();
  const r = await api('GET', '/api/room/rajiv_chowk:blue:towards_noida', { token: u.token });
  assert.equal(r.status, 503);
  const h = await api('POST', '/api/room/rajiv_chowk:blue:towards_noida/heartbeat');
  assert.equal(h.status, 401);
  const ok = await api('GET', '/healthz');
  assert.equal(ok.status, 200);
});

test('forged or missing tokens are rejected', async () => {
  const u = await newUser();
  const forged = `${u.id}.not-a-real-signature`;
  assert.equal((await api('GET', '/api/connections', { token: forged })).status, 401);
  assert.equal((await api('GET', '/api/connections')).status, 401);
  assert.equal((await api('GET', '/api/connections', { token: u.token })).status, 200);
});

test('commute patterns are owner-only', async () => {
  const a = await newUser();
  const b = await newUser();
  assert.equal((await api('GET', `/api/commute/patterns/${a.id}`)).status, 401);
  assert.equal((await api('GET', `/api/commute/patterns/${a.id}`, { token: b.token })).status, 403);
  assert.equal((await api('POST', '/api/commute/patterns', { body: { userId: a.id } })).status, 401);

  const bad = await api('POST', '/api/commute/patterns', { token: a.token, body: { targetTime: '25:99' } });
  assert.equal(bad.status, 400);

  // A body userId naming someone else is ignored — the token decides the owner.
  const saved = await api('POST', '/api/commute/patterns', { token: a.token, body: { userId: b.id, targetTime: '08:15', label: 'Home → Work' } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.pattern.userId, a.id);

  const mine = await api('GET', `/api/commute/patterns/${a.id}`, { token: a.token });
  assert.equal(mine.body.patterns.length, 1);
  const theirs = await api('GET', `/api/commute/patterns/${b.id}`, { token: b.token });
  assert.equal(theirs.body.patterns.length, 0);

  const pid = saved.body.pattern.id;
  assert.equal((await api('DELETE', `/api/commute/patterns/${a.id}/${pid}`, { token: b.token })).status, 403);
  assert.equal((await api('POST', `/api/commute/patterns/${a.id}/${pid}/use`, { token: b.token })).status, 403);
  const used = await api('POST', `/api/commute/patterns/${a.id}/${pid}/use`, { token: a.token });
  assert.equal(used.status, 200);
  assert.equal(used.body.pattern.useCount, 1);
  assert.equal((await api('DELETE', `/api/commute/patterns/${a.id}/${pid}`, { token: a.token })).status, 200);
  assert.equal((await api('DELETE', `/api/commute/patterns/${a.id}/${pid}`, { token: a.token })).status, 404);
});

test('push subscribe requires auth and ignores body userId', async () => {
  const a = await newUser();
  const b = await newUser();
  const sub = { endpoint: 'local:x', keys: {} };
  assert.equal((await api('POST', '/api/push/subscribe', { body: { userId: a.id, subscription: sub } })).status, 401);
  assert.equal((await api('POST', '/api/push/subscribe', { token: a.token, body: { subscription: 'nope' } })).status, 400);
  const ok = await api('POST', '/api/push/subscribe', { token: a.token, body: { userId: b.id, subscription: sub } });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/push/subscriptions')).status, 403);
  const count = await api('GET', '/api/push/subscriptions', { headers: { 'x-admin-token': ADMIN } });
  assert.equal(count.status, 200);
  assert.ok(count.body.count >= 1);
});

test('interest tags endpoint saves only valid tags, owner-only', async () => {
  const a = await newUser();
  const b = await newUser();
  assert.equal((await api('PATCH', `/api/user/${a.id}/tags`, { token: b.token, body: { tags: ['music'] } })).status, 403);
  assert.equal((await api('PATCH', `/api/user/${a.id}/tags`, { token: a.token, body: { tags: 'music' } })).status, 400);
  const r = await api('PATCH', `/api/user/${a.id}/tags`, { token: a.token, body: { tags: ['Music', 'coding', 'not-a-tag', 42, 'music'] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.tags, ['music', 'coding']);
  const p = await api('GET', `/api/profile/${a.id}`);
  assert.deepEqual(p.body.profile.interestTags, ['music', 'coding']);
});

test('profile PATCH validates input and is owner-only', async () => {
  const a = await newUser();
  const b = await newUser();
  assert.equal((await api('PATCH', `/api/profile/${a.id}`, { token: b.token, body: { bio: 'x' } })).status, 403);
  assert.equal((await api('PATCH', `/api/profile/${a.id}`, { token: a.token, body: { pseudonym: 'x' } })).status, 400);
  const r = await api('PATCH', `/api/profile/${a.id}`, {
    token: a.token,
    body: { pseudonym: 'Metro Rider', bio: 'b'.repeat(500), languages: ['en', 5, 'hi'], avatarBg: 'url(https://evil.example/x.png)' }
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.pseudonym, 'Metro Rider');
  assert.equal(r.body.profile.bio.length, 120);
  assert.deepEqual(r.body.profile.languages, ['en', 'hi']);
  assert.doesNotMatch(r.body.profile.avatarBg, /url\(/);
});

test('analytics: identity from token, validated names, admin-only summary', async () => {
  const a = await newUser();
  assert.equal((await api('POST', '/api/analytics/event', { body: { event: 'Bad Name!' } })).status, 400);
  const ok = await api('POST', '/api/analytics/event', { token: a.token, body: { event: 'session_start', userId: 'someone_else', payload: { n: 1 } } });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/analytics/summary')).status, 403);
  await new Promise(r => setTimeout(r, 200)); // let the append stream flush
  const s = await api('GET', '/api/analytics/summary', { headers: { 'x-admin-token': ADMIN } });
  assert.equal(s.status, 200);
  const ev = s.body.lastEvents.find((e: any) => e.event === 'session_start');
  assert.equal(ev.userId, a.id);
});

test('moderation queues are admin-only', async () => {
  assert.equal((await api('GET', '/api/admin/reports')).status, 403);
  assert.equal((await api('GET', '/api/moderation/reports')).status, 403);
  assert.equal((await api('GET', '/api/admin/reports', { headers: { 'x-admin-token': 'wrong' } })).status, 403);
  assert.equal((await api('GET', '/api/admin/reports', { headers: { 'x-admin-token': ADMIN } })).status, 200);
});

test('context routes: direction override needs auth; detect validates input', async () => {
  const a = await newUser();
  assert.equal((await api('POST', '/api/context/direction-override', { body: { userId: a.id, lineId: 'blue', direction: 'Towards Noida' } })).status, 401);
  const ok = await api('POST', '/api/context/direction-override', { token: a.token, body: { lineId: 'blue', direction: 'Towards Noida Electronic City' } });
  assert.equal(ok.status, 200);
  const det = await api('POST', '/api/context/detect', { token: a.token, body: { lat: 'abc', lng: 9999, routeHistory: [null, 5, { lat: 1 }], movementState: 'FLYING' } });
  assert.equal(det.status, 200);
  assert.ok(det.body.room);
});

test('private social graph reads reject a token for another user', async () => {
  const a = await newUser();
  const b = await newUser();
  assert.equal((await api('GET', `/api/friends/${b.id}`, { token: a.token })).status, 403);
  assert.equal((await api('GET', `/api/connections/pending/${b.id}`, { token: a.token })).status, 403);
  assert.equal((await api('GET', `/api/connections/history/${b.id}`)).status, 401);
  assert.equal((await api('GET', `/api/friends/${a.id}`, { token: a.token })).status, 200);
});

test('chat messages are length-limited', async () => {
  const a = await newUser();
  const b = await newUser();
  const req = await api('POST', '/api/connections', { token: a.token, body: { targetId: b.id } });
  assert.equal(req.status, 201);
  assert.equal((await api('POST', `/api/connections/${req.body.request.id}/accept`, { token: a.token })).status, 403);
  assert.equal((await api('POST', `/api/connections/${req.body.request.id}/accept`, { token: b.token })).status, 200);
  assert.equal((await api('POST', `/api/chats/${b.id}/messages`, { token: a.token, body: { content: 'x'.repeat(501) } })).status, 400);
  assert.equal((await api('POST', `/api/chats/${b.id}/messages`, { token: a.token, body: { content: 42 } })).status, 400);
  assert.equal((await api('POST', `/api/chats/${b.id}/messages`, { token: a.token, body: { content: 'hi there' } })).status, 201);
});

test('account deletion purges the user and invalidates their token', async () => {
  const a = await newUser();
  const b = await newUser();
  const req = await api('POST', '/api/connections', { token: a.token, body: { targetId: b.id } });
  await api('POST', `/api/connections/${req.body.request.id}/accept`, { token: b.token });
  await api('POST', `/api/chats/${a.id}/messages`, { token: b.token, body: { content: 'hello from b' } });
  await api('POST', '/api/commute/patterns', { token: b.token, body: { label: 'b commute' } });
  await api('POST', '/api/push/subscribe', { token: b.token, body: { subscription: { endpoint: 'local:b' } } });

  assert.equal((await api('DELETE', `/api/profile/${b.id}`)).status, 401);
  assert.equal((await api('DELETE', `/api/profile/${b.id}`, { token: a.token })).status, 403);
  const del = await api('DELETE', `/api/profile/${b.id}`, { token: b.token });
  assert.equal(del.status, 200);

  assert.equal((await api('GET', `/api/profile/${b.id}`)).status, 404);
  // Token still verifies cryptographically but the account is gone.
  assert.equal((await api('GET', '/api/connections', { token: b.token })).status, 401);
  assert.equal((await api('POST', '/api/commute/patterns', { token: b.token, body: {} })).status, 401);
  const chats = await api('GET', '/api/chats', { token: a.token });
  assert.equal(chats.body.chats.length, 0);

  // Deletion is flushed immediately, not left on the debounce.
  const disk = fs.readFileSync(path.join(DATA_DIR, 'store.json'), 'utf-8');
  assert.ok(!disk.includes(b.id), 'deleted user id must not remain in store.json');
  assert.ok(disk.includes(a.id));
});

test('connection lists include profiles of users who never joined a room', async () => {
  const a = await newUser();
  const b = await newUser();
  const req = await api('POST', '/api/connections', { token: a.token, body: { targetId: b.id } });
  assert.equal(req.status, 201);

  const mine = await api('GET', '/api/connections', { token: b.token });
  assert.equal(mine.body.pending.incoming[0].fromProfile?.id, a.id);
  const out = await api('GET', '/api/connections', { token: a.token });
  assert.equal(out.body.pending.outgoing[0].toProfile?.id, b.id);
  const pending = await api('GET', `/api/connections/pending/${b.id}`, { token: b.token });
  assert.equal(pending.body.pending[0].fromProfile?.id, a.id);
  const sent = await api('GET', `/api/connections/sent/${a.id}`, { token: a.token });
  assert.equal(sent.body.sent[0].toProfile?.id, b.id);

  await api('POST', `/api/connections/${req.body.request.id}/accept`, { token: b.token });
  const friends = await api('GET', `/api/friends/${a.id}`, { token: a.token });
  assert.equal(friends.body.friends[0].profile?.id, b.id);
  const conns = await api('GET', '/api/connections', { token: a.token });
  assert.equal(conns.body.friends[0].profile?.id, b.id);
  const chats = await api('GET', '/api/chats', { token: a.token });
  assert.equal(chats.body.chats[0].peer?.id, b.id);
});

test('REST accept matches the socket path: reputation bump + connection_accepted to both', async () => {
  const a = await newUser();
  const b = await newUser();
  const before = (await api('GET', `/api/reputation/${a.id}`)).body.positive;

  // Optional live-socket check, using the client's socket.io-client if present.
  let ioClient: any = null;
  try { ioClient = require(path.join(SERVER_DIR, '..', 'client', 'node_modules', 'socket.io-client')).io; } catch {}
  const received: string[] = [];
  const sockets: any[] = [];
  if (ioClient) {
    for (const u of [a, b]) {
      const s = ioClient(BASE, { transports: ['websocket'], auth: { token: u.token } });
      s.on('connection_accepted', () => received.push(u.id));
      sockets.push(s);
      await new Promise<void>((resolve, reject) => { s.once('connect', () => resolve()); s.once('connect_error', reject); });
    }
  }

  const req = await api('POST', '/api/connections', { token: a.token, body: { targetId: b.id } });
  const acc = await api('POST', `/api/connections/${req.body.request.id}/accept`, { token: b.token });
  assert.equal(acc.status, 200);

  const afterA = (await api('GET', `/api/reputation/${a.id}`)).body;
  const afterB = (await api('GET', `/api/reputation/${b.id}`)).body;
  assert.equal(afterA.positive, before + 1);
  assert.equal(afterA.score, 105);
  assert.equal(afterB.score, 105);

  if (ioClient) {
    await new Promise(r => setTimeout(r, 300));
    for (const s of sockets) s.close();
    assert.deepEqual(received.sort(), [a.id, b.id].sort());
  }
});

test('SIGTERM drains and flushes the store before exiting', { skip: process.platform === 'win32' }, async () => {
  const a = await newUser();
  // Written through the 400ms debounce; SIGTERM must flush it.
  await api('PATCH', `/api/profile/${a.id}`, { token: a.token, body: { bio: 'flushed on shutdown' } });
  const exited = new Promise<number | null>(resolve => proc!.once('exit', code => resolve(code)));
  proc!.kill('SIGTERM');
  const code = await exited;
  assert.equal(code, 0, output);
  const disk = fs.readFileSync(path.join(DATA_DIR, 'store.json'), 'utf-8');
  assert.ok(disk.includes('flushed on shutdown'));
});

test('production boot refuses a missing AUTH_SECRET', async () => {
  const child = spawn(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'production', AUTH_SECRET: '', PORT: '0', DATA_DIR, REDIS_URL: 'redis://127.0.0.1:1', DATABASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let err = '';
  child.stderr!.on('data', d => { err += d.toString(); });
  const code = await new Promise<number | null>(resolve => child.once('exit', c => resolve(c)));
  assert.equal(code, 1);
  assert.match(err, /AUTH_SECRET/);
});
