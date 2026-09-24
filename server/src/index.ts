import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { DELHI_METRO_LINES, getActiveMetroLines, getBeachheadInfo, getRandomTelegramProfile, AVATAR_PALETTE } from './data/metroData';
import dotenv from 'dotenv';
dotenv.config();
try { dotenv.config({ path: path.join(__dirname, '..', '.env') }); } catch {}
try { dotenv.config({ path: path.join(process.cwd(), 'server', '.env') }); } catch {}
try { dotenv.config({ path: path.join(process.cwd(), '.env') }); } catch {}
import { TransitContextEngine } from './services/transitContextEngine';
import { PathTrackerEngine } from './services/pathTrackerEngine';
import { RoomManager } from './services/roomManager';
import { ConnectionManager } from './services/connectionManager';
import { ModerationEngine } from './services/moderationEngine';
import { PresenceManager } from './services/presenceManager';
import { Persistence } from './services/persistence';
import { EngagementManager } from './services/engagement/engagementManager';
import { RankingService } from './services/personalization/rankingService';
import { CommutePatternService } from './services/personalization/commutePatternService';
import { RedisPresence } from './services/redisPresence';
import { assertAuthSecret, signToken, verifyToken } from './services/authToken';
import { corsOrigin, describeCors, isOriginAllowed, securityHeaders, RateLimiter, sendRateLimited, IS_PRODUCTION } from './services/httpSecurity';
import { logEvent, readEvents, closeAnalytics } from './services/analyticsLog';
import { closeDb } from './db/pool';
import { INTEREST_TAXONOMY, sanitizeTags } from './types';
import type { UserProfile } from './types';

// Refuse to boot in production with a forgeable token secret.
try {
  assertAuthSecret();
} catch (err: any) {
  console.error(err?.message || err);
  process.exit(1);
}

/**
 * STRICT_AUTH=1 makes the few legacy private reads that older client builds
 * call without a token (friends / pending / sent lists, context detect, rank)
 * require one. Off by default for backward compatibility; a request that DOES
 * carry a token is always checked against the resource owner either way.
 */
const STRICT_AUTH = /^(1|true|yes|on)$/i.test(process.env.STRICT_AUTH || '');

const app = express();
app.disable('x-powered-by');
// Real client IPs for rate limiting. Default trusts only private-network
// proxies (typical PaaS load balancers), so a public client can't spoof
// X-Forwarded-For. Override with TRUST_PROXY (hop count, true, or IP list).
{
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy',
    tp === undefined || tp === '' ? 'loopback, linklocal, uniquelocal'
      : /^\d+$/.test(tp) ? Number(tp)
      : /^(true|false)$/i.test(tp) ? tp.toLowerCase() === 'true'
      : tp);
}

const server = http.createServer(app);
// Behind a load balancer the proxy's idle timeout is usually 60s; keep ours
// longer so it never reuses a socket we already closed.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

const io = new SocketIOServer(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  // WebSocket upgrades are not covered by CORS — check the Origin here too.
  allowRequest: (req, cb) => cb(null, isOriginAllowed(req.headers.origin)),
  maxHttpBufferSize: 64 * 1024
});

app.use(securityHeaders);
app.use(cors({ origin: corsOrigin, maxAge: 600 }));

const PORT = Number(process.env.PORT) || 4000;
const contextEngine = TransitContextEngine.getInstance();
const roomManager = RoomManager.getInstance();
const connectionManager = ConnectionManager.getInstance();
const moderation = ModerationEngine.getInstance();
const presence = PresenceManager.getInstance();
const persistence = Persistence.getInstance();
const engagement = EngagementManager.getInstance();
const rankingService = RankingService.getInstance();
const commuteService = CommutePatternService.getInstance();
const redisPresence = RedisPresence.getInstance();

const startedAt = Date.now();
let shuttingDown = false;

// ────────────────────────────────────────
//  Health (before rate limiting / body parsing)
// ────────────────────────────────────────
function health(_req: express.Request, res: express.Response) {
  const body = {
    ok: !shuttingDown,
    status: shuttingDown ? 'shutting_down' : 'ok',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    persistence: persistence.status(),
    redis: redisPresence.isReady() ? 'ready' : 'unavailable',
    sockets: io.engine?.clientsCount ?? 0
  };
  // 503 only while draining, so the host stops routing to us. A down Redis
  // is reported but not fatal — restarting the API would not fix it.
  res.status(shuttingDown ? 503 : 200).json(body);
}
app.get('/healthz', health);
app.get('/health', health);

// ────────────────────────────────────────
//  Auth helpers
// ────────────────────────────────────────

