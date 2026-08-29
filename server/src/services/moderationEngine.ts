/**
 * Moderation Engine
 *
 * Rate limiting, reputation scoring, anti-spam.
 * Runs on every user action as middleware.
 */

interface RateBucket {
  count: number;
  windowStart: number;
}

interface ReputationEntry {
  userId: string;
  score: number;         // starts at 100
  totalReports: number;
  totalBlocks: number;
  positiveInteractions: number;
  createdAt: number;
}

export class ModerationEngine {
  private static instance: ModerationEngine;

  // Rate limits: userId → action → bucket
  private rateBuckets: Map<string, Map<string, RateBucket>> = new Map();

  // Reputation: userId → entry
  private reputations: Map<string, ReputationEntry> = new Map();

  // Spam detection: recent message hashes
  private recentMessages: Map<string, string[]> = new Map();

  private static readonly LIMITS: Record<string, { max: number; windowMs: number }> = {
    'connection_request': { max: 10, windowMs: 60 * 60 * 1000 },   // 10/hour
    'message': { max: 60, windowMs: 60 * 1000 },                     // 60/min
    'report': { max: 5, windowMs: 60 * 60 * 1000 },                  // 5/hour
    'block': { max: 20, windowMs: 24 * 60 * 60 * 1000 },             // 20/day
  };

  private static readonly MUTE_THRESHOLD = 30;
  private static readonly SHADOW_BAN_THRESHOLD = 10;

  private constructor() {}

  public static getInstance(): ModerationEngine {
    if (!ModerationEngine.instance) {
      ModerationEngine.instance = new ModerationEngine();
    }
    return ModerationEngine.instance;
  }

  // ─── Rate Limiting ───

  public checkRateLimit(userId: string, action: string): { allowed: boolean; message: string; remaining: number } {
    const limit = ModerationEngine.LIMITS[action];
    if (!limit) return { allowed: true, message: 'OK', remaining: Infinity };

    if (!this.rateBuckets.has(userId)) {
      this.rateBuckets.set(userId, new Map());
    }
    const userBuckets = this.rateBuckets.get(userId)!;

    const now = Date.now();
    let bucket = userBuckets.get(action);

    if (!bucket || now - bucket.windowStart > limit.windowMs) {
      bucket = { count: 0, windowStart: now };
      userBuckets.set(action, bucket);
    }

    if (bucket.count >= limit.max) {
      return {
        allowed: false,
        message: `Rate limit exceeded for ${action}. Try again later.`,
        remaining: 0
      };
    }

    bucket.count++;
    return {
      allowed: true,
      message: 'OK',
      remaining: limit.max - bucket.count
    };
  }

  // ─── Reputation ───

  public getReputation(userId: string): ReputationEntry {
    if (!this.reputations.has(userId)) {
      this.reputations.set(userId, {
        userId,
        score: 100,
        totalReports: 0,
        totalBlocks: 0,
        positiveInteractions: 0,
        createdAt: Date.now()
      });
    }
    return this.reputations.get(userId)!;
  }

  public decrementReputation(userId: string, amount: number, reason: 'report' | 'block'): void {
    const rep = this.getReputation(userId);
    rep.score = Math.max(0, rep.score - amount);
    if (reason === 'report') rep.totalReports++;
    if (reason === 'block') rep.totalBlocks++;
  }

  public incrementReputation(userId: string, amount: number): void {
    const rep = this.getReputation(userId);
    rep.score = Math.min(200, rep.score + amount);
    rep.positiveInteractions++;
  }

  public isMuted(userId: string): boolean {
    return this.getReputation(userId).score < ModerationEngine.MUTE_THRESHOLD;
  }

  public isShadowBanned(userId: string): boolean {
    return this.getReputation(userId).score < ModerationEngine.SHADOW_BAN_THRESHOLD;
  }

  // ── MVP4: Trust signals ──
  public getTrustTier(userId: string): 'newcomer' | 'regular' | 'trusted' | 'verified' {
    const rep = this.getReputation(userId);
    const ageDays = (Date.now() - (rep as any).createdAt) / (1000 * 60 * 60 * 24) || 0;
    // Use reputation score as primary
    if (rep.score >= 150 && rep.positiveInteractions >= 5 && rep.totalReports === 0) return 'verified';
    if (rep.score >= 130 && rep.positiveInteractions >= 3 && rep.totalReports === 0) return 'trusted';
    if (rep.score >= 80) return 'regular';
    return 'newcomer';
  }

  public getTrustInfo(userId: string) {
    const rep = this.getReputation(userId);
    const tier = this.getTrustTier(userId);
    const badge = tier === 'verified' ? '✅ Verified commuter' : tier === 'trusted' ? '⭐ Trusted' : tier === 'regular' ? '👋 Regular' : '🌱 New';
    return { tier, badge, score: rep.score, reports: rep.totalReports, blocks: rep.totalBlocks, positive: rep.positiveInteractions };
  }

  public recordPositive(userId: string, amount = 2) {
    this.incrementReputation(userId, amount);
  }

  // ─── Anti-Spam ───

  public checkSpam(userId: string, message: string): { isSpam: boolean; reason?: string } {
    // 1. URL detection (block URLs in ephemeral chat)
    const urlPattern = /https?:\/\/\S+|www\.\S+/i;
    if (urlPattern.test(message)) {
      return { isSpam: true, reason: 'Links are not allowed in transit chat.' };
    }

    // 2. Duplicate message detection
    if (!this.recentMessages.has(userId)) {
      this.recentMessages.set(userId, []);
    }
    const recent = this.recentMessages.get(userId)!;
    const normalized = message.trim().toLowerCase();

    const dupeCount = recent.filter(m => m === normalized).length;
    if (dupeCount >= 3) {
      return { isSpam: true, reason: 'Duplicate message detected.' };
    }

    recent.push(normalized);
    if (recent.length > 20) recent.shift();

    // 3. Message too long
    if (message.length > 500) {
      return { isSpam: true, reason: 'Message too long (max 500 characters).' };
    }

    return { isSpam: false };
  }

  /** Full pre-action check: rate limit + reputation + spam */
  public preCheck(
    userId: string,
    action: string,
    messageContent?: string
  ): { allowed: boolean; message: string } {
    // Check shadow ban
    if (this.isShadowBanned(userId)) {
      return { allowed: false, message: 'Your account is temporarily restricted.' };
    }

    // Check mute (for message actions)
    if (action === 'message' && this.isMuted(userId)) {
      return { allowed: false, message: 'You are temporarily muted due to reports.' };
    }

    // Rate limit
    const rateCheck = this.checkRateLimit(userId, action);
    if (!rateCheck.allowed) {
      return { allowed: false, message: rateCheck.message };
    }

    // Spam check (for messages)
    if (action === 'message' && messageContent) {
      const spamCheck = this.checkSpam(userId, messageContent);
      if (spamCheck.isSpam) {
        return { allowed: false, message: spamCheck.reason || 'Spam detected.' };
      }
    }

    return { allowed: true, message: 'OK' };
  }
}
