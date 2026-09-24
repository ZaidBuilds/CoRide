import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
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
import { signToken, verifyToken } from './services/authToken';
import { INTEREST_TAXONOMY, sanitizeTags } from './types';
import type { UserProfile } from './types';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Public legal pages. Google Play needs a reachable privacy-policy URL and a
// web URL where users can request account deletion without the app.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

const PORT = process.env.PORT || 4000;
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
      pseudonym: p.pseudonym || p.username.replace(/^@/, ''),
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
  // Identity comes from x-user-id only — a body userId let anyone heartbeat as
  // (or, via leave, evict) another user.
  const userId = actorId(req);
  if (!userId) return res.status(401).json({ error: 'Invalid or missing auth token.' });
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
  if (!userId) return res.status(401).json({ error: 'Invalid or missing auth token.' });
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

// Lightweight push subscription (MVP2 — stores token, socket push used for now)
const pushSubscriptions: Map<string, any> = new Map();
app.post('/api/push/subscribe', (req, res) => {
  const { userId, subscription, commutePrefs } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: 'userId + subscription required' });
  pushSubscriptions.set(userId, { subscription, commutePrefs, at: Date.now() });
  // persist lightly
  try {
    const store = persistence.load() as any;
    store.pushSubscriptions = store.pushSubscriptions || {};
    store.pushSubscriptions[userId] = { subscription, commutePrefs, at: Date.now() };
    persistence.save(store);
  } catch {}
  res.json({ ok: true, message: 'Subscribed for commute window pushes' });
});
app.get('/api/push/subscriptions', (_req, res) => {
  res.json({ count: pushSubscriptions.size });
});