// Authenticated actor identity. Derived ONLY from a verified signed token
// (Authorization: Bearer <token>, issued at /api/auth/*). A client can no
// longer claim an identity via a plain header — the signature is checked.
function actorId(req: express.Request): string | null {
  const auth = req.header('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  // Also accept the raw token in x-user-token (sockets/tests), never a bare id.
  return verifyToken(bearer || req.header('x-user-token'));
}

/** Any known profile: the persisted store first, then the in-memory room copy
 * (connection lists used to read only the room copy, so users who had not
 * joined a room yet came back as profile: null). */
function lookupProfile(userId: string): UserProfile | null {
  return persistence.getProfile(userId) || roomManager.getUserProfile(userId) || null;
}

function profileExists(userId: string): boolean {
  return !!lookupProfile(userId);
}

/**
 * Require a valid token for an account that still exists. Tokens are
 * stateless, so a deleted account's token still verifies — without the
 * existence check it could recreate data after deletion.
 */
function requireActor(req: express.Request, res: express.Response): string | null {
  const id = actorId(req);
  if (!id) {
    res.status(401).json({ error: 'Sign-in required.' });
    return null;
  }
  if (!profileExists(id)) {
    res.status(401).json({ error: 'Account not found. Please sign in again.' });
    return null;
  }
  return id;
}

/** Require that the authenticated caller IS `ownerId`. */
function requireSelf(req: express.Request, res: express.Response, ownerId: string): string | null {
  const me = requireActor(req, res);
  if (!me) return null;
  if (me !== ownerId) {
    res.status(403).json({ error: 'You can only access your own data.' });
    return null;
  }
  return me;
}

/**
 * Private per-user reads that shipped client screens still call without a
 * token. A token, when sent, must match the owner. Without one the request is
 * refused only under STRICT_AUTH (see above).
 */
function selfOrLegacy(req: express.Request, res: express.Response, ownerId: string): boolean {
  const me = actorId(req);
  if (me) {
    if (me !== ownerId) {
      res.status(403).json({ error: 'You can only access your own data.' });
      return false;
    }
    return true;
  }
  if (STRICT_AUTH) {
    res.status(401).json({ error: 'Sign-in required.' });
    return false;
  }
  return true;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Moderator-only routes. Disabled entirely unless ADMIN_TOKEN is configured. */
function requireAdmin(req: express.Request, res: express.Response): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  const given = req.header('x-admin-token') || '';
  if (!adminToken || !given || !safeEqual(given, adminToken)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// ────────────────────────────────────────
//  Input validation helpers
// ────────────────────────────────────────
const MAX_MESSAGE_CHARS = 500;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** Strip control characters (NUL etc.) and trim. */
function cleanText(s: string): string {
  return s.replace(CONTROL_CHARS, '').trim();
}
function optString(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? cleanText(v).slice(0, max) : undefined;
}
const ID_RE = /^[A-Za-z0-9_\-:.]{1,128}$/;
function isId(v: unknown): v is string {
  return typeof v === 'string' && ID_RE.test(v);
}
const SLUG_RE = /^[a-z0-9_\-]{1,40}$/i;
const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const AVATAR_BG_RE = /^(#[0-9a-f]{3,8}|linear-gradient\(\s*\d{1,3}deg(\s*,\s*#[0-9a-f]{3,8}(\s+\d{1,3}%)?){2,4}\s*\))$/i;
// Display names: any printable text (emoji, apostrophes, Devanagari...) of
// 2–20 chars with at least one letter/number. Angle brackets, bidi overrides
// and zero-width characters are refused (spoofing), as are system names.
const PSEUDONYM_BAD = /[<>\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;
const RESERVED_NAMES = new Set(['coride', 'system', 'admin', 'moderator', 'support']);
function validPseudonym(raw: string): string | null {
  const p = cleanText(raw).replace(/\s+/g, ' ');
  if (p.length < 2 || p.length > 20) return null;
  if (PSEUDONYM_BAD.test(p) || !/[\p{L}\p{N}]/u.test(p)) return null;
  if (RESERVED_NAMES.has(p.toLowerCase().replace(/[^a-z]/g, ''))) return null;
  return p;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function finiteOrUndef(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
/** Validate a message body; returns an error string or the cleaned content. */
function validateMessage(raw: unknown): { ok: true; content: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'content is required.' };
  const content = cleanText(raw);
  if (!content) return { ok: false, error: 'content is required.' };
  if (content.length > MAX_MESSAGE_CHARS) return { ok: false, error: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` };
  return { ok: true, content };
}
function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// ────────────────────────────────────────
//  Rate limiting
// ────────────────────────────────────────
// Keyed by the authenticated user when there is one, otherwise by IP. Mobile
// carriers put many users behind one IP (CGNAT), so IP limits stay generous.
const apiLimiter = new RateLimiter(Number(process.env.RATE_LIMIT_PER_MIN) || 300, 60_000);
const writeLimiter = new RateLimiter(Number(process.env.WRITE_LIMIT_PER_MIN) || 60, 60_000);
const signupLimiter = new RateLimiter(30, 10 * 60_000);         // new profiles per IP
const connectionLimiter = new RateLimiter(20, 60 * 60_000);     // REST connection requests per user
const reportLimiter = new RateLimiter(10, 60 * 60_000);         // REST reports per user
const analyticsLimiter = new RateLimiter(120, 60_000);          // analytics events per key

function rateKey(req: express.Request): string {
  const uid = actorId(req);
  return uid ? `u:${uid}` : `ip:${req.ip || 'unknown'}`;
}

app.use('/api', (req, res, next) => {
  const key = rateKey(req);
  (req as any).rateKey = key;
  const g = apiLimiter.hit(key);
  if (!g.ok) return sendRateLimited(res, g.retryAfterSec);
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const w = writeLimiter.hit(key);
    if (!w.ok) return sendRateLimited(res, w.retryAfterSec);
  }
  next();
});

app.use(express.json({ limit: '32kb' }));

// Public legal pages. Google Play needs a reachable privacy-policy URL and a
// web URL where users can request account deletion without the app.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], index: false }));

// ── MVP2 helper: IST commute window (07:30-10:30, 17:00-20:30) ──
function isCommuteWindowNow(d = new Date()): boolean {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60000);
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const morning = mins >= 450 && mins <= 630;
  const evening = mins >= 1020 && mins <= 1230;
  return morning || evening;
}

// Track userId -> Set<socketId> for targeted emits (fixes broadcast leak)
const userIdToSocketIds: Map<string, Set<string>> = new Map();

function registerUserSocket(userId: string, socketId: string): void {
  if (!userIdToSocketIds.has(userId)) userIdToSocketIds.set(userId, new Set());
  userIdToSocketIds.get(userId)!.add(socketId);
}

function unregisterSocket(socketId: string): void {
  for (const [uid, set] of userIdToSocketIds.entries()) {
    if (set.has(socketId)) {
      set.delete(socketId);
      if (set.size === 0) userIdToSocketIds.delete(uid);
      break;
    }
  }
}

// Presence rooms (socket membership) just for Redis-presence rooms, kept
// separately from roomManager (in-memory context rooms). Enables disconnect
// cleanup + leave broadcasts without touching the legacy room store.
const socketPresenceRooms: Map<string, Set<string>> = new Map();

function emitToUsers(userIds: string[], event: string, payload: any): void {
  const sent = new Set<string>();
  for (const uid of userIds) {
    const sids = userIdToSocketIds.get(uid);
    if (!sids) continue;
    for (const sid of sids) {
      if (sent.has(sid)) continue;
      io.to(sid).emit(event, payload);
      sent.add(sid);
    }
  }
}

// ────────────────────────────────────────
//  REST API
// ────────────────────────────────────────

// Metro line data — respects BEACHHEAD_LINE filter (PRD §2)
app.get('/api/metro/lines', (_req, res) => {
  res.json({ lines: getActiveMetroLines(), beachhead: getBeachheadInfo(), allLines: DELHI_METRO_LINES.length });
});

app.get('/api/metro/beachhead', (_req, res) => {
  res.json(getBeachheadInfo());
});

/**
 * A room id must be exactly `station:line:direction`, each a bounded
 * `[a-z0-9_]` slug. This caps Redis key length/charset and prevents arbitrary
 * strings from creating junk rooms (key-space abuse) or ambiguous presence keys.
 */
const ROOM_ID_RE = /^[a-z0-9_]{1,40}:[a-z0-9_]{1,30}:[a-z0-9_]{1,40}$/;
function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id);
}

/**
 * A Redis-presence room (manual pick, e.g. rajiv_chowk:blue:towards_noida) as
 * opposed to a legacy context room (station:... / train:...), which lives in
 * roomManager. Presence rooms have members + TTL keys in Redis and ephemeral
 * socket messages; context rooms keep their in-memory row.
 */
function isPresenceRoomId(id: string): boolean {
  return isValidRoomId(id) && !id.startsWith('station:') && !id.startsWith('train:');
}

/** Any socket room id we accept: presence ids or legacy context ids. */
function isSocketRoomId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && /^[A-Za-z0-9_\-:.]+$/.test(id);
}

/**
 * Live presence for a manually-picked room — {station}:{line}:{direction}.
 * Polled by the client every 15s; no GPS, no inference, no socket.
 *
 * `count` is derived from the travelers actually returned, not from the raw
 * Redis membership, so the header count can never disagree with the list.
 */
app.get('/api/room/:roomId', async (req, res) => {
  const roomId = req.params.roomId;
  if (!isValidRoomId(roomId)) return res.status(400).json({ error: 'Invalid room id.' });
  // Viewer is optional here; when present we hide anyone in a block relationship
  // with them (either direction). isBlocked is symmetric, so a block hides the
  // pair for both people.
  const viewer = actorId(req);
  if (!viewer && STRICT_AUTH) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    const userIds = await redisPresence.getRoom(roomId);

    const visibleIds = viewer
      ? userIds.filter(id => id === viewer || !connectionManager.isBlocked(viewer, id))
      : userIds;

    const travelers = visibleIds
      .map(id => persistence.getProfile(id) || roomManager.getUserProfile(id))
      .filter((p): p is UserProfile => !!p);

    // Per-user presence state from the key's remaining TTL, not a blanket
    // 'active' — a user whose heartbeat lapsed into the away window shows it.
    const states = await redisPresence.getStates(roomId, travelers.map(p => p.id));

    const body = travelers.map(p => ({
      id: p.id,
      username: p.username,
      pseudonym: p.pseudonym || (p.username || '').replace(/^@/, ''),
      avatarId: p.avatarId,
      avatarBg: p.avatarBg,
      interestTags: p.interestTags || [],
      bio: p.bio ?? '',
      trustTier: p.trustTier || 'regular',
      presenceState: states.get(p.id) || (p.id === viewer ? 'active' : 'away')
    }));

    res.json({ roomId, count: body.length, travelers: body });
  } catch (err) {
    // Redis being down must not take the process with it.
    console.error(`[room] ${roomId} lookup failed`, err);
    res.status(503).json({ error: 'Presence unavailable', roomId });
  }
});

app.post('/api/room/:roomId/heartbeat', async (req, res) => {
  const roomId = req.params.roomId;
  if (!isValidRoomId(roomId)) return res.status(400).json({ error: 'Invalid room id.' });
  // Identity comes from the token only — a body userId let anyone heartbeat as
  // (or, via leave, evict) another user.
  const userId = requireActor(req, res);
  if (!userId) return;
  try {
    await redisPresence.heartbeat(userId, roomId);
    res.json({ ok: true, roomId, userId });
  } catch (err) {
    console.error(`[room] ${roomId} heartbeat failed`, err);
    res.status(503).json({ error: 'Presence unavailable' });
  }
});

app.post('/api/room/:roomId/leave', async (req, res) => {
  const roomId = req.params.roomId;
  if (!isValidRoomId(roomId)) return res.status(400).json({ error: 'Invalid room id.' });
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    await redisPresence.leaveRoom(userId, roomId);
    res.json({ ok: true, roomId, userId });
  } catch (err) {
    console.error(`[room] ${roomId} leave failed`, err);
    res.status(503).json({ error: 'Presence unavailable' });
  }
});

// ── MVP2: Commute windows schedule (for client push scheduling) ──
app.get('/api/commute/windows', (_req, res) => {
  res.json({
    windows: [
      { label: 'Morning rush', start: '07:30', end: '10:30', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { label: 'Evening rush', start: '17:00', end: '20:30', days: ['Mon','Tue','Wed','Thu','Fri'] }
    ],
    isLiveNow: isCommuteWindowNow(),
    serverTime: new Date().toISOString(),
    beachhead: getBeachheadInfo()
  });
});

// Lightweight push subscription (MVP2 — stores token, socket push used for now).
// Identity comes from the token; a body userId is ignored.
const pushSubscriptions: Map<string, any> = new Map();
function hydratePushSubscriptions(): void {
  pushSubscriptions.clear();
  const stored = persistence.load().pushSubscriptions || {};
  for (const [uid, sub] of Object.entries(stored)) pushSubscriptions.set(uid, sub);
}
app.post('/api/push/subscribe', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const { subscription, commutePrefs } = req.body || {};
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    return res.status(400).json({ error: 'subscription object required' });
  }
  const endpoint = (subscription as any).endpoint;
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 1024) {
    return res.status(400).json({ error: 'subscription.endpoint must be a string (max 1024 chars)' });
  }
  if (JSON.stringify(subscription).length > 4096) return res.status(413).json({ error: 'subscription too large' });
  const prefs = commutePrefs && typeof commutePrefs === 'object' && !Array.isArray(commutePrefs)
    ? { morning: !!(commutePrefs as any).morning, evening: !!(commutePrefs as any).evening }
    : { morning: true, evening: true };
  const record = { subscription, commutePrefs: prefs, at: Date.now() };
  pushSubscriptions.set(me, record);
  const store = persistence.load();
  store.pushSubscriptions[me] = record;
  persistence.save(store);
  res.json({ ok: true, message: 'Subscribed for commute window pushes' });
});
app.get('/api/push/subscriptions', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ count: pushSubscriptions.size });
});

// ── MVP3: Engagement layer — snapshots + curated data ──
app.get('/api/engagement/:roomId', (req, res) => {
  if (!isSocketRoomId(req.params.roomId)) return res.status(400).json({ error: 'Invalid room id.' });
  res.json(engagement.getSnapshot(req.params.roomId));
});
app.get('/api/engagement/curated/prompts', (_req, res) => {
  const { PROMPTS } = require('./services/engagement/promptsData');
  res.json({ prompts: PROMPTS.slice(0, 6) });
});
app.get('/api/engagement/curated/trivia', (_req, res) => {
  const { TRIVIA_BANK } = require('./services/engagement/triviaData');
  res.json({ count: TRIVIA_BANK.length, sample: TRIVIA_BANK.slice(0, 3) });
});

function broadcastEngagement(roomId: string) {
  const snap = engagement.getSnapshot(roomId);
  io.to(roomId).emit('engagement_updated', snap);
}

// ── MVP4: Personalization & Network Effects ──
function enrichProfile(profile: UserProfile): UserProfile & { trustTier: string; trustBadge: string } {
  const trust = moderation.getTrustInfo(profile.id);
  return { ...profile, trustTier: trust.tier as any, trustBadge: trust.badge } as any;
}

app.get('/api/interests', (_req, res) => {
  res.json({ interests: INTEREST_TAXONOMY, count: INTEREST_TAXONOMY.length });
});

// Public profile (shown to fellow commuters) with trust + reputation.
app.get('/api/profile/:userId', (req, res) => {
  const p = persistence.getProfile(req.params.userId) || roomManager.getUserProfile(req.params.userId);
  if (!p) return res.status(404).json({ error: 'Profile not found' });
  const enriched = enrichProfile(p as UserProfile);
  const trust = moderation.getTrustInfo(req.params.userId);
  res.json({ profile: enriched, trust, reputation: moderation.getReputation(req.params.userId) });
});

function saveProfile(profile: UserProfile): void {
  persistence.appendProfile(profile);
  roomManager.setProfile(profile);
}

// Reputation bonus for completing a profile is granted once, not per PATCH —
// otherwise repeated saves farm the score up to "verified".
const profileBonusGranted = new Set<string>();

// Update profile — optional public enhancements (bio, tags, college, avatar, etc.)
app.patch('/api/profile/:userId', (req, res) => {
  const me = requireSelf(req, res, req.params.userId);
  if (!me) return;
  const existing = persistence.getProfile(me) || roomManager.getUserProfile(me);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });
  const body = req.body || {};
  const { pseudonym, bio, collegeOrTag, interestTags, avatarBg, avatarId, languages, favoriteStationId, favoriteLineId, vibeTagline } = body;
  const updated: UserProfile = { ...existing };

  if (pseudonym !== undefined) {
    const p = typeof pseudonym === 'string' ? validPseudonym(pseudonym) : null;
    if (!p) {
      return res.status(400).json({ error: 'Display name must be 2–20 characters and include a letter or number.' });
    }
    updated.pseudonym = p;
  }
  const b = optString(bio, 120); if (b !== undefined) updated.bio = b;
  const c = optString(collegeOrTag, 30); if (c !== undefined) updated.collegeOrTag = c;
  if (Array.isArray(interestTags)) updated.interestTags = sanitizeTags(interestTags);
  if (typeof avatarBg === 'string' && AVATAR_BG_RE.test(avatarBg.trim()) && avatarBg.length <= 120) updated.avatarBg = avatarBg.trim();
  if (typeof avatarId === 'string' && SLUG_RE.test(avatarId)) updated.avatarId = avatarId;
  if (Array.isArray(languages)) {
    updated.languages = languages
      .filter((l: unknown): l is string => typeof l === 'string')
      .map(l => cleanText(l).slice(0, 10))
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof favoriteStationId === 'string' && (favoriteStationId === '' || SLUG_RE.test(favoriteStationId))) updated.favoriteStationId = favoriteStationId;
  if (typeof favoriteLineId === 'string' && (favoriteLineId === '' || SLUG_RE.test(favoriteLineId))) updated.favoriteLineId = favoriteLineId;
  const v = optString(vibeTagline, 30); if (v !== undefined) updated.vibeTagline = v;

  saveProfile(updated);
  if (!profileBonusGranted.has(me)) {
    profileBonusGranted.add(me);
    moderation.recordPositive(me, 1);
  }
  res.json({ profile: enrichProfile(updated), trust: moderation.getTrustInfo(me) });
});

// DELETE /api/profile/:userId — Google Play Mandatory Account Deletion Policy
app.delete('/api/profile/:userId', async (req, res) => {
  const userId = req.params.userId;
  const caller = actorId(req);
  if (!caller) return res.status(401).json({ error: 'Sign-in required.' });
  if (caller !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this account.' });
  }

  try {
    connectionManager.purgeUser(userId);

    const store = persistence.load();
    if (store.profiles) delete store.profiles[userId];
    // Chat threads, read markers, saved commutes and push registrations belong
    // to the account too — the in-app copy promises they are erased.
    for (const key of Object.keys(store.directMessages || {})) {
      if (key.split('::').includes(userId)) delete store.directMessages[key];
    }
    for (const key of Object.keys(store.reads || {})) {
      if (key.split('::').includes(userId)) delete store.reads[key];
    }
    if (store.commutePatterns) delete store.commutePatterns[userId];
    if (store.pushSubscriptions) delete store.pushSubscriptions[userId];
    persistence.save(store);

    pushSubscriptions.delete(userId);
    roomManager.forgetProfile(userId);
    moderation.forgetUser(userId);
    profileBonusGranted.delete(userId);

    // Drop any live sockets for this account.
    for (const sid of userIdToSocketIds.get(userId) || []) {
      io.sockets.sockets.get(sid)?.disconnect(true);
    }
    userIdToSocketIds.delete(userId);

    // Deletion is a promise to the user — write it out now, not on the debounce.
    await persistence.flushNow();

    return res.json({ ok: true, message: 'Account and associated data permanently deleted.' });
  } catch (err) {
    console.error('[delete profile] failed', err);
    return res.status(500).json({ error: 'Could not complete account deletion.' });
  }
});

app.get('/api/reputation/:userId', (req, res) => {
  const trust = moderation.getTrustInfo(req.params.userId);
  res.json({ ...trust, reputation: moderation.getReputation(req.params.userId) });
});

/** Viewer for ranking: the token's user; legacy query/param only without one. */
function resolveViewer(req: express.Request, res: express.Response, legacy: unknown): string | null {
  const me = actorId(req);
  if (me) return me;
  if (STRICT_AUTH) { res.status(401).json({ error: 'Sign-in required.' }); return null; }
  if (!isId(legacy)) { res.status(400).json({ error: 'viewerId required' }); return null; }
  return legacy;
}

// Smart ranking + vibe recommendations
app.get('/api/rank/:roomId', (req, res) => {
  const viewerId = resolveViewer(req, res, req.query.viewerId);
  if (!viewerId) return;
  const ranked = rankingService.rankForViewer(viewerId, req.params.roomId, false);
  const out = ranked.map(r => ({
    profile: enrichProfile(r.profile as UserProfile),
    score: r.score,
    breakdown: r.breakdown,
    mutualTags: r.mutualTags,
    mutualCount: r.mutualCount,
    trustTier: r.trustTier,
    trustBadge: r.trustBadge
  }));
  res.json({ ranked: out, count: out.length });
});

app.get('/api/vibe/:roomId/:viewerId', (req, res) => {
  const viewerId = resolveViewer(req, res, req.params.viewerId);
  if (!viewerId) return;
  const vibe = rankingService.vibeForViewer(viewerId, req.params.roomId, 3);
  const out = vibe.map(r => ({
    profile: enrichProfile(r.profile as UserProfile),
    score: r.score,
    mutualTags: r.mutualTags,
    mutualCount: r.mutualCount,
    trustBadge: r.trustBadge
  }));
  res.json({ vibe: out });
});

// ── Saved commute patterns — one-tap repeat entry ──
// Owner is always the token's user. The :userId in the URL is kept for client
// compatibility and must match it.
app.post('/api/commute/patterns', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const b = req.body || {};
  const data: any = { isActive: true };
  if (b.lineId !== undefined) { if (typeof b.lineId !== 'string' || !SLUG_RE.test(b.lineId)) return res.status(400).json({ error: 'Invalid lineId' }); data.lineId = b.lineId; }
  if (b.stationId !== undefined) { if (typeof b.stationId !== 'string' || !SLUG_RE.test(b.stationId)) return res.status(400).json({ error: 'Invalid stationId' }); data.stationId = b.stationId; }
  if (b.lineColor !== undefined) { if (typeof b.lineColor !== 'string' || !HEX_COLOR_RE.test(b.lineColor)) return res.status(400).json({ error: 'Invalid lineColor' }); data.lineColor = b.lineColor; }
  if (b.targetTime !== undefined) { if (typeof b.targetTime !== 'string' || !TIME_RE.test(b.targetTime)) return res.status(400).json({ error: 'targetTime must be HH:MM' }); data.targetTime = b.targetTime; }
  if (b.daysOfWeek !== undefined) {
    if (!Array.isArray(b.daysOfWeek) || !b.daysOfWeek.every((d: unknown) => typeof d === 'string' && WEEKDAYS.includes(d))) {
      return res.status(400).json({ error: `daysOfWeek must be a list of ${WEEKDAYS.join('/')}` });
    }
    data.daysOfWeek = Array.from(new Set(b.daysOfWeek as string[]));
  }
  const lineName = optString(b.lineName, 60); if (lineName) data.lineName = lineName;
  const stationName = optString(b.stationName, 60); if (stationName) data.stationName = stationName;
  const direction = optString(b.direction, 80); if (direction) data.direction = direction;
  const label = optString(b.label, 30); if (label) data.label = label;
  const pat = commuteService.savePattern(me, data);
  res.status(201).json({ pattern: pat });
});
app.get('/api/commute/patterns/:userId', (req, res) => {
  const me = requireSelf(req, res, req.params.userId);
  if (!me) return;
  res.json({ patterns: commuteService.getPatterns(me) });
});
app.delete('/api/commute/patterns/:userId/:patternId', (req, res) => {
  const me = requireSelf(req, res, req.params.userId);
  if (!me) return;
  const ok = commuteService.deletePattern(me, req.params.patternId);
  if (!ok) return res.status(404).json({ ok: false, error: 'Pattern not found' });
  res.json({ ok });
});
app.post('/api/commute/patterns/:userId/:patternId/use', (req, res) => {
  const me = requireSelf(req, res, req.params.userId);
  if (!me) return;
  const pat = commuteService.markUsed(me, req.params.patternId);
  if (!pat) return res.status(404).json({ error: 'Pattern not found' });
  // also create context detection for one-tap
  const ctx = contextEngine.evaluate({
    userId: me,
    timestamp: Date.now(),
    cellTowerId: undefined as any,
    lat: undefined as any,
    lng: undefined as any,
    movementState: 'WALKING',
    userConfirmed: true
  });
  // override to pattern's station/line
  const room = roomManager.getOrCreateFromContext({ ...ctx, station: pat.stationId, stationName: pat.stationName, line: pat.lineId, lineName: pat.lineName, lineColor: pat.lineColor, direction: pat.direction } as any);
  logEvent('commute_pattern_used', me, { patternId: pat.id, station: pat.stationName });
  res.json({ pattern: pat, context: { ...ctx, station: pat.stationId, stationName: pat.stationName, line: pat.lineId, lineName: pat.lineName, direction: pat.direction }, room: roomManager.serializeRoom(room.id) });
});

// Random Telegram-style profile — creates a new anonymous account.
app.get('/api/auth/random-profile', (req, res) => {
  const lim = signupLimiter.hit(`ip:${req.ip || 'unknown'}`);
  if (!lim.ok) return sendRateLimited(res, lim.retryAfterSec, 'Too many new profiles from this network. Try again shortly.');
  const p = getRandomTelegramProfile();
  const profile: UserProfile = {
    id: `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    username: p.username,
    pseudonym: p.pseudonym,
    avatarId: p.avatarId,
    avatarBg: p.avatarBg,
    interestTags: p.interestTags,
    collegeOrTag: 'Metro Commuter',
    activity: 'STILL',
    joinedAt: Date.now(),
    karmaScore: 100
  };
  // persist for retention
  persistence.appendProfile(profile);
  res.json({ profile, token: signToken(profile.id), avatarPalette: AVATAR_PALETTE });
});

// Restore existing profile (for retention after reload). The caller must already
// hold this user's signed token — user ids are public (room lists expose them),
// so minting a token from a bare id would let anyone take over any account.
app.get('/api/auth/restore/:userId', (req, res) => {
  if (actorId(req) !== req.params.userId) {
    return res.status(401).json({ error: 'Not authorized to restore this profile.' });
  }
  const profile = persistence.getProfile(req.params.userId) || roomManager.getUserProfile(req.params.userId);
  if (profile) {
    res.json({ profile, token: signToken(profile.id), restored: true });
  } else {
    res.status(404).json({ error: 'Profile not found' });
  }
});

// Update the caller's interest tags (validated against the interest taxonomy).
app.patch('/api/user/:userId/tags', (req, res) => {
  const me = requireSelf(req, res, req.params.userId);
  if (!me) return;
  const rawTags = req.body?.tags;
  if (!Array.isArray(rawTags)) return res.status(400).json({ error: 'tags must be an array of interest ids' });
  const valid = sanitizeTags(rawTags);
  const existing = persistence.getProfile(me) || roomManager.getUserProfile(me);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  // Previously the sanitized tags were computed but never written back.
  const profile: UserProfile = { ...existing, interestTags: valid };
  saveProfile(profile);
  res.json({ profile, tags: valid });
});

// Lightweight analytics ingest (north-star signals). The user is taken from
// the token; unauthenticated events are recorded as anonymous.
const EVENT_NAME_RE = /^[a-z0-9_]{1,64}$/;
app.post('/api/analytics/event', (req, res) => {
  const { event, payload } = req.body || {};
  if (typeof event !== 'string' || !EVENT_NAME_RE.test(event)) {
    return res.status(400).json({ error: 'event must be a snake_case name (max 64 chars)' });
  }
  const lim = analyticsLimiter.hit((req as any).rateKey || rateKey(req));
  // Over the limit: drop silently — analytics must never surface errors in the app.
  if (!lim.ok) return res.status(202).json({ ok: true, dropped: true });
  let safePayload: unknown = undefined;
  if (payload !== undefined) {
    try {
      const s = JSON.stringify(payload);
      safePayload = s.length <= 2048 ? payload : { truncated: true };
    } catch {
      safePayload = { invalid: true };
    }
  }
  logEvent(event, actorId(req), safePayload);
  res.json({ ok: true });
});

// Analytics summary (north-star signals) — moderator only: it lists user ids.
app.get('/api/analytics/summary', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const events = await readEvents();
    const count = (name: string) => events.filter(e => e.event === name).length;
    const unique = (name: string) => new Set(events.filter(e => e.event === name).map(e => e.userId)).size;
    const avgTravelersSeen = (() => {
      const seen = events.filter(e => e.event === 'travelers_seen');
      if (!seen.length) return 0;
      const sum = seen.reduce((acc, e) => acc + (e.payload?.count || 0), 0);
      return Math.round(sum / seen.length);
    })();
    res.json({
      totalEvents: events.length,
      activatedUsers: unique('activated_user'),
      sessionStarts: count('session_start'),
      travelersSeenAvg: avgTravelersSeen,
      profileOpens: count('profile_open'),
      connectionRequests: count('connection_request_sent'),
      connectionAccepted: count('connection_accepted'),
      mutualAcceptanceRate: count('connection_request_sent') ? (count('connection_accepted') / count('connection_request_sent')) : 0,
      ephemeralMessages: count('ephemeral_message_sent'),
      dms: count('dm_sent'),
      contextDetects: count('context_detected'),
      manualConfirms: count('manual_context_confirm'),
      meaningfulLiveSessions: count('meaningful_live_session'),
      meaningfulPerCommuter: unique('activated_user') ? (count('meaningful_live_session') / unique('activated_user')) : 0,
      commutePushes: count('commute_window_push_received'),
      reports: count('user_reported'),
      blocks: count('user_blocked'),
      lastEvents: events.slice(-20).reverse()
    });
  } catch (e) {
    console.error('[analytics] summary failed', e);
    res.status(500).json({ error: 'Could not read analytics.' });
  }
});

// Moderation queue (reports contain reporter ids and free text) — moderator only.
app.get('/api/admin/reports', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ reports: persistence.load().reports || [] });
});
app.get('/api/moderation/reports', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ reports: persistence.load().reports || [] });
});

