import { RoomManager } from '../roomManager';
import { PresenceManager } from '../presenceManager';
import { ModerationEngine } from '../moderationEngine';
import type { UserProfile } from '../../types';

export interface RankedTraveler {
  profile: UserProfile & { presenceTier?: string };
  score: number;
  breakdown: { mutual: number; presence: number; trust: number; college: number; recency: number; total: number };
  mutualTags: string[];
  mutualCount: number;
  trustTier: string;
  trustBadge: string;
}

export class RankingService {
  private static instance: RankingService;
  private roomManager = RoomManager.getInstance();
  private presence = PresenceManager.getInstance();
  private moderation = ModerationEngine.getInstance();

  private constructor() {}
  static getInstance(): RankingService {
    if (!RankingService.instance) RankingService.instance = new RankingService();
    return RankingService.instance;
  }

  rankForViewer(viewerId: string, roomId: string, includeFriends = false): RankedTraveler[] {
    const viewer = this.roomManager.getUserProfile(viewerId);
    if (!viewer) return [];
    const room = this.roomManager.getRoom(roomId);
    if (!room) return [];
    const candidates = this.roomManager.getRoomUsers(roomId).filter(u => u.id !== viewerId);
    // filter friends if not included? We'll need connectionManager to check; lazy import to avoid cycle
    let filtered = candidates;
    try {
      const { ConnectionManager } = require('../connectionManager');
      const cm = ConnectionManager.getInstance();
      if (!includeFriends) {
        filtered = candidates.filter(u => !cm.areFriends(viewerId, u.id) && !cm.isBlocked(viewerId, u.id));
      }
    } catch {}

    const ranked = filtered.map(candidate => {
      const mutual = viewer.interestTags.filter(t => candidate.interestTags.includes(t));
      const mutualScore = mutual.length * 15;
      const collegeScore = viewer.collegeOrTag && candidate.collegeOrTag && viewer.collegeOrTag === candidate.collegeOrTag ? 10 : 0;
      const tier = this.presence.getTier(candidate.id);
      const presenceScore = tier === 'active' ? 10 : tier === 'nearby' ? 5 : 0;
      const trustInfo = this.moderation.getTrustInfo(candidate.id);
      const trustMap: Record<string, number> = { verified: 12, trusted: 8, regular: 4, newcomer: 0 };
      const trustScore = trustMap[trustInfo.tier] ?? 0;
      const recency = (Date.now() - candidate.joinedAt) < 14 * 24 * 60 * 60 * 1000 ? 2 : 0;
      const karma = Math.round(candidate.karmaScore / 20); // 5-10
      const total = mutualScore + presenceScore + trustScore + collegeScore + recency + karma;
      // enrich candidate with tier for UI
      const enriched = { ...candidate, presenceTier: tier } as any;
      return {
        profile: enriched,
        score: total,
        breakdown: { mutual: mutualScore, presence: presenceScore, trust: trustScore + karma, college: collegeScore, recency, total },
        mutualTags: mutual,
        mutualCount: mutual.length,
        trustTier: trustInfo.tier,
        trustBadge: trustInfo.badge
      } as RankedTraveler;
    });

    // sort by score desc, then presence
    const order: Record<string, number> = { active: 0, nearby: 1, other: 2 };
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const at = order[(a.profile.presenceTier as any) || 'other'] ?? 2;
      const bt = order[(b.profile.presenceTier as any) || 'other'] ?? 2;
      return at - bt;
    });
    return ranked;
  }

  vibeForViewer(viewerId: string, roomId: string, topN = 3): RankedTraveler[] {
    const all = this.rankForViewer(viewerId, roomId, false);
    // vibe requires at least 1 mutual tag, boost mutual heavily
    const vibe = all.filter(r => r.mutualCount >= 1).sort((a,b)=> b.mutualCount - a.mutualCount || b.score - a.score);
    if (vibe.length >= topN) return vibe.slice(0, topN);
    // fill with top ranked if not enough mutual
    const filler = all.filter(r => !vibe.some(v=>v.profile.id===r.profile.id));
    return [...vibe, ...filler].slice(0, topN);
  }
}