// ── MVP3: Engagement layer — snapshots + curated data ──
app.get('/api/engagement/:roomId', (req, res) => {
  const snap = engagement.getSnapshot(req.params.roomId);
  res.json(snap);
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
  // also push lightweight activity to room chat as system message if game started/ended? handled separately
}

// ── MVP4: Personalization & Network Effects ──
function enrichProfile(profile: UserProfile): UserProfile & { trustTier: string; trustBadge: string } {
  const trust = moderation.getTrustInfo(profile.id);
  return { ...profile, trustTier: trust.tier as any, trustBadge: trust.badge } as any;
}

app.get('/api/interests', (_req, res) => {
  res.json({ interests: INTEREST_TAXONOMY, count: INTEREST_TAXONOMY.length });
});

// Enhanced profile fetch with trust + reputation
app.get('/api/profile/:userId', (req, res) => {
  const p = persistence.getProfile(req.params.userId) || roomManager.getUserProfile(req.params.userId);
  if (!p) return res.status(404).json({ error: 'Profile not found' });
  const enriched = enrichProfile(p as UserProfile);
  const trust = moderation.getTrustInfo(req.params.userId);
  res.json({ profile: enriched, trust, reputation: moderation.getReputation(req.params.userId) });
});

// Update profile — optional public enhancements (bio, tags, college, avatar, etc.)
app.patch('/api/profile/:userId', (req, res) => {
  if (actorId(req) !== req.params.userId) {
    return res.status(403).json({ error: 'Not authorized to edit this profile.' });
  }
  const existing = persistence.getProfile(req.params.userId) || roomManager.getUserProfile(req.params.userId);
  if (!existing) return res.status(404).json({ error: 'Profile not found' });
  const { pseudonym, bio, collegeOrTag, interestTags, avatarBg, avatarId, languages, favoriteStationId, favoriteLineId, vibeTagline } = req.body;
  const updated: UserProfile = { ...existing };
  if (typeof pseudonym === 'string' && pseudonym.trim().length >= 2 && pseudonym.trim().length <= 20) updated.pseudonym = pseudonym.trim();
  if (typeof bio === 'string') updated.bio = bio.trim().slice(0, 120);
  if (typeof collegeOrTag === 'string') updated.collegeOrTag = collegeOrTag.trim().slice(0, 30);
  if (Array.isArray(interestTags)) updated.interestTags = sanitizeTags(interestTags);
  if (typeof avatarBg === 'string') updated.avatarBg = avatarBg.slice(0, 100);
  if (typeof avatarId === 'string') updated.avatarId = avatarId.slice(0, 30);
  if (Array.isArray(languages)) updated.languages = languages.map((l: string) => l.slice(0,10)).slice(0,3);
  if (typeof favoriteStationId === 'string') updated.favoriteStationId = favoriteStationId;
  if (typeof favoriteLineId === 'string') updated.favoriteLineId = favoriteLineId;
  if (typeof vibeTagline === 'string') updated.vibeTagline = vibeTagline.trim().slice(0, 30);
  // persist via both stores
  persistence.appendProfile(updated);
  // also update roomManager in-memory if present
  const rmProfiles: any = (roomManager as any).userProfiles;
  if (rmProfiles && rmProfiles.set) rmProfiles.set(updated.id, updated);
  // reputation positive for completing profile
  moderation.recordPositive(updated.id, 1);
  res.json({ profile: enrichProfile(updated), trust: moderation.getTrustInfo(updated.id) });
});

// DELETE /api/profile/:userId — Google Play Mandatory Account Deletion Policy
app.delete('/api/profile/:userId', (req, res) => {
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
    // Chat threads, read markers and saved commutes belong to the account too —
    // the in-app copy promises they are erased.
    for (const key of Object.keys(store.directMessages || {})) {
      if (key.split('::').includes(userId)) delete store.directMessages[key];
    }
    for (const key of Object.keys(store.reads || {})) {
      if (key.split('::').includes(userId)) delete store.reads[key];
    }
    if (store.commutePatterns) delete store.commutePatterns[userId];
    persistence.save(store);

    const rmProfiles: any = (roomManager as any).userProfiles;
    if (rmProfiles && rmProfiles.delete) rmProfiles.delete(userId);

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

// Smart ranking + vibe recommendations
app.get('/api/rank/:roomId', (req, res) => {
  const viewerId = String(req.query.viewerId || '');
  if (!viewerId) return res.status(400).json({ error: 'viewerId query required' });
  const ranked = rankingService.rankForViewer(viewerId, req.params.roomId, false);
  // map to lightweight
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
  const vibe = rankingService.vibeForViewer(req.params.viewerId, req.params.roomId, 3);
  const out = vibe.map(r => ({
    profile: enrichProfile(r.profile as UserProfile),
    score: r.score,
    mutualTags: r.mutualTags,
    mutualCount: r.mutualCount,
    trustBadge: r.trustBadge
  }));
  res.json({ vibe: out });
});

// Saved commute patterns — one-tap repeat entry
app.post('/api/commute/patterns', (req, res) => {
  const { userId, lineId, lineName, lineColor, stationId, stationName, direction, targetTime, daysOfWeek, label } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const pat = commuteService.savePattern(userId, { lineId, lineName, lineColor, stationId, stationName, direction, targetTime, daysOfWeek, label, isActive: true });
  res.json({ pattern: pat });
});
app.get('/api/commute/patterns/:userId', (req, res) => {
  const pats = commuteService.getPatterns(req.params.userId);
  res.json({ patterns: pats });
});
app.delete('/api/commute/patterns/:userId/:patternId', (req, res) => {
  const ok = commuteService.deletePattern(req.params.userId, req.params.patternId);
  res.json({ ok });
});
app.post('/api/commute/patterns/:userId/:patternId/use', (req, res) => {
  const pat = commuteService.markUsed(req.params.userId, req.params.patternId);
  if (!pat) return res.status(404).json({ error: 'Pattern not found' });
  // also create context detection for one-tap
  const { TransitContextEngine } = require('./services/transitContextEngine');
  const engine = TransitContextEngine.getInstance();
  const ctx = engine.evaluate({
    userId: pat.userId,
    timestamp: Date.now(),
    cellTowerId: undefined as any,
    lat: undefined as any,
    lng: undefined as any,
    movementState: 'WALKING',
    userConfirmed: true
  });
  // override to pattern's station/line
  const room = roomManager.getOrCreateFromContext({ ...ctx, station: pat.stationId, stationName: pat.stationName, line: pat.lineId, lineName: pat.lineName, lineColor: pat.lineColor, direction: pat.direction } as any);
  // analytics
  try {
    const logPath = path.join(__dirname, 'data', 'analytics.log');
    fs.appendFileSync(logPath, JSON.stringify({ t: Date.now(), event: 'commute_pattern_used', userId: pat.userId, payload: { patternId: pat.id, station: pat.stationName } }) + '\n');
  } catch {}
  res.json({ pattern: pat, context: { ...ctx, station: pat.stationId, stationName: pat.stationName, line: pat.lineId, lineName: pat.lineName, direction: pat.direction }, room: roomManager.serializeRoom(room.id) });
});

// Random Telegram-style profile
app.get('/api/auth/random-profile', (_req, res) => {
  const p = getRandomTelegramProfile();
  const profile: UserProfile = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

// Update user interest tags (sanitized & validated against the interest taxonomy).
app.patch('/api/user/:userId/tags', (req, res) => {
  const userId = req.params.userId;
  const rawTags: string[] = req.body?.tags || [];
  const valid = sanitizeTags(rawTags);
  const profile: any = persistence.getProfile(userId) || roomManager.getUserProfile(userId);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  persistence.appendProfile(profile);
  res.json({ profile, tags: valid });
});

// Lightweight analytics ingest (north-star signals)
app.post('/api/analytics/event', (req, res) => {
  const { event, userId, payload } = req.body;
  try {
    const logPath = path.join(__dirname, 'data', 'analytics.log');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ t: Date.now(), event, userId, payload }) + '\n';
    fs.appendFileSync(logPath, line);
  } catch {}
  res.json({ ok: true });
});

// Analytics summary (north-star signals)
app.get('/api/analytics/summary', (_req, res) => {
  try {
    const logPath = path.join(__dirname, 'data', 'analytics.log');
    let lines: string[] = [];
    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, 'utf-8');
      lines = raw.trim().split('\n').filter(Boolean);
    }
    const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
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
    res.json({ error: String(e) });
  }
});

// Admin moderation view (MVP)
app.get('/api/admin/reports', (_req, res) => {
  const store = persistence.load();
  res.json({ reports: store.reports || [] });
});

app.post('/api/admin/resolve/:reportId', (req, res) => {
  // Moderator-only. Disabled entirely unless ADMIN_TOKEN is configured.
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.header('x-admin-token') !== adminToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }
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
app.post('/api/context/detect', (req, res) => {
  const { userId, lat, lng, cellTowerId, movementState, speedKmh, userConfirmed, routeHistory, headingDegrees, userConfirmedDirection } = req.body;

  const ctx = contextEngine.evaluate({
    userId: userId || 'anonymous',
    timestamp: Date.now(),
    lat: lat ? Number(lat) : undefined,
    lng: lng ? Number(lng) : undefined,
    cellTowerId,
    movementState: movementState || 'IN_VEHICLE',
    speedKmh: speedKmh ? Number(speedKmh) : undefined,
    routeHistory: Array.isArray(routeHistory) ? routeHistory : undefined,
    userConfirmed: !!userConfirmed,
    headingDegrees: headingDegrees !== undefined ? Number(headingDegrees) : undefined,
    userConfirmedDirection: userConfirmedDirection || undefined
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
  const { userId, lineId, direction, stationId } = req.body;
  const effectiveUserId = actorId(req) || userId;
  if (!effectiveUserId || !lineId || !direction) {
    return res.status(400).json({ error: 'userId (or auth token), lineId, and direction are required' });
  }

  const tracker = PathTrackerEngine.getInstance();
  tracker.setDirectionOverride(effectiveUserId, lineId, direction);

  // Evaluate updated context with confirmed direction
  const ctx = contextEngine.evaluate({
    userId: effectiveUserId,
    timestamp: Date.now(),
    movementState: 'IN_VEHICLE',
    userConfirmed: true,
    userConfirmedDirection: direction
  });

  const room = roomManager.getOrCreateFromContext(ctx);

  res.json({
    ok: true,
    context: ctx,
    room: roomManager.serializeRoom(room.id),
    trip: tracker.getTrip(effectiveUserId)
  });
});

// Friends list — enriched with trust (MVP4 network effect)
app.get('/api/friends/:userId', (req, res) => {
  const friendIds = connectionManager.getFriendIds(req.params.userId);
  const friends = friendIds.map(fid => {
    const profile = roomManager.getUserProfile(fid);
    if (!profile) return null;
    const enriched = (()=>{ try { const t = moderation.getTrustInfo(fid); return { ...profile, trustTier: t.tier, trustBadge: t.badge }; } catch { return profile; } })();
    return {
      id: fid,
      profile: enriched,
      presenceTier: presence.getTier(fid)
    };
  }).filter(Boolean);
  res.json({ friends });
});

// Pending connection requests
app.get('/api/connections/pending/:userId', (req, res) => {
  const pending = connectionManager.getPendingRequestsFor(req.params.userId);
  const enriched = pending.map(req => ({
    ...req,
    fromProfile: roomManager.getUserProfile(req.fromUserId)
  }));
  res.json({ pending: enriched });
});
app.get('/api/connections/sent/:userId', (req, res) => {
  const sent = connectionManager.getSentRequestsFor(req.params.userId);
  const enriched = sent.map(req => ({
    ...req,
    toProfile: roomManager.getUserProfile(req.toUserId)
  }));
  res.json({ sent: enriched });
});
app.get('/api/connections/history/:userId', (req, res) => {
  const all = connectionManager.getAllRequestsFor(req.params.userId);
  res.json({ history: all });
});

// ── REST connection API (used by the room profile sheet) ──────────────
// Authenticated actor identity. Derived ONLY from a verified signed token
// (Authorization: Bearer <token>, issued at /api/auth/*). A client can no
// longer claim an identity via a plain header — the signature is checked.
function actorId(req: express.Request): string | null {
  const auth = req.header('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  // Also accept the raw token in x-user-token (sockets/tests), never a bare id.
  return verifyToken(bearer || req.header('x-user-token'));
}

// Self-contained 20/hour limiter. Deliberately NOT the shared
// moderation.checkRateLimit('connection_request') — that is 10/hour and is
// wired to the socket path; changing it there would need a second file and
// would silently alter socket behaviour.
const REST_CONN_MAX = 20;
const REST_CONN_WINDOW_MS = 60 * 60 * 1000;
const restConnBuckets = new Map<string, number[]>();
function restConnRateOk(userId: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const hits = (restConnBuckets.get(userId) || []).filter(t => now - t < REST_CONN_WINDOW_MS);
  if (hits.length >= REST_CONN_MAX) {
    restConnBuckets.set(userId, hits);
    return { ok: false, remaining: 0 };
  }
  hits.push(now);
  restConnBuckets.set(userId, hits);
  return { ok: true, remaining: REST_CONN_MAX - hits.length };
}

// POST /api/connections { targetId } → create a pending request
app.post('/api/connections', (req, res) => {
  const from = actorId(req);
  const targetId = req.body?.targetId;
  if (!from) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!targetId) return res.status(400).json({ error: 'targetId is required.' });
  if (from === targetId) return res.status(400).json({ error: 'Cannot connect to yourself.' });

  const rate = restConnRateOk(from);
  if (!rate.ok) return res.status(429).json({ error: 'Rate limit: 20 connection requests per hour.' });

  // sendRequest already guards blocked / already-friends / duplicate, and
  // auto-accepts a reciprocal pending request.
  const result = connectionManager.sendRequest(from, targetId);
  if (!result.success) return res.status(409).json({ error: result.message });
  return res.status(201).json({ request: result.request, remaining: rate.remaining });
});

// POST /api/connections/:id/accept
app.post('/api/connections/:id/accept', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  const result = connectionManager.acceptRequest(req.params.id, me);
  if (!result.success) {
    return res.status(result.message === 'Request not found.' ? 404 : 403).json({ error: result.message });
  }
  return res.json({ request: result.request });
});

// POST /api/connections/:id/decline
app.post('/api/connections/:id/decline', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  const result = connectionManager.declineRequest(req.params.id, me);
  if (!result.success) {
    return res.status(result.message === 'Request not found.' ? 404 : 403).json({ error: result.message });
  }
  return res.json({ ok: true });
});

// GET /api/connections → my friends + pending in/out (actor from x-user-id)
app.get('/api/connections', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  const friends = connectionManager.getFriendIds(me).map(fid => ({
    id: fid,
    profile: roomManager.getUserProfile(fid) || null
  }));
  const incoming = connectionManager.getPendingRequestsFor(me).map(r => ({
    ...r, fromProfile: roomManager.getUserProfile(r.fromUserId) || null
  }));
  const outgoing = connectionManager.getSentRequestsFor(me).map(r => ({
    ...r, toProfile: roomManager.getUserProfile(r.toUserId) || null
  }));
  return res.json({ friends, pending: { incoming, outgoing } });
});

// DM history (REST fallback for initial load)
app.get('/api/dm/:userId/:friendId', (req, res) => {
  // Auth: the caller must BE one of the two participants. Previously this route
  // had no check, so anyone could read any pair's thread by guessing ids.
  const me = actorId(req);
  const { userId, friendId } = req.params;
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (me !== userId && me !== friendId) {
    return res.status(403).json({ error: 'Not your conversation.' });
  }
  try {
    const store = persistence.load();
    const key = [userId, friendId].sort().join('::');
    const history = store.directMessages[key] || [];
    res.json({ messages: history.slice(-50) });
  } catch {
    res.json({ messages: [] });
  }
});

// ── REST report & block (used by the profile/report sheet) ────────────
const REPORT_CATEGORIES = ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'];

// POST /api/reports { targetId, category, note }
app.post('/api/reports', (req, res) => {
  const me = actorId(req);
  const { targetId, category, note } = req.body || {};
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!targetId) return res.status(400).json({ error: 'targetId is required.' });
  if (me === targetId) return res.status(400).json({ error: 'You cannot report yourself.' });
  if (!REPORT_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${REPORT_CATEGORIES.join(', ')}` });
  }
  // reportUser stores a single reason string; fold the optional note into it.
  const reason = note && String(note).trim() ? `${category}: ${String(note).trim()}` : category;
  const result = connectionManager.reportUser(me, targetId, reason);
  return res.status(201).json({ message: result.message });
});

// POST /api/blocks { targetId }
app.post('/api/blocks', (req, res) => {
  const me = actorId(req);
  const targetId = req.body?.targetId;
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!targetId) return res.status(400).json({ error: 'targetId is required.' });
  if (me === targetId) return res.status(400).json({ error: 'You cannot block yourself.' });
  const result = connectionManager.blockUser(me, targetId);
  return res.status(201).json({ message: result.message });
});

// DELETE /api/blocks/:id — :id is the blocked user's id
app.delete('/api/blocks/:id', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  const result = connectionManager.unblock(me, req.params.id);
  if (!result.success) return res.status(404).json({ error: result.message });
  return res.json({ ok: true });
});

// GET /api/blocks → returns blocked users for the actor
app.get('/api/blocks', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing auth.' });
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

// GET /api/moderation/reports → queue of reports for compliance audit
app.get('/api/moderation/reports', (_req, res) => {
  const store = persistence.load();
  res.json({ reports: store.reports || [] });
});

// ── REST 1:1 chat (accepted connections only) ────────────────────────
// A 1:1 chat is identified by the peer's id, so :id IS the other user's id —
// no separate chat-id scheme. Actor from x-user-id, as with connections.
const dmKey = (a: string, b: string) => [a, b].sort().join('::');

// GET /api/chats → one entry per accepted connection, newest activity first.
app.get('/api/chats', (req, res) => {
  const me = actorId(req);
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  const store = persistence.load();
  const chats = connectionManager.getFriendIds(me).map(peerId => {
    const thread = store.directMessages[dmKey(me, peerId)] || [];
    const last = thread[thread.length - 1];
    return {
      id: peerId,
      peer: roomManager.getUserProfile(peerId) || null,
      lastMessage: last ? { content: last.content, timestamp: last.timestamp, senderId: last.senderId } : null,
      // Unread = messages from the peer newer than my lastReadAt for this chat.
      unread: (() => {
        const lastReadAt = store.reads[`${me}::${peerId}`] || 0;
        return thread.filter((m: any) => m.senderId === peerId && m.timestamp > lastReadAt).length;
      })()
    };
  });
  chats.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  return res.json({ chats });
});

// GET /api/chats/:id/messages → thread history (last 50)
app.get('/api/chats/:id/messages', (req, res) => {
  const me = actorId(req);
  const peerId = req.params.id;
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const store = persistence.load();
  const history = (store.directMessages[dmKey(me, peerId)] || []).slice(-50);
  return res.json({ messages: history });
});

// POST /api/chats/:id/messages { content }
app.post('/api/chats/:id/messages', (req, res) => {
  const me = actorId(req);
  const peerId = req.params.id;
  const content = (req.body?.content || '').trim();
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!content) return res.status(400).json({ error: 'content is required.' });
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const check = moderation.preCheck(me, 'message', content);
  if (!check.allowed) return res.status(429).json({ error: check.message });

  const dm = { id: `dm_${Date.now()}`, senderId: me, receiverId: peerId, content, timestamp: Date.now(), read: false };
  try {
    const store = persistence.load();
    const key = dmKey(me, peerId);
    if (!store.directMessages[key]) store.directMessages[key] = [];
    store.directMessages[key].push(dm);
    if (store.directMessages[key].length > 200) store.directMessages[key] = store.directMessages[key].slice(-200);
    persistence.save(store);
  } catch (err) {
    console.error('[chats] persist failed', err);
    return res.status(500).json({ error: 'Could not send message.' });
  }
  // Mirror to any live socket so the peer's open chat/DM view still updates.
  emitToUsers([me, peerId], 'new_dm', dm);
  return res.status(201).json({ message: dm });
});

// POST /api/chats/:id/read — mark this chat read up to now for the caller.
app.post('/api/chats/:id/read', (req, res) => {
  const me = actorId(req);
  const peerId = req.params.id;
  if (!me) return res.status(401).json({ error: 'Missing x-user-id.' });
  if (!connectionManager.areFriends(me, peerId)) {
    return res.status(403).json({ error: 'You can only chat with accepted connections.' });
  }
  const now = Date.now();
  try {
    const store = persistence.load();
    store.reads[`${me}::${peerId}`] = now;
    persistence.save(store);
  } catch (err) {
    console.error('[chats] read persist failed', err);
    return res.status(500).json({ error: 'Could not mark read.' });
  }
  return res.json({ ok: true, lastReadAt: now });
});

// ────────────────────────────────────────
//  SOCKET.IO REALTIME
// ────────────────────────────────────────

// Socket identity, with the same trust model as REST: the server resolves who
// the client is from the handshake auth payload (`auth: { userId }`), never
// from a client-sent user object. An auth userId that doesn't resolve to a
// known profile is a spoof and rejects the connection outright. Clients that
// connect without auth are tolerated for now, but their identity is
// unverified — see the `user` fallbacks below (removed once every screen
// sends auth).
function resolveSocketIdentity(socket: {
  handshake: { auth: Record<string, unknown> };
}): { userId: string | null; profile: UserProfile | null } {
  // Identity comes from the SIGNED token, never a bare auth.userId — a client
  // cannot claim to be someone else without the signing secret.
  const token = socket.handshake.auth?.token;
  const uid = verifyToken(typeof token === 'string' ? token : null);
  if (!uid) return { userId: null, profile: null };
  const profile = persistence.getProfile(uid) || roomManager.getUserProfile(uid) || null;
  return { userId: uid, profile };
}

io.use((socket, next) => {
  const hasToken = typeof socket.handshake?.auth?.token === 'string';
  if (hasToken) {
    const ident = resolveSocketIdentity(socket);
    // A token that fails verification is a spoof attempt — reject outright.
    if (!ident.userId) return next(new Error('unknown traveler'));
    socket.data.userId = ident.userId;
    socket.data.profile = ident.profile;
    return next();
  }
  // No token — unverified connection; sensitive handlers reject on null profile.
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
      console.error('[presence] broadcast failed', err);
    }
  })();
}

io.on('connection', (socket) => {
  console.log(`[Connected] ${socket.id}${socket.data.userId ? ` (${socket.data.userId})` : ''}`);

  // ── Join Room ──
  socket.on('join_room', ({ roomId, user }: { roomId: string; user?: UserProfile }) => {
    try {
      const profile: UserProfile | null = socket.data.profile || user || null;
      if (!profile) {
        socket.emit('error_message', { error: 'Authentication required to join a room.' });
        return;
      }
      socket.join(roomId);
      socket.data.userId = profile.id;
      socket.data.profile = profile;
      registerUserSocket(profile.id, socket.id);

      if (isPresenceRoomId(roomId)) {
        if (!socketPresenceRooms.has(socket.id)) socketPresenceRooms.set(socket.id, new Set());
        socketPresenceRooms.get(socket.id)!.add(roomId);
        void redisPresence.joinRoom(profile.id, roomId);
        broadcastPresence(roomId, profile.id);
        return;
      }

      const room = roomManager.joinRoom(roomId, profile, socket.id);
      const serialized = roomManager.serializeRoom(roomId);

      io.to(roomId).emit('room_updated', serialized);
      broadcastPresence(roomId, profile.id);
    } catch (err: any) {
      socket.emit('error_message', { error: err.message });
    }
  });

  // ── Presence Heartbeat — MVP2: keep live, touch TTL ──
  socket.on('heartbeat', ({ roomId }: { roomId: string }) => {
    const userId: string | null = socket.data.userId;
    if (!userId || !roomId) return;
    if (isPresenceRoomId(roomId)) {
      void redisPresence.heartbeat(userId, roomId);
    } else {
      presence.heartbeat(userId, roomId, socket.id);
      roomManager.touchRoom(roomId);
    }
    broadcastPresence(roomId, userId);
  });

  // ── Leave Room (explicit switch) ──
  socket.on('leave_room', ({ roomId, userId: legacyUserId }: { roomId: string; userId?: string }) => {
    const userId: string | null = socket.data.userId || legacyUserId || null;

    if (isPresenceRoomId(roomId)) {
      socketPresenceRooms.get(socket.id)?.delete(roomId);
      if (userId) void redisPresence.leaveRoom(userId, roomId);
      socket.leave(roomId);
      broadcastPresence(roomId, null);
      return;
    }

    const leaveMsg = roomManager.leaveRoom(roomId, userId ?? '', 'switch');
    const serialized = roomManager.serializeRoom(roomId);
    if (serialized) io.to(roomId).emit('room_updated', serialized);
    if (leaveMsg) io.to(roomId).emit('new_message', leaveMsg);
    broadcastPresence(roomId, null);
    socket.leave(roomId);
  });

  // ── Typing indicators (ephemeral) ──
  socket.on('typing_start', ({ roomId, user }: { roomId: string; user?: UserProfile }) => {
    const profile: UserProfile | null = socket.data.profile || user || null;
    if (!profile) return;
    socket.to(roomId).emit('user_typing', { roomId, userId: profile.id, pseudonym: profile.pseudonym, avatarBg: profile.avatarBg });
  });
  socket.on('typing_stop', ({ roomId, userId }: { roomId: string; userId: string }) => {
    const uid: string = socket.data.userId || userId;
    if (!uid) return;
    socket.to(roomId).emit('user_stop_typing', { roomId, userId: uid });
  });

  // ── Send Message (with moderation) — touch room ephemeral ttl ──
  socket.on('send_message', ({ roomId, content, user }: { roomId: string; content: string; user?: UserProfile }) => {
    const profile: UserProfile | null = socket.data.profile || user || null;
    if (!profile) {
      socket.emit('error_message', { error: 'Authentication required to send messages.' });
      return;
    }
    // Guard: legacy addMessage throws for an unknown/expired room. Without this
    // the uncaught throw crashed the whole process for every connected user.
    try {
      if (!content?.trim()) return;

      const check = moderation.preCheck(profile.id, 'message', content);
      if (!check.allowed) {
        socket.emit('moderation_action', { type: 'message_blocked', message: check.message });
        return;
      }

      // Redis-presence room: ephemeral broadcast, no persistence (matches the
      // live-room model — messages exist only while the room is attended).
      if (isPresenceRoomId(roomId)) {
        if (!socket.rooms.has(roomId)) {
          socket.emit('error_message', { error: 'Join the room before sending.' });
          return;
        }
        const msg = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          roomId,
          senderId: profile.id,
          senderUsername: profile.username,
          senderPseudonym: profile.pseudonym,
          senderAvatarId: profile.avatarId,
          senderAvatarBg: profile.avatarBg,
          content: content.trim(),
          timestamp: Date.now(),
          type: 'text'
        };
        io.to(roomId).emit('new_message', msg);
        socket.emit('message_ack', msg);
        return;
      }

      const msg = roomManager.addMessage(roomId, profile, content.trim());
      roomManager.touchRoom(roomId);
      io.to(roomId).emit('new_message', msg);
      socket.emit('message_ack', msg);
      // also refresh presence counts broadcast
      const upd = roomManager.serializeRoom(roomId);
      if (upd) io.to(roomId).emit('room_updated', upd);
    } catch (err: any) {
      socket.emit('error_message', { error: err?.message || 'Could not send message.' });
    }
  });

  // ── Connection Request ──
  socket.on('connect_request', ({ toUserId, contextLine, contextStation }: {
    fromUser?: UserProfile; toUserId: string; contextLine: string; contextStation: string;
  }) => {
    // Actor is the authenticated socket, never a client-supplied fromUser.id.
    const me = socket.data.userId;
    if (!me) { socket.emit('error_message', { error: 'Authentication required.' }); return; }
    const rateCheck = moderation.checkRateLimit(me, 'connection_request');
    if (!rateCheck.allowed) {
      socket.emit('moderation_action', { type: 'rate_limited', message: rateCheck.message });
      return;
    }

    const result = connectionManager.sendRequest(me, toUserId, contextLine, contextStation);

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
  socket.on('accept_connection', ({ requestId }: { requestId: string; userId?: string }) => {
    const me = socket.data.userId;
    if (!me) { socket.emit('error_message', { error: 'Authentication required.' }); return; }
    const result = connectionManager.acceptRequest(requestId, me);
    if (result.success && result.request) {
      emitToUsers([result.request.fromUserId, result.request.toUserId], 'connection_accepted', {
        userA: result.request.fromUserId,
        userB: result.request.toUserId,
        message: '🎉 Connected!'
      });
      // MVP4: positive reputation for both — trust builds
      moderation.recordPositive(result.request.fromUserId, 5);
      moderation.recordPositive(result.request.toUserId, 5);
    }
    socket.emit('connection_result', result);
  });

  // ── Decline Connection ──
  socket.on('decline_connection', ({ requestId }: { requestId: string; userId?: string }) => {
    const me = socket.data.userId;
    if (!me) { socket.emit('error_message', { error: 'Authentication required.' }); return; }
    const result = connectionManager.declineRequest(requestId, me);
    socket.emit('connection_result', result);
  });

  // ── Block User ──
  socket.on('block_user', ({ blockedUserId }: { userId?: string; blockedUserId: string }) => {
    const me = socket.data.userId;
    if (!me) { socket.emit('error_message', { error: 'Authentication required.' }); return; }
    const result = connectionManager.blockUser(me, blockedUserId);
    moderation.decrementReputation(blockedUserId, 5, 'block');
    socket.emit('block_result', result);

    // Re-emit room state so blocked user disappears from their view
    const rooms = Array.from(io.sockets.adapter.rooms.keys());
    // simplified: just ack
  });

  // ── Report User ──
  socket.on('report_user', ({ reportedUserId, reason, roomId }: {
    reporterId?: string; reportedUserId: string; reason: string; roomId?: string;
  }) => {
    const me = socket.data.userId;
    if (!me) { socket.emit('error_message', { error: 'Authentication required.' }); return; }
    const rateCheck = moderation.checkRateLimit(me, 'report');
    if (!rateCheck.allowed) {
      socket.emit('moderation_action', { type: 'rate_limited', message: rateCheck.message });
      return;
    }

    const result = connectionManager.reportUser(me, reportedUserId, reason, roomId);
    moderation.decrementReputation(reportedUserId, 15, 'report');

    socket.emit('report_result', { success: true, message: result.message });
  });

  // ── Direct Message ──
  socket.on('send_dm', ({ receiverId, content }: {
    senderId?: string; receiverId: string; content: string;
  }) => {
    if (!content?.trim()) return;

    // Sender is the authenticated socket, not a client-supplied senderId.
    const senderId = socket.data.userId;
    if (!senderId) { socket.emit('error_message', { error: 'Authentication required.' }); return; }

    // Only friends can DM
    if (!connectionManager.areFriends(senderId, receiverId)) {
      socket.emit('error_message', { error: 'You must be connected to send direct messages.' });
      return;
    }

    const check = moderation.preCheck(senderId, 'message', content);
    if (!check.allowed) {
      socket.emit('moderation_action', { type: 'message_blocked', message: check.message });
      return;
    }

    const dm = {
      id: `dm_${Date.now()}`,
      senderId,
      receiverId,
      content: content.trim(),
      timestamp: Date.now(),
      read: false
    };
    // persist DM for history across reconnects
    try {
      const store = persistence.load();
      const key = [senderId, receiverId].sort().join('::');
      if (!store.directMessages[key]) store.directMessages[key] = [];
      store.directMessages[key].push(dm);
      // cap at 200 per thread
      if (store.directMessages[key].length > 200) store.directMessages[key] = store.directMessages[key].slice(-200);
      persistence.save(store);
    } catch {}
    // emit ONLY to sender and receiver — fixes privacy leak
    emitToUsers([senderId, receiverId], 'new_dm', dm);
  });

  // ── DM History fetch (persistent)
  socket.on('fetch_dm_history', ({ userId, friendId }: { userId: string; friendId: string }) => {
    // Auth: the requesting socket must actually belong to the claimed userId,
    // otherwise anyone could pull any pair's thread. Best-effort until real
    // token auth exists — a socket registers its userId on join_room.
    if (!userIdToSocketIds.get(userId)?.has(socket.id)) {
      socket.emit('dm_history', { friendId, messages: [] });
      return;
    }
    try {
      const store = persistence.load();
      const key = [userId, friendId].sort().join('::');
      const history = store.directMessages[key] || [];
      socket.emit('dm_history', { friendId, messages: history.slice(-50) });
    } catch {
      socket.emit('dm_history', { friendId, messages: [] });
    }
  });

  // ── MVP3: Engagement — create/join/leave ──
  socket.on('create_game', ({ roomId, type, user }: { roomId: string; type: 'word_chain' | 'twenty_q' | 'trivia' | 'prompt'; user: UserProfile }) => {
    if (!roomId || !type || !user) return socket.emit('error_message', { error: 'roomId/type/user required' });
    const chk = moderation.preCheck(user.id, 'message', type);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'rate_limited', message: chk.message });
    const r = engagement.createGame(roomId, type, user);
    if (!r.ok) return socket.emit('error_message', { error: r.error });
    try { persistence.load(); } catch {}
    broadcastEngagement(roomId);
    io.to(roomId).emit('new_message', {
      id: `sys_${Date.now()}`, roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
      senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
      content: `🎮 ${type.replace('_',' ')} started by ${user.pseudonym}`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
    });
    // analytics
    try {
      const logPath = path.join(__dirname, 'data', 'analytics.log');
      fs.appendFileSync(logPath, JSON.stringify({ t: Date.now(), event: 'game_created', userId: user.id, payload: { roomId, type } }) + '\n');
    } catch {}
  });
  socket.on('join_game', ({ roomId, user }: { roomId: string; user: UserProfile }) => {
    const r = engagement.joinGame(roomId, user);
    if (!r.ok) return socket.emit('error_message', { error: r.error });
    broadcastEngagement(roomId);
  });
  socket.on('leave_game', ({ roomId, userId }: { roomId: string; userId: string }) => {
    engagement.leaveGame(roomId, userId);
    broadcastEngagement(roomId);
  });
  // Word Chain
  socket.on('word_chain_submit', ({ roomId, userId, word }: { roomId: string; userId: string; word: string }) => {
    const chk = moderation.preCheck(userId, 'message', word);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.submitWordChain(roomId, userId, word);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
    // also chat alert
    io.to(roomId).emit('new_message', {
      id: `sys_${Date.now()}`, roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
      senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#10b981,#059669)',
      content: `🔤 ${word.toUpperCase()} +${r.points} pts`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
    });
  });
  // 20 Questions
  socket.on('twenty_q_ask', ({ roomId, userId, pseudonym, question }: { roomId: string; userId: string; pseudonym: string; question: string }) => {
    const chk = moderation.preCheck(userId, 'message', question);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.askTwentyQ(roomId, userId, question, pseudonym);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  socket.on('twenty_q_guess', ({ roomId, userId, guess }: { roomId: string; userId: string; guess: string }) => {
    const chk = moderation.preCheck(userId, 'message', guess);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.guessTwentyQ(roomId, userId, guess);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
    if (r.correct) {
      io.to(roomId).emit('new_message', {
        id: `sys_${Date.now()}`, roomId, senderId: 'system', senderUsername: '@CoRide', senderPseudonym: 'CoRide',
        senderAvatarId: 'system', senderAvatarBg: 'linear-gradient(135deg,#f59e0b,#ef4444)',
        content: `🎉 Correct! Secret was ${r.state?.secretWord}. Winner bonus +50`, timestamp: Date.now(), isSystem: true, type: 'game_alert'
      });
    }
  });
  // Trivia
  socket.on('trivia_answer', ({ roomId, userId, choice }: { roomId: string; userId: string; choice: number }) => {
    const r = engagement.answerTrivia(roomId, userId, choice);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  // Prompt Wall
  socket.on('prompt_submit', ({ roomId, user, content }: { roomId: string; user: UserProfile; content: string }) => {
    const chk = moderation.preCheck(user.id, 'message', content);
    if (!chk.allowed) return socket.emit('moderation_action', { type: 'message_blocked', message: chk.message });
    const r = engagement.submitPrompt(roomId, user, content);
    if (!r.ok) return socket.emit('game_error', { error: r.error });
    broadcastEngagement(roomId);
  });
  socket.on('prompt_rotate', ({ roomId }: { roomId: string }) => {
    const g = engagement.rotatePrompt(roomId);
    if (g) broadcastEngagement(roomId);
  });
  // Reactions — emoji/reaction system (MVP3)
  socket.on('reaction_toggle', ({ targetId, targetType, userId, emoji, roomId }: { targetId: string; targetType: 'message' | 'profile' | 'submission'; userId: string; emoji: string; roomId?: string }) => {
    const allowed = ['❤️','😂','🔥','👏','😮','🙏','👍','☕','🎧','🚇'];
    if (!allowed.includes(emoji)) return socket.emit('error_message', { error: 'Invalid emoji' });
    const r = engagement.toggleReaction(targetId, targetType, userId, emoji);
    // broadcast to room if known, else global
    if (roomId) io.to(roomId).emit('reaction_updated', { targetId, targetType, state: r.state, roomId });
    else io.emit('reaction_updated', { targetId, targetType, state: r.state, roomId: roomId || '' });
    // also engagement snapshot for prompt wall reactions
    if (roomId) broadcastEngagement(roomId);
    try {
      const logPath = path.join(__dirname, 'data', 'analytics.log');
      fs.appendFileSync(logPath, JSON.stringify({ t: Date.now(), event: 'reaction_toggle', userId, payload: { targetId, targetType, emoji, roomId } }) + '\n');
    } catch {}
  });
  socket.on('fetch_engagement', ({ roomId }: { roomId: string }) => {
    socket.emit('engagement_updated', engagement.getSnapshot(roomId));
  });

  // Also REST fallback for DM history
  // (handled below outside socket, but we emit here for live)

  // ── Disconnect — broadcast leave presence + ephemeral ttl ──
  socket.on('disconnect', () => {
    unregisterSocket(socket.id);

    // Redis-presence rooms the socket joined — drop membership + broadcast leave.
    const pRooms = socketPresenceRooms.get(socket.id);
    if (pRooms && pRooms.size > 0) {
      const pUserId: string | null = socket.data.userId;
      for (const rid of pRooms) {
        socket.leave(rid);
        if (pUserId) void redisPresence.leaveRoom(pUserId, rid);
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
        if (serialized) {
          io.to(rid).emit('room_updated', serialized);
        }
        broadcastPresence(rid, null);
      }
    }
  });
});

// ────────────────────────────────────────
//  MVP2: Live presence tick — keeps hero count feeling genuinely live
// ────────────────────────────────────────
setInterval(() => {
  const all = roomManager.getAllRooms();
  for (const room of all) {
    const serialized = roomManager.serializeRoom(room.id);
    if (!serialized) continue;
    // broadcast only if someone is present to feel live (reduces no-op emits)
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
}, 15_000);

// MVP3: Engagement tick broadcast — push game timers to rooms
let prevEngagementHashes = new Map<string, string>();
setInterval(() => {
  try {
    // iterate engagement games via snapshot
    const rooms = roomManager.getAllRooms().map(r=>r.id);
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
  } catch {}
}, 2000);

let lastWindowState = false;
setInterval(() => {
  const nowLive = isCommuteWindowNow();
  if (nowLive && !lastWindowState) {
    // window just opened — push to all connected sockets
    io.emit('commute_window_live', {
      title: 'Your commute window is live 🚇',
      body: '38 travelers online near you right now — open CoRide to say hi',
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
}, 60_000);

// Last-resort guards: a stray throw in a socket handler or an unhandled promise
// rejection must not take the whole process (and every connected user) down.
// Log and stay up rather than exit.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

server.listen(PORT, () => {
  console.log(`🚇 CoRide server running on port ${PORT} — beachhead ${getBeachheadInfo().line} — MVP2 live layer active`);
});