app.post('/api/admin/resolve/:reportId', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = persistence.load();
  const r = (store.reports || []).find((x: any) => x.id === req.params.reportId);
  if (r) {
    r.resolved = true;
    persistence.save(store);
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'not found' });
  }
});

// ── Transit Context Engine: auto-detect ──
const MOVEMENT_STATES = ['STILL', 'WALKING', 'IN_VEHICLE'];
app.post('/api/context/detect', (req, res) => {
  const b = req.body || {};
  // Identity from the token. Legacy clients without one fall back to the body
  // userId (refused under STRICT_AUTH); a token always wins over the body.
  const me = actorId(req);
  if (!me && STRICT_AUTH) return res.status(401).json({ error: 'Sign-in required.' });
  const userId = me || (isId(b.userId) ? b.userId : 'anonymous');

  const routeHistory = Array.isArray(b.routeHistory)
    ? b.routeHistory
        .slice(-50)
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng), t: Number(p.t) }))
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t))
    : undefined;

  const ctx = contextEngine.evaluate({
    userId,
    timestamp: Date.now(),
    lat: finiteOrUndef(b.lat, -90, 90),
    lng: finiteOrUndef(b.lng, -180, 180),
    cellTowerId: typeof b.cellTowerId === 'string' ? b.cellTowerId.slice(0, 64) : undefined,
    movementState: MOVEMENT_STATES.includes(b.movementState) ? b.movementState : 'IN_VEHICLE',
    speedKmh: finiteOrUndef(b.speedKmh, 0, 400),
    routeHistory: routeHistory && routeHistory.length ? routeHistory : undefined,
    userConfirmed: !!b.userConfirmed,
    headingDegrees: finiteOrUndef(b.headingDegrees, 0, 360),
    userConfirmedDirection: optString(b.userConfirmedDirection, 80) || undefined
  });

  // Create/find the room for this context
  const room = roomManager.getOrCreateFromContext(ctx);

  res.json({
    context: ctx,
    room: roomManager.serializeRoom(room.id)
  });
});

