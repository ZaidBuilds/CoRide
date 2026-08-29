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
export class PresenceManager {
  private static instance: PresenceManager;
  private presenceMap: Map<string, PresenceEntry> = new Map();

  private static readonly ACTIVE_TIMEOUT_MS = 2 * 60 * 1000;  // 2 min
  private static readonly NEARBY_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min
  private static readonly GONE_TIMEOUT_MS = 15 * 60 * 1000;   // 15 min

  private constructor() {
    // Decay loop: every 30 seconds, decay idle users
    setInterval(() => this.decayPresence(), 30_000);
  }

  public static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  /** Record a heartbeat — user is actively interacting */
  public heartbeat(userId: string, contextId: string, socketId: string): void {
    this.presenceMap.set(userId, {
      userId,
      tier: 'active',
      lastHeartbeat: Date.now(),
      contextId,
      socketId
    });
  }

  /** Get a user's current presence tier */
  public getTier(userId: string): PresenceTier {
    const entry = this.presenceMap.get(userId);
    if (!entry) return 'other';
    return entry.tier;
  }

  /** Get all users in a given context, grouped by presence tier */
  public getPresenceForContext(contextId: string): {
    active: string[];
    nearby: string[];
    other: string[];
  } {
    const result = { active: [] as string[], nearby: [] as string[], other: [] as string[] };

    for (const [userId, entry] of this.presenceMap.entries()) {
      if (entry.contextId === contextId) {
        result[entry.tier].push(userId);
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

  /** Remove user on disconnect */
  public removeUser(userId: string): void {
    this.presenceMap.delete(userId);
  }

  /** Remove by socket id (for disconnect handling) */
  public removeBySocket(socketId: string): string | null {
    for (const [userId, entry] of this.presenceMap.entries()) {
      if (entry.socketId === socketId) {
        this.presenceMap.delete(userId);
        return userId;
      }
    }
    return null;
  }

  /** Decay idle users: active→nearby→other→gone */
  private decayPresence(): void {
    const now = Date.now();

    for (const [userId, entry] of this.presenceMap.entries()) {
      const idle = now - entry.lastHeartbeat;

      if (idle > PresenceManager.GONE_TIMEOUT_MS) {
        this.presenceMap.delete(userId);
      } else if (idle > PresenceManager.NEARBY_TIMEOUT_MS && entry.tier !== 'other') {
        entry.tier = 'other';
      } else if (idle > PresenceManager.ACTIVE_TIMEOUT_MS && entry.tier === 'active') {
        entry.tier = 'nearby';
      }
    }
    // MVP2: live jitter — seeded commuters fluctuate to make hero count feel genuinely live
    if (Math.random() < 0.35) {
      const seeded = Array.from(this.presenceMap.entries()).filter(([uid]) => uid.startsWith('seed_'));
      if (seeded.length) {
        const [uid, e] = seeded[Math.floor(Math.random() * seeded.length)];
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
    this.presenceMap.set(userId, {
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
