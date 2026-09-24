import Redis from 'ioredis';

/**
 * Redis-backed live presence for manually-picked rooms.
 *
 * Room key format: {station}:{line}:{direction}
 *
 * Why two keys per room instead of one set with a TTL:
 * a Redis SET carries a single TTL for the whole key, so expiring it would drop
 * every traveler at once, and any one heartbeat would keep the entire room alive.
 * Membership therefore lives in the set, while the 30-minute TTL lives on a
 * per-user key. getRoom() intersects the two and prunes whoever has lapsed.
 */

// Live-presence window. Kept large enough for a meaningful `away` tier
// (see getState): a recent heartbeat (< AWAY_SECONDS) is `active`, anything
// older but still inside the window is `away`. An abandoned session (tab closed,
// no `leave`) clears from the room once the window lapses. Override via env;
// seeds pass their own long TTL and read as `active`.
const TTL_SECONDS = Number(process.env.PRESENCE_TTL_SECONDS) || 300;

// A heartbeat fresher than this is `active`; older but still within the TTL
// window is `away`. Mirrors PRAGMA in the room response.
const AWAY_SECONDS = Number(process.env.PRESENCE_AWAY_SECONDS) || 60;

export type PresenceState = 'active' | 'away';

export interface PresenceRoomId {
  station: string;
  line: string;
  direction: string;
}

/** Build the canonical room id. Lowercased so casing can never split a room. */
export function buildRoomId({ station, line, direction }: PresenceRoomId): string {
  return [station, line, direction].map(p => p.trim().toLowerCase()).join(':');
}

const membersKey = (roomId: string) => `room:${roomId}`;
const aliveKey = (roomId: string, userId: string) => `presence:${roomId}:${userId}`;

export class RedisPresence {
  private static instance: RedisPresence;
  private redis: Redis;
  /** Dedupes the reconnect-error log so a down Redis can't flood stdout. */
  private lastErrorCode: string | undefined;

  private constructor(redis?: Redis) {
    this.redis =
      redis ??
      new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
        // Defaults retry 20x with backoff, so a single call blocked for ~96s
        // while Redis was down. At a 15s poll that queues up and reads as a
        // hang rather than an error. Fail in milliseconds instead.
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000
      });

    // ioredis emits 'error' on every reconnect attempt; an EventEmitter 'error'
    // with no listener is an uncaught exception that would take the process down.
    this.redis.on('error', (err: Error & { code?: string }) => {
      if (err.code !== this.lastErrorCode) {
        this.lastErrorCode = err.code;
        console.warn('[redisPresence] connection error:', err.code || err.message);
      }
    });
  }

  public static getInstance(redis?: Redis): RedisPresence {
    if (!RedisPresence.instance) RedisPresence.instance = new RedisPresence(redis);
    return RedisPresence.instance;
  }

  /** Add a user to a room and start their presence window (default TTL_SECONDS). */
  public async joinRoom(userId: string, roomId: string, ttlSeconds: number = TTL_SECONDS): Promise<void> {
    await this.redis
      .multi()
      .sadd(membersKey(roomId), userId)
      .set(aliveKey(roomId, userId), '1', 'EX', ttlSeconds)
      .exec();
  }

  /** Remove a user from a room immediately. */
  public async leaveRoom(userId: string, roomId: string): Promise<void> {
    await this.redis
      .multi()
      .srem(membersKey(roomId), userId)
      .del(aliveKey(roomId, userId))
      .exec();
  }

  /**
   * Refresh a user's TTL. Re-adds them to the set so a user whose key lapsed
   * between polls is not silently absent from the room while still heartbeating.
   */
  public async heartbeat(userId: string, roomId: string): Promise<void> {
    await this.joinRoom(userId, roomId);
  }

  /**
   * Live user ids for a room. Members whose TTL key has expired are dropped from
   * the set here, so the set self-cleans on read rather than growing forever.
   */
  public async getRoom(roomId: string): Promise<string[]> {
    const members = await this.redis.smembers(membersKey(roomId));
    if (members.length === 0) return [];

    const alive = await this.redis.mget(members.map(id => aliveKey(roomId, id)));

    const live: string[] = [];
    const stale: string[] = [];
    members.forEach((id, i) => (alive[i] === null ? stale : live).push(id));

    if (stale.length) await this.redis.srem(membersKey(roomId), ...stale);

    return live;
  }

  /** Live count without materialising the id list. */
  public async countRoom(roomId: string): Promise<number> {
    return (await this.getRoom(roomId)).length;
  }

  /**
   * Presence state from the remaining TTL. A key that was *just* heartbeated
   * still holds most of its TTL → `active`; one close to expiry → `away`
   * (heartbeat 60s–5min ago). Seeds carry a 24h TTL, so their remaining value
   * is huge and they read as `active`.
   */
  public async getState(userId: string, roomId: string): Promise<PresenceState | null> {
    const ttl = await this.redis.pttl(aliveKey(roomId, userId));
    // -2 = key missing (expired/never joined). -1 would mean no expiry, which
    // we never set — treat defensively as `active`.
    if (ttl === -2) return null;
    return ttl < 0 || ttl > (TTL_SECONDS - AWAY_SECONDS) * 1000 ? 'active' : 'away';
  }

  /**
   * Bulk state lookup for a whole room — a single pipelined PTTL round-trip
   * instead of N sequential ones when the room endpoint resolves every traveler.
   */
  public async getStates(roomId: string, userIds: string[]): Promise<Map<string, PresenceState>> {
    if (userIds.length === 0) return new Map();
    const states = new Map<string, PresenceState>();
    const res = await this.redis.pipeline(userIds.map(id => ['pttl', aliveKey(roomId, id)] as [string, string])).exec();
    if (!res) return states;
    const ttlMs = res;
    userIds.forEach((id, i) => {
      const ttl = ttlMs[i]?.[1] as number | null;
      if (ttl === null || ttl === undefined) return;
      if (ttl === -2) return; // expired / not present
      const state: PresenceState = ttl < 0 || ttl > (TTL_SECONDS - AWAY_SECONDS) * 1000 ? 'active' : 'away';
      states.set(id, state);
    });
    return states;
  }

  public async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /** True when the client has a live connection (for /healthz). */
  public isReady(): boolean {
    return this.redis.status === 'ready';
  }

  /** Shutdown: close without waiting on a server that may be down. */
  public async close(): Promise<void> {
    try {
      if (this.redis.status === 'ready') await this.redis.quit();
      else this.redis.disconnect();
    } catch {
      this.redis.disconnect();
    }
  }
}