// ── Path & Trajectory Engine: 1-Tap Direction Override ──
app.post('/api/context/direction-override', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const { lineId, direction } = req.body || {};
  if (typeof lineId !== 'string' || !SLUG_RE.test(lineId) || typeof direction !== 'string' || !cleanText(direction)) {
    return res.status(400).json({ error: 'lineId and direction are required' });
  }
  const dir = cleanText(direction).slice(0, 80);

  const tracker = PathTrackerEngine.getInstance();
  tracker.setDirectionOverride(me, lineId, dir);

  // Evaluate updated context with confirmed direction
  const ctx = contextEngine.evaluate({
    userId: me,
    timestamp: Date.now(),
    movementState: 'IN_VEHICLE',
    userConfirmed: true,
    userConfirmedDirection: dir
  });

  const room = roomManager.getOrCreateFromContext(ctx);

  res.json({
    ok: true,
    context: ctx,
    room: roomManager.serializeRoom(room.id),
    trip: tracker.getTrip(me)
  });
});

// Friends list — enriched with trust (MVP4 network effect). Private.
app.get('/api/friends/:userId', (req, res) => {
  if (!selfOrLegacy(req, res, req.params.userId)) return;
  const friendIds = connectionManager.getFriendIds(req.params.userId);
  const friends = friendIds.map(fid => {
    const profile = lookupProfile(fid);
    if (!profile) return null;
    const t = moderation.getTrustInfo(fid);
    return {
      id: fid,
      profile: { ...profile, trustTier: t.tier, trustBadge: t.badge },
      presenceTier: presence.getTier(fid)
    };
  }).filter(Boolean);
  res.json({ friends });
});

