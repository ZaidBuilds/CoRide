import { v4 as uuidv4 } from 'uuid';

export type PresenceTier = 'active' | 'nearby' | 'other';

interface PresenceEntry {
  userId: string;
  tier: PresenceTier;
  lastHeartbeat: number;
  contextId: string; // station or train room id
  socketId: string;
}

/**
 * Presence Manager
 *
 * Tracks three tiers of user presence:
 * - 🟢 active  — currently interacting with the app
 * - 🟡 nearby  — detected in vicinity but idle
 * - 👥 other   — in same context but further away or long idle
 *
 * Presence decays:
 *   active → nearby (2 min idle) → other (5 min idle) → gone (disconnect)
 */
/** Heartbeat-less time after which a member counts as gone from a context room. */
export const MEMBER_TTL_MS = Number(process.env.CONTEXT_PRESENCE_TTL_SECONDS) * 1000 || 90_000;

const keyOf = (userId: string, contextId: string) => `${userId}\u0000${contextId}`;

/**
 * Presence is tracked per (user, context room). A rider is normally in two
 * rooms at once (station lounge + train); a single per-user entry flipped its
 * contextId on every heartbeat, so each room's count flickered.
 */
export class PresenceManager {
  private static instance: PresenceManager;
  private presenceMap: Map<string, PresenceEntry> = new Map();

  private static readonly ACTIVE_TIMEOUT_MS = 2 * 60 * 1000;  // 2 min
  private static readonly NEARBY_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min
  private static readonly GONE_TIMEOUT_MS = 15 * 60 * 1000;   // 15 min

  private constructor() {
    // Decay loop: every 30 seconds, decay idle users. unref: never keeps a
    // test or a draining process alive.
    setInterval(() => this.decayPresence(), 30_000).unref();
  }

  public static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  /** Record a heartbeat — user is actively interacting */
  public heartbeat(userId: string, contextId: string, socketId: string, now: number = Date.now()): void {
    this.presenceMap.set(keyOf(userId, contextId), {
      userId,
      tier: 'active',
      lastHeartbeat: now,
      contextId,
      socketId
    });
  }

  /** Last heartbeat of a user in one context, if any. */
  public lastHeartbeat(userId: string, contextId: string): number | undefined {
    return this.presenceMap.get(keyOf(userId, contextId))?.lastHeartbeat;
  }

  /** A user's best presence tier across the rooms they are in. */
  public getTier(userId: string): PresenceTier {
    let best: PresenceTier = 'other';
    for (const e of this.presenceMap.values()) {
      if (e.userId !== userId) continue;
      if (e.tier === 'active') return 'active';
      if (e.tier === 'nearby') best = 'nearby';
    }
    return best;
  }

  /** A user's tier in one room. */
  public getTierIn(userId: string, contextId: string): PresenceTier {
    return this.presenceMap.get(keyOf(userId, contextId))?.tier || 'other';
  }

  /** Get all users in a given context, grouped by presence tier */
  public getPresenceForContext(contextId: string): {
    active: string[];
    nearby: string[];
    other: string[];
  } {
    const result = { active: [] as string[], nearby: [] as string[], other: [] as string[] };

    for (const entry of this.presenceMap.values()) {
      if (entry.contextId === contextId) {
        result[entry.tier].push(entry.userId);
      }
    }

    return result;
  }

  /** Count users in a context */
  public countForContext(contextId: string): { active: number; nearby: number; other: number; total: number } {
    const groups = this.getPresenceForContext(contextId);
    return {
      active: groups.active.length,
      nearby: groups.nearby.length,
      other: groups.other.length,
      total: groups.active.length + groups.nearby.length + groups.other.length
    };
  }

  /** Remove user on disconnect / account deletion (all rooms). */
  public removeUser(userId: string): void {
    for (const [k, e] of this.presenceMap.entries()) if (e.userId === userId) this.presenceMap.delete(k);
  }

  /** Remove a user from one room's presence (they left it). */
  public removeFromContext(userId: string, contextId: string): void {
    this.presenceMap.delete(keyOf(userId, contextId));
  }

  /** Remove by socket id (for disconnect handling). Returns the user, if any. */
  public removeBySocket(socketId: string): string | null {
    let userId: string | null = null;
    for (const [k, e] of this.presenceMap.entries()) {
      if (e.socketId === socketId) {
        this.presenceMap.delete(k);
        userId = e.userId;
      }
    }
    return userId;
  }

  /** Decay idle users: active→nearby→other→gone */
  public decayPresence(now: number = Date.now()): void {
    for (const [k, entry] of this.presenceMap.entries()) {
      const idle = now - entry.lastHeartbeat;

      if (idle > PresenceManager.GONE_TIMEOUT_MS) {
        this.presenceMap.delete(k);
      } else if (idle > PresenceManager.NEARBY_TIMEOUT_MS && entry.tier !== 'other') {
        entry.tier = 'other';
      } else if (idle > PresenceManager.ACTIVE_TIMEOUT_MS && entry.tier === 'active') {
        entry.tier = 'nearby';
      }
    }
    // MVP2: live jitter — seeded commuters fluctuate to make hero count feel genuinely live
    if (Math.random() < 0.35) {
      const seeded = Array.from(this.presenceMap.values()).filter(e => e.userId.startsWith('seed_'));
      if (seeded.length) {
        const e = seeded[Math.floor(Math.random() * seeded.length)];
        // flip between active/nearby occasionally
        if (e.tier === 'other' && Math.random() < 0.25) { e.tier = 'nearby'; e.lastHeartbeat = now - 3 * 60 * 1000; }
        else if (e.tier === 'nearby' && Math.random() < 0.5) { e.tier = 'active'; e.lastHeartbeat = now; }
        else if (e.tier === 'active' && Math.random() < 0.15) { e.tier = 'nearby'; }
      }
    }
  }

  /** Active count for hero metric */
  public getActiveCount(contextId: string): number {
    let c = 0;
    for (const e of this.presenceMap.values()) if (e.contextId === contextId && e.tier === 'active') c++;
    return c;
  }

  /** Seed presence entries for demo simulation */
  public seedPresence(userId: string, contextId: string, tier: PresenceTier): void {
    this.presenceMap.set(keyOf(userId, contextId), {
      userId,
      tier,
      lastHeartbeat: Date.now() - (
        tier === 'active' ? 0 :
        tier === 'nearby' ? PresenceManager.ACTIVE_TIMEOUT_MS + 10_000 :
        PresenceManager.NEARBY_TIMEOUT_MS + 10_000
      ),
      contextId,
      socketId: `seed_${userId}`
    });
  }
}