// Pending connection requests. Private.
app.get('/api/connections/pending/:userId', (req, res) => {
  if (!selfOrLegacy(req, res, req.params.userId)) return;
  const pending = connectionManager.getPendingRequestsFor(req.params.userId);
  const enriched = pending.map(r => ({
    ...r,
    fromProfile: lookupProfile(r.fromUserId)
  }));
  res.json({ pending: enriched });
});
app.get('/api/connections/sent/:userId', (req, res) => {
  if (!selfOrLegacy(req, res, req.params.userId)) return;
  const sent = connectionManager.getSentRequestsFor(req.params.userId);
  const enriched = sent.map(r => ({
    ...r,
    toProfile: lookupProfile(r.toUserId)
  }));
  res.json({ sent: enriched });
});
app.get('/api/connections/history/:userId', (req, res) => {
  // No shipped client calls this — token required.
  if (!requireSelf(req, res, req.params.userId)) return;
  res.json({ history: connectionManager.getAllRequestsFor(req.params.userId) });
});

// ── REST connection API (used by the room profile sheet) ──────────────

/** Same side effects as the socket path: notify both users, bump trust. */
function onConnectionAccepted(fromUserId: string, toUserId: string, message: string): void {
  emitToUsers([fromUserId, toUserId], 'connection_accepted', { userA: fromUserId, userB: toUserId, message });
  moderation.recordPositive(fromUserId, 5);
  moderation.recordPositive(toUserId, 5);
}

// POST /api/connections { targetId } → create a pending request
app.post('/api/connections', (req, res) => {
  const from = requireActor(req, res);
  if (!from) return;
  const targetId = req.body?.targetId;
  if (!isId(targetId)) return res.status(400).json({ error: 'targetId is required.' });
  if (from === targetId) return res.status(400).json({ error: 'Cannot connect to yourself.' });
  if (!profileExists(targetId)) return res.status(404).json({ error: 'That commuter is no longer on CoRide.' });

  const rate = connectionLimiter.hit(from);
  if (!rate.ok) return sendRateLimited(res, rate.retryAfterSec, 'Rate limit: 20 connection requests per hour.');

  // sendRequest already guards blocked / already-friends / duplicate, and
  // auto-accepts a reciprocal pending request.
  const result = connectionManager.sendRequest(from, targetId);
  if (!result.success) return res.status(409).json({ error: result.message });
  if (result.request?.status === 'accepted') {
    onConnectionAccepted(result.request.fromUserId, result.request.toUserId, '🎉 You are now connected!');
  }
  return res.status(201).json({ request: result.request, remaining: rate.remaining });
});

// POST /api/connections/:id/accept
app.post('/api/connections/:id/accept', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const result = connectionManager.acceptRequest(req.params.id, me);
  if (!result.success) {
    return res.status(result.message === 'Request not found.' ? 404 : 403).json({ error: result.message });
  }
  if (result.request) {
    onConnectionAccepted(result.request.fromUserId, result.request.toUserId, '🎉 Connected!');
  }
  return res.json({ request: result.request });
});

// POST /api/connections/:id/decline
app.post('/api/connections/:id/decline', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const result = connectionManager.declineRequest(req.params.id, me);
  if (!result.success) {
    return res.status(result.message === 'Request not found.' ? 404 : 403).json({ error: result.message });
  }
  return res.json({ ok: true });
});

// GET /api/connections → my friends + pending in/out
app.get('/api/connections', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const friends = connectionManager.getFriendIds(me).map(fid => ({
    id: fid,
    profile: lookupProfile(fid)
  }));
  const incoming = connectionManager.getPendingRequestsFor(me).map(r => ({
    ...r, fromProfile: lookupProfile(r.fromUserId)
  }));
  const outgoing = connectionManager.getSentRequestsFor(me).map(r => ({
    ...r, toProfile: lookupProfile(r.toUserId)
  }));
  return res.json({ friends, pending: { incoming, outgoing } });
});

// DM history (REST fallback for initial load)
app.get('/api/dm/:userId/:friendId', (req, res) => {
  // Auth: the caller must BE one of the two participants.
  const me = actorId(req);
  const { userId, friendId } = req.params;
  if (!me) return res.status(401).json({ error: 'Sign-in required.' });
  if (me !== userId && me !== friendId) {
    return res.status(403).json({ error: 'Not your conversation.' });
  }
  const store = persistence.load();
  const key = [userId, friendId].sort().join('::');
  const history = store.directMessages[key] || [];
  res.json({ messages: history.slice(-50) });
});

// ── REST report & block (used by the profile/report sheet) ────────────
const REPORT_CATEGORIES = ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'];

// POST /api/reports { targetId, category, note }
app.post('/api/reports', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const { targetId, category, note } = req.body || {};
  if (!isId(targetId)) return res.status(400).json({ error: 'targetId is required.' });
  if (me === targetId) return res.status(400).json({ error: 'You cannot report yourself.' });
  if (!REPORT_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${REPORT_CATEGORIES.join(', ')}` });
  }
  const lim = reportLimiter.hit(me);
  if (!lim.ok) return sendRateLimited(res, lim.retryAfterSec, 'Too many reports. Try again later.');
  // reportUser stores a single reason string; fold the optional note into it.
  const cleanNote = optString(note, 500);
  const reason = cleanNote ? `${category}: ${cleanNote}` : category;
  const result = connectionManager.reportUser(me, targetId, reason);
  return res.status(201).json({ message: result.message });
});

// POST /api/blocks { targetId }
app.post('/api/blocks', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const targetId = req.body?.targetId;
  if (!isId(targetId)) return res.status(400).json({ error: 'targetId is required.' });
  if (me === targetId) return res.status(400).json({ error: 'You cannot block yourself.' });
  const result = connectionManager.blockUser(me, targetId);
  return res.status(201).json({ message: result.message });
});

// DELETE /api/blocks/:id — :id is the blocked user's id
app.delete('/api/blocks/:id', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const result = connectionManager.unblock(me, req.params.id);
  if (!result.success) return res.status(404).json({ error: result.message });
  return res.json({ ok: true });
});

// GET /api/blocks → returns blocked users for the actor
app.get('/api/blocks', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const blockedIds = connectionManager.getBlockedIds(me);
  const blockedUsers = blockedIds.map(id => {
    const p = persistence.getProfile(id) || roomManager.getUserProfile(id);
    return {
      id,
      pseudonym: p?.pseudonym || p?.username?.replace('@', '') || 'Commuter',
      username: p?.username || `@user_${id.slice(0, 6)}`,
      avatarBg: p?.avatarBg || '#2A2F39'
    };
  });
  return res.json({ blockedUsers });
});

// ── REST 1:1 chat (accepted connections only) ────────────────────────
// A 1:1 chat is identified by the peer's id, so :id IS the other user's id —
// no separate chat-id scheme.
const dmKey = (a: string, b: string) => [a, b].sort().join('::');
const DM_THREAD_CAP = 200;

/** Append a DM to its thread (capped) and persist. */
function storeDm(dm: { senderId: string; receiverId: string }): void {
  const store = persistence.load();
  const key = dmKey(dm.senderId, dm.receiverId);
  if (!store.directMessages[key]) store.directMessages[key] = [];
  store.directMessages[key].push(dm);
  if (store.directMessages[key].length > DM_THREAD_CAP) store.directMessages[key] = store.directMessages[key].slice(-DM_THREAD_CAP);
  persistence.save(store);
}

// GET /api/chats → one entry per accepted connection, newest activity first.
app.get('/api/chats', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const store = persistence.load();
  const chats = connectionManager.getFriendIds(me).map(peerId => {
    const thread = store.directMessages[dmKey(me, peerId)] || [];
    const last = thread[thread.length - 1];
    const lastReadAt = store.reads[`${me}::${peerId}`] || 0;
    return {
      id: peerId,
      peer: lookupProfile(peerId),
      lastMessage: last ? { content: last.content, timestamp: last.timestamp, senderId: last.senderId } : null,
      // Unread = messages from the peer newer than my lastReadAt for this chat.
      unread: thread.filter((m: any) => m.senderId === peerId && m.timestamp > lastReadAt).length
    };
  });
  chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  return res.json({ chats });
});

// GET /api/chats/:id/messages → thread history (last 50)
app.get('/api/chats/:id/messages', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const peerId = req.params.id;
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const store = persistence.load();
  const history = (store.directMessages[dmKey(me, peerId)] || []).slice(-50);
  return res.json({ messages: history });
});

// POST /api/chats/:id/messages { content }
app.post('/api/chats/:id/messages', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const peerId = req.params.id;
  const v = validateMessage(req.body?.content);
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const check = moderation.preCheck(me, 'message', v.content);
  if (!check.allowed) return res.status(429).json({ error: check.message });

  const dm = { id: newId('dm'), senderId: me, receiverId: peerId, content: v.content, timestamp: Date.now(), read: false };
  storeDm(dm);
  // Mirror to any live socket so the peer's open chat/DM view still updates.
  emitToUsers([me, peerId], 'new_dm', dm);
  return res.status(201).json({ message: dm });
});

// POST /api/chats/:id/read — mark this chat read up to now for the caller.
app.post('/api/chats/:id/read', (req, res) => {
  const me = requireActor(req, res);
  if (!me) return;
  const peerId = req.params.id;
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const now = Date.now();
  const store = persistence.load();
  store.reads[`${me}::${peerId}`] = now;
  persistence.save(store);
  return res.json({ ok: true, lastReadAt: now });
});

// ── Fallthrough: unknown API routes and errors are always JSON ──
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
  const status = Number(err?.status || err?.statusCode);
  if (status >= 400 && status < 500) return res.status(status).json({ error: err?.expose ? err.message : 'Bad request.' });
  console.error(`[http] ${req.method} ${req.originalUrl} failed`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ────────────────────────────────────────
//  SOCKET.IO REALTIME
// ────────────────────────────────────────

// Socket identity, with the same trust model as REST: the server resolves who
// the client is from the SIGNED token in the handshake (`auth: { token }`),
// never from a client-sent user object or userId. Every identity-bearing
// event requires an authenticated socket; payload `user`/`userId` fields are
// accepted for protocol compatibility but ignored.
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token;
  if (typeof token === 'string' && token) {
    const uid = verifyToken(token);
    const profile = uid ? (persistence.getProfile(uid) || roomManager.getUserProfile(uid) || null) : null;
    // A bad signature is a spoof attempt; a valid token for a deleted account
    // is stale. Both are rejected so the client re-onboards.
    if (!uid || !profile) return next(new Error('unknown traveler'));
    socket.data.userId = uid;
    socket.data.profile = profile;
    registerUserSocket(uid, socket.id);
    return next();
  }
  // No token — connection allowed (public broadcasts only); identity-bearing
  // handlers reject it.
  socket.data.userId = null;
  socket.data.profile = null;
  next();
});

// Live presence diff for a room: emit the authoritative PTTL-derived state so
// connected clients can update without polling. state === null means "left".
function broadcastPresence(roomId: string, userId: string | null): void {
  void (async () => {
    try {
      const state = userId ? await redisPresence.getState(userId, roomId) : null;
      io.to(roomId).emit('presence_updated', {
        roomId,
        userId,
        state,
        timestamp: Date.now()
      });
    } catch (err) {
      // Redis down: presence diffs are best-effort.
    }
  })();
}

// While Redis is down every join/heartbeat fails; log at most once a minute.
let lastRedisFailureLog = 0;
function logRedisFailure(op: string) {
  return (err: unknown) => {
    const now = Date.now();
    if (now - lastRedisFailureLog < 60_000) return;
    lastRedisFailureLog = now;
    console.warn(`[presence] ${op} failed (further failures muted for 60s):`, (err as any)?.message || err);
  };
}

// Per-socket flood guard: generous enough for typing indicators and games,
// tight enough that one client can't saturate the event loop.
const socketEventLimiter = new RateLimiter(Number(process.env.SOCKET_EVENTS_PER_10S) || 100, 10_000);
const REACTION_EMOJI = ['❤️','😂','🔥','👏','😮','🙏','👍','☕','🎧','🚇'];
const GAME_TYPES = ['word_chain', 'twenty_q', 'trivia', 'prompt'];

io.on('connection', (socket) => {
  if (!IS_PRODUCTION) console.log(`[Connected] ${socket.id}${socket.data.userId ? ` (${socket.data.userId})` : ''}`);

  /**
   * Register a guarded handler: rate-limited, payload normalised to an object
   * (so destructuring can't throw), and any throw/rejection becomes an
   * `error_message` instead of an uncaught exception.
   */
  const on = (event: string, handler: (payload: any) => unknown) => {
    socket.on(event, (...args: any[]) => {
      const lim = socketEventLimiter.hit(socket.id);
      if (!lim.ok) {
        if (!socket.data.floodWarned) {
          socket.data.floodWarned = true;
          socket.emit('error_message', { error: 'Slow down — too many actions at once.' });
        }
        return;
      }
      socket.data.floodWarned = false;
      const payload = args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? args[0] : {};
      try {
        const r: any = handler(payload);
        if (r && typeof r.then === 'function') {
          r.catch((err: unknown) => {
            console.error(`[socket] ${event} failed`, err);
            socket.emit('error_message', { error: 'Something went wrong.' });
          });
        }
      } catch (err) {
        console.error(`[socket] ${event} failed`, err);
        socket.emit('error_message', { error: 'Something went wrong.' });
      }
    });
  };

  /** The authenticated profile, or null after telling the client why. */
  const authed = (): UserProfile | null => {
    const profile: UserProfile | null = socket.data.profile;
    if (!socket.data.userId || !profile) {
      socket.emit('error_message', { error: 'Authentication required.' });
      return null;
    }
    return profile;
  };
  /** Actions that broadcast into a room require having joined it. */
  const inRoom = (roomId: unknown): roomId is string => isSocketRoomId(roomId) && socket.rooms.has(roomId);

  // ── Join Room ──
  on('join_room', ({ roomId }: { roomId?: string; user?: UserProfile }) => {
    const profile = authed();
    if (!profile) return;
    if (!isSocketRoomId(roomId)) {
      socket.emit('error_message', { error: 'Invalid room.' });
      return;
    }
    // Pick up profile edits made since the handshake.
    const fresh: UserProfile = persistence.getProfile(profile.id) || roomManager.getUserProfile(profile.id) || profile;
    socket.data.profile = fresh;

    if (isPresenceRoomId(roomId)) {
      socket.join(roomId);
      if (!socketPresenceRooms.has(socket.id)) socketPresenceRooms.set(socket.id, new Set());
      socketPresenceRooms.get(socket.id)!.add(roomId);
      redisPresence.joinRoom(fresh.id, roomId).catch(logRedisFailure('join'));
      broadcastPresence(roomId, fresh.id);
      return;
    }

    try {
      roomManager.joinRoom(roomId, fresh, socket.id);
    } catch (err: any) {
      socket.emit('error_message', { error: err?.message || 'Room not available.' });
      return;
    }
    socket.join(roomId);
    const serialized = roomManager.serializeRoom(roomId);
    io.to(roomId).emit('room_updated', serialized);
    broadcastPresence(roomId, fresh.id);
  });

  // ── Presence Heartbeat — MVP2: keep live, touch TTL ──
  on('heartbeat', ({ roomId }: { roomId?: string }) => {
    const userId: string | null = socket.data.userId;
    if (!userId || !inRoom(roomId)) return;
    if (isPresenceRoomId(roomId)) {
      redisPresence.heartbeat(userId, roomId).catch(logRedisFailure('heartbeat'));
    } else {
      presence.heartbeat(userId, roomId, socket.id);
      roomManager.touchRoom(roomId);
    }
    broadcastPresence(roomId, userId);
  });

  // ── Leave Room (explicit switch) ──
  on('leave_room', ({ roomId }: { roomId?: string; userId?: string }) => {
    const userId: string | null = socket.data.userId;
    if (!isSocketRoomId(roomId)) return;

    if (isPresenceRoomId(roomId)) {
      socketPresenceRooms.get(socket.id)?.delete(roomId);
      if (userId) redisPresence.leaveRoom(userId, roomId).catch(logRedisFailure('leave'));
      socket.leave(roomId);
      broadcastPresence(roomId, null);
      return;
    }

    if (userId) {
      const leaveMsg = roomManager.leaveRoom(roomId, userId, 'switch');
      const serialized = roomManager.serializeRoom(roomId);
      if (serialized) io.to(roomId).emit('room_updated', serialized);
      if (leaveMsg) io.to(roomId).emit('new_message', leaveMsg);
      broadcastPresence(roomId, null);
    }
    socket.leave(roomId);
  });

  // ── Typing indicators (ephemeral) ──
  on('typing_start', ({ roomId }: { roomId?: string; user?: UserProfile }) => {
    const profile: UserProfile | null = socket.data.profile;
    if (!profile || !inRoom(roomId)) return;
    socket.to(roomId).emit('user_typing', { roomId, userId: profile.id, pseudonym: profile.pseudonym, avatarBg: profile.avatarBg });
  });
  on('typing_stop', ({ roomId }: { roomId?: string; userId?: string }) => {
    const uid: string | null = socket.data.userId;
    if (!uid || !inRoom(roomId)) return;
    socket.to(roomId).emit('user_stop_typing', { roomId, userId: uid });
  });

  // ── Send Message (with moderation) — touch room ephemeral ttl ──
  on('send_message', ({ roomId, content }: { roomId?: string; content?: string; user?: UserProfile }) => {
    const profile = authed();
    if (!profile) return;
    const v = validateMessage(content);
    if (!v.ok) {
      if (typeof content === 'string' && content.trim()) socket.emit('error_message', { error: v.error });
      return;
    }
    if (!inRoom(roomId)) {
      socket.emit('error_message', { error: 'Join the room before sending.' });
      return;
    }

    const check = moderation.preCheck(profile.id, 'message', v.content);
    if (!check.allowed) {
      socket.emit('moderation_action', { type: 'message_blocked', message: check.message });
      return;
    }

    // Redis-presence room: ephemeral broadcast, no persistence (matches the
    // live-room model — messages exist only while the room is attended).
    if (isPresenceRoomId(roomId)) {
      const msg = {
        id: newId('msg'),
        roomId,
        senderId: profile.id,
        senderUsername: profile.username,
        senderPseudonym: profile.pseudonym,
        senderAvatarId: profile.avatarId,
        senderAvatarBg: profile.avatarBg,
        content: v.content,
        timestamp: Date.now(),
        type: 'text'
      };
      io.to(roomId).emit('new_message', msg);
      socket.emit('message_ack', msg);
      return;
    }

    // Legacy context room: addMessage throws for an unknown/expired room; the
    // guarded `on` turns that into an error_message instead of a crash.
    const msg = roomManager.addMessage(roomId, profile, v.content);
    roomManager.touchRoom(roomId);
    io.to(roomId).emit('new_message', msg);
    socket.emit('message_ack', msg);
    const upd = roomManager.serializeRoom(roomId);
    if (upd) io.to(roomId).emit('room_updated', upd);
  });

  // ── Connection Request ──
  on('connect_request', ({ toUserId, contextLine, contextStation }: {
    fromUser?: UserProfile; toUserId?: string; contextLine?: string; contextStation?: string;
  }) => {
    // Actor is the authenticated socket, never a client-supplied fromUser.id.
    const profile = authed();
    if (!profile) return;
    const me = profile.id;
    if (!isId(toUserId) || toUserId === me) {
      socket.emit('connection_result', { success: false, message: 'Invalid request.' });
      return;
    }
    if (!profileExists(toUserId)) {
      socket.emit('connection_result', { success: false, message: 'That commuter is no longer on CoRide.' });
      return;
    }
    const rateCheck = moderation.checkRateLimit(me, 'connection_request');
    if (!rateCheck.allowed) {
      socket.emit('moderation_action', { type: 'rate_limited', message: rateCheck.message });
      return;
    }

    const result = connectionManager.sendRequest(me, toUserId, optString(contextLine, 60) || '', optString(contextStation, 60) || '');
    socket.emit('connection_result', result);

    // If it auto-accepted (mutual), notify only those two users
    if (result.request?.status === 'accepted') {
      emitToUsers([result.request.fromUserId, result.request.toUserId], 'connection_accepted', {
        userA: result.request.fromUserId,
        userB: result.request.toUserId,
        message: '🎉 You are now connected!'
      });
      moderation.recordPositive(result.request.fromUserId, 5);
      moderation.recordPositive(result.request.toUserId, 5);
    }
  });

  // ── Accept Connection — network effect: stronger retention via mutual trust ──
  on('accept_connection', ({ requestId }: { requestId?: string; userId?: string }) => {
    const profile = authed();
    if (!profile) return;
    if (!isId(requestId)) { socket.emit('connection_result', { success: false, message: 'Request not found.' }); return; }
    const result = connectionManager.acceptRequest(requestId, profile.id);
    if (result.success && result.request) {
      emitToUsers([result.request.fromUserId, result.request.toUserId], 'connection_accepted', {
        userA: result.request.fromUserId,
        userB: result.request.toUserId,
        message: '🎉 Connected!'
      });
      moderation.recordPositive(result.request.fromUserId, 5);
      moderation.recordPositive(result.request.toUserId, 5);
    }
    socket.emit('connection_result', result);
  });

  // ── Decline Connection ──
  on('decline_connection', ({ requestId }: { requestId?: string; userId?: string }) => {
    const profile = authed();
    if (!profile) return;
    if (!isId(requestId)) { socket.emit('connection_result', { success: false, message: 'Request not found.' }); return; }
    socket.emit('connection_result', connectionManager.declineRequest(requestId, profile.id));
  });

  // ── Block User ──
  on('block_user', ({ blockedUserId }: { userId?: string; blockedUserId?: string }) => {
    const profile = authed();
    if (!profile) return;
    if (!isId(blockedUserId) || blockedUserId === profile.id) {
      socket.emit('block_result', { success: false, message: 'Invalid user.' });
      return;
    }
    const rateCheck = moderation.checkRateLimit(profile.id, 'block');
    if (!rateCheck.allowed) {
      socket.emit('moderation_action', { type: 'rate_limited', message: rateCheck.message });
      return;
    }
    const result = connectionManager.blockUser(profile.id, blockedUserId);
    moderation.decrementReputation(blockedUserId, 5, 'block');
    socket.emit('block_result', result);
  });

  // ── Report User ──
  on('report_user', ({ reportedUserId, reason, roomId }: {
    reporterId?: string; reportedUserId?: string; reason?: string; roomId?: string;
  }) => {
    const profile = authed();
    if (!profile) return;
    if (!isId(reportedUserId) || reportedUserId === profile.id) {
      socket.emit('report_result', { success: false, message: 'Invalid user.' });
      return;
    }
    const rateCheck = moderation.checkRateLimit(profile.id, 'report');
    if (!rateCheck.allowed) {
      socket.emit('moderation_action', { type: 'rate_limited', message: rateCheck.message });
      return;
    }
    const result = connectionManager.reportUser(profile.id, reportedUserId, optString(reason, 500) || 'other', isSocketRoomId(roomId) ? roomId : undefined);
    moderation.decrementReputation(reportedUserId, 15, 'report');
    socket.emit('report_result', { success: true, message: result.message });
  });

  // ── Direct Message ──
  on('send_dm', ({ receiverId, content }: { senderId?: string; receiverId?: string; content?: string }) => {
    const profile = authed();
    if (!profile) return;
    const senderId = profile.id;
    const v = validateMessage(content);
    if (!v.ok) {
      if (typeof content === 'string' && content.trim()) socket.emit('error_message', { error: v.error });
      return;
    }
    if (!isId(receiverId) || !connectionManager.areFriends(senderId, receiverId)) {
      socket.emit('error_message', { error: 'You must be connected to send direct messages.' });
      return;
    }
    const check = moderation.preCheck(senderId, 'message', v.content);
    if (!check.allowed) {
      socket.emit('moderation_action', { type: 'message_blocked', message: check.message });
      return;
    }
    const dm = { id: newId('dm'), senderId, receiverId, content: v.content, timestamp: Date.now(), read: false };
    storeDm(dm);
    // emit ONLY to sender and receiver
    emitToUsers([senderId, receiverId], 'new_dm', dm);
  });

  // ── DM History fetch (persistent) — participant only
  on('fetch_dm_history', ({ userId, friendId }: { userId?: string; friendId?: string }) => {
    const me: string | null = socket.data.userId;
    if (!me || !isId(friendId) || (userId !== undefined && userId !== me)) {
      socket.emit('dm_history', { friendId, messages: [] });
      return;
    }
    const history = persistence.load().directMessages[dmKey(me, friendId)] || [];
    socket.emit('dm_history', { friendId, messages: history.slice(-50) });
  });

  // ── MVP3: Engagement — create/join/leave ──
  // Player identity is the authenticated socket; payload user/userId ignored.
  on('create_game', ({ roomId, type }: { roomId?: string; type?: string; user?: UserProfile }) => {
    const profile = authed();
    if (!profile) return;
    if (!inRoom(roomId) || typeof type !== 'string' || !GAME_TYPES.includes(type)) {
      socket.emit('error_message', { error: 'Join the room to start a game.' });
      return;
    }
    const chk = moderation.preCheck(profile.id, 'message', type);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'rate_limited', message: chk.message });
    const r = engagement.createGame(roomId, type as any, profile);
    if (!r.ok) return socket.emit('error_message', { error: r.error });
    broadcastEngagement(roomId);
    io.to(roomId).emit('new_message', {
      id: newId('sys'), roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
      senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
      content: `🎮 ${type.replace('_',' ')} started by ${profile.pseudonym}`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
    });
    logEvent('game_created', profile.id, { roomId, type });
  });
  on('join_game', ({ roomId }: { roomId?: string; user?: UserProfile }) => {
    const profile = authed();
    if (!profile || !inRoom(roomId)) return;
    const r = engagement.joinGame(roomId, profile);
    if (!r.ok) return socket.emit('error_message', { error: r.error });
    broadcastEngagement(roomId);
  });
  on('leave_game', ({ roomId }: { roomId?: string; userId?: string }) => {
    const me: string | null = socket.data.userId;
    if (!me || !isSocketRoomId(roomId)) return;
    engagement.leaveGame(roomId, me);
    broadcastEngagement(roomId);
  });
  // Word Chain
  on('word_chain_submit', ({ roomId, word }: { roomId?: string; userId?: string; word?: string }) => {
    const profile = authed();
    if (!profile || !inRoom(roomId)) return;
    if (typeof word !== 'string' || !cleanText(word) || word.length > 40) return socket.emit('game_error', { error: 'Enter a word.' });
    const w = cleanText(word);
    const chk = moderation.preCheck(profile.id, 'message', w);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.submitWordChain(roomId, profile.id, w);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
    io.to(roomId).emit('new_message', {
      id: newId('sys'), roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
      senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#10b981,#059669)',
      content: `🔤 ${w.toUpperCase()} +${r.points} pts`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
    });
  });
  // 20 Questions
  on('twenty_q_ask', ({ roomId, question }: { roomId?: string; userId?: string; pseudonym?: string; question?: string }) => {
    const profile = authed();
    if (!profile || !inRoom(roomId)) return;
    const v = validateMessage(question);
    if (!v.ok) return socket.emit('game_error', { error: v.error });
    const chk = moderation.preCheck(profile.id, 'message', v.content);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.askTwentyQ(roomId, profile.id, v.content, profile.pseudonym);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  on('twenty_q_guess', ({ roomId, guess }: { roomId?: string; userId?: string; guess?: string }) => {
    const profile = authed();
    if (!profile || !inRoom(roomId)) return;
    const v = validateMessage(guess);
    if (!v.ok) return socket.emit('game_error', { error: v.error });
    const chk = moderation.preCheck(profile.id, 'message', v.content);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.guessTwentyQ(roomId, profile.id, v.content);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
    if (r.correct) {
      io.to(roomId).emit('new_message', {
        id: newId('sys'), roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
        senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#f59e0b,#ef4444)',
        content: `🎉 Correct! Secret was ${r.state?.secretWord}. Winner bonus +50`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
      });
    }
  });
  // Trivia
  on('trivia_answer', ({ roomId, choice }: { roomId?: string; userId?: string; choice?: number }) => {
    const me: string | null = socket.data.userId;
    if (!me || !inRoom(roomId)) return;
    if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) > 9) return socket.emit('game_error', { error: 'Invalid answer.' });
    const r = engagement.answerTrivia(roomId, me, choice as number);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  // Prompt Wall
  on('prompt_submit', ({ roomId, content }: { roomId?: string; user?: UserProfile; content?: string }) => {
    const profile = authed();
    if (!profile || !inRoom(roomId)) return;
    const v = validateMessage(content);
    if (!v.ok) return socket.emit('game_error', { error: v.error });
    const chk = moderation.preCheck(profile.id, 'message', v.content);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.submitPrompt(roomId, profile, v.content);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  on('prompt_rotate', ({ roomId }: { roomId?: string }) => {
    if (!socket.data.userId || !inRoom(roomId)) return;
    const g = engagement.rotatePrompt(roomId);
    if (g) broadcastEngagement(roomId);
  });
  // Reactions — emoji/reaction system (MVP3)
  on('reaction_toggle', ({ targetId, targetType, emoji, roomId }: { targetId?: string; targetType?: string; userId?: string; emoji?: string; roomId?: string }) => {
    const me: string | null = socket.data.userId;
    if (!me) return;
    if (typeof emoji !== 'string' || !REACTION_EMOJI.includes(emoji)) return socket.emit('error_message', { error: 'Invalid emoji' });
    if (!isId(targetId) || !['message', 'profile', 'submission'].includes(targetType as string)) return socket.emit('error_message', { error: 'Invalid reaction target' });
    const r = engagement.toggleReaction(targetId, targetType as any, me, emoji);
    // Broadcast only into a room the socket is in; otherwise just echo back
    // (previously this fell back to a global io.emit to every client).
    if (inRoom(roomId)) {
      io.to(roomId).emit('reaction_updated', { targetId, targetType, state: r.state, roomId });
      broadcastEngagement(roomId);
    } else {
      socket.emit('reaction_updated', { targetId, targetType, state: r.state, roomId: '' });
    }
    logEvent('reaction_toggle', me, { targetId, targetType, emoji, roomId });
  });
  on('fetch_engagement', ({ roomId }: { roomId?: string }) => {
    if (!isSocketRoomId(roomId)) return;
    socket.emit('engagement_updated', engagement.getSnapshot(roomId));
  });

  // ── Disconnect — broadcast leave presence + ephemeral ttl ──
  socket.on('disconnect', () => {
    try {
      unregisterSocket(socket.id);
      socketEventLimiter.reset(socket.id);

      // Redis-presence rooms the socket joined — drop membership + broadcast leave.
      const pRooms = socketPresenceRooms.get(socket.id);
      if (pRooms && pRooms.size > 0) {
        const pUserId: string | null = socket.data.userId;
        for (const rid of pRooms) {
          if (pUserId) redisPresence.leaveRoom(pUserId, rid).catch(logRedisFailure('leave'));
          broadcastPresence(rid, null);
        }
        socketPresenceRooms.delete(socket.id);
      }

      const { userId, roomIds, leaveMessages } = roomManager.disconnectSocket(socket.id);
      if (userId) {
        for (const rid of roomIds) {
          const lm = leaveMessages.get(rid);
          if (lm) io.to(rid).emit('new_message', lm);
          const serialized = roomManager.serializeRoom(rid);
          if (serialized) io.to(rid).emit('room_updated', serialized);
          broadcastPresence(rid, null);
        }
      }
    } catch (err) {
      console.error('[socket] disconnect cleanup failed', err);
    }
  });
});

// ────────────────────────────────────────
//  MVP2: Live presence tick — keeps hero count feeling genuinely live
// ────────────────────────────────────────
setInterval(() => {
  try {
    for (const room of roomManager.getAllRooms()) {
      const serialized = roomManager.serializeRoom(room.id);
      if (!serialized) continue;
      // broadcast only if someone is present (reduces no-op emits)
      const total = (serialized as any).userCount ?? 0;
      if (total > 0) {
        io.to(room.id).emit('room_updated', serialized);
        io.to(room.id).emit('live_count_tick', {
          roomId: room.id,
          count: total,
          presence: (serialized as any).presence,
          lineName: room.lineName,
          stationName: room.stationName,
          trainLabel: room.scheduleLabel,
          timestamp: Date.now()
        });
      }
    }
  } catch (err) {
    console.error('[tick] live presence failed', err);
  }
}, 15_000);

// MVP3: Engagement tick broadcast — push game timers to rooms
const prevEngagementHashes = new Map<string, string>();
setInterval(() => {
  try {
    const rooms = roomManager.getAllRooms().map(r => r.id);
    const live = new Set(rooms);
    for (const rid of prevEngagementHashes.keys()) if (!live.has(rid)) prevEngagementHashes.delete(rid);
    for (const rid of rooms) {
      const snap = engagement.getSnapshot(rid);
      if (!snap.activeGame) continue;
      const hash = JSON.stringify({ t: snap.activeGame.type, s: snap.activeGame.status, i: (snap.activeGame as any).currentIndex, turn: (snap.activeGame as any).currentTurnUserId, ends: (snap.activeGame as any).currentEndsAt, remaining: (snap.activeGame as any).remaining });
      if (prevEngagementHashes.get(rid) !== hash) {
        prevEngagementHashes.set(rid, hash);
        io.to(rid).emit('engagement_updated', snap);
      } else if (snap.activeGame.type === 'trivia' || snap.activeGame.type === 'word_chain') {
        // still push every 2s while active for countdowns
        io.to(rid).emit('engagement_updated', snap);
      }
    }
  } catch (err) {
    console.error('[tick] engagement failed', err);
  }
}, 2000);

let lastWindowState = false;
setInterval(() => {
  try {
    const nowLive = isCommuteWindowNow();
    if (nowLive && !lastWindowState) {
      // window just opened — push to all connected sockets
      io.emit('commute_window_live', {
        title: 'Your commute window is live 🚇',
        body: 'Commuters on your line are heading out — open CoRide to say hi',
        timestamp: Date.now()
      });
    }
    lastWindowState = nowLive;
    if (nowLive) {
      // also per-room targeted push for rooms with lively count
      for (const room of roomManager.getAllRooms()) {
        const total = (roomManager.serializeRoom(room.id) as any)?.userCount ?? 0;
        if (total >= 5) {
          io.to(room.id).emit('commute_window_room_live', {
            roomId: room.id,
            lineName: room.lineName,
            direction: room.direction,
            scheduleLabel: room.scheduleLabel,
            stationName: room.stationName,
            count: total
          });
        }
      }
    }
  } catch (err) {
    console.error('[tick] commute window failed', err);
  }
}, 60_000);

// Last-resort guards: a stray throw or an unhandled promise rejection must not
// take the whole process (and every connected user) down. Log and stay up.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ────────────────────────────────────────
//  Lifecycle: boot + graceful shutdown
// ────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — draining`);
  const force = setTimeout(() => {
    console.error('[shutdown] timed out; forcing exit');
    process.exit(1);
  }, 10_000);
  force.unref();
  try {
    // Stop accepting work: disconnect sockets and close the HTTP server.
    await new Promise<void>(resolve => {
      io.close(() => resolve());
      setTimeout(() => { server.closeAllConnections?.(); resolve(); }, 3000).unref();
    });
  } catch (err) {
    console.error('[shutdown] close failed', err);
  }
  // Then persist the tail of the debounced store write.
  try { await persistence.flushNow(); } catch (err) { console.error('[shutdown] flush failed', err); }
  await closeAnalytics();
  await redisPresence.close();
  await closeDb();
  clearTimeout(force);
  console.log('[shutdown] clean exit');
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function start(): Promise<void> {
  try {
    await persistence.init();
    if (persistence.mode() === 'postgres') {
      // Services read an empty placeholder at construction; load the real state.
      connectionManager.rehydrate();
      roomManager.rehydrate();
    }
    hydratePushSubscriptions();
  } catch (err) {
    console.error('[startup] FATAL: could not load persisted state' +
      (persistence.mode() === 'postgres' ? ' from Postgres (DATABASE_URL). Refusing to start with empty data.' : '.'), err);
    process.exit(1);
  }

  server.on('error', (err: any) => {
    console.error(`[startup] FATAL: cannot listen on port ${PORT}:`, err?.code || err);
    process.exit(1);
  });
  server.listen(PORT, () => {
    console.log(`🚇 CoRide server running on port ${PORT} — beachhead ${getBeachheadInfo().line} — ` +
      `storage=${persistence.mode()} strictAuth=${STRICT_AUTH} cors=${describeCors()}`);
  });
}

void start();
