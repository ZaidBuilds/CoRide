import type { UserProfile } from '../types';

/**
 * Pure rankTravelers — ranks an array of UserProfile objects by mutual interest,
 * college match, presence tier, trust tier, recency, and karma score.
 *
 * No roomManager, PresenceManager, or ModerationEngine dependencies —
 * completely testable in isolation.
 */
export interface RankTraveler {
  profile: UserProfile;
  score: number;
  breakdown: {
    mutual: number;     // 0-15 per matching tag
    presence: number;   // 0-10 (active=10, nearby=5, other=0)
    trust: number;      // 0-12 (based on trust tier)
    college: number;    // 0-10 (match=10, else=0)
    recency: number;    // 0-2 (joined <14 days ago)
    total: number;
  };
  mutualTags: string[];
  mutualCount: number;
}

/**
 * Compute a single traveler's rank against a viewer profile.
 */
function rankSingleTraveler(
  viewer: UserProfile,
  traveler: UserProfile
): { score: number; breakdown: RankTraveler['breakdown']; mutualTags: string[]; mutualCount: number } {
  // Mutual interest tags
  const mutualTags = viewer.interestTags.filter((t) => traveler.interestTags.includes(t));
  const mutualCount = mutualTags.length;
  const mutualScore = mutualCount * 15;

  // College match
  const collegeScore = viewer.collegeOrTag && traveler.collegeOrTag
    && viewer.collegeOrTag === traveler.collegeOrTag ? 10 : 0;

  // Presence tier (simplified: verified phone = active, otherwise other)
  const presenceScore = traveler.isVerifiedPhone ? 10 : 0;

  // Trust tier (from moderation simplified)
  const trustTier: 'verified' | 'trusted' | 'regular' | 'newcomer' = 'regular'; // simplified
  const trustMap: Record<string, number> = { verified: 12, trusted: 8, regular: 4, newcomer: 0 };
  const trustScore = trustMap[trustTier] ?? 0;

  // Recency: joined <14 days = 2 points
  const joinedAt = traveler.joinedAt ?? 0;
  const recency = (Date.now() - joinedAt) < 14 * 24 * 60 * 60 * 1000 ? 2 : 0;

  // Karma (simplified: score / 20, capped at 5)
  const karma = Math.round(traveler.karmaScore / 20);
  const cappedKarma = Math.min(karma, 5);

  const total = mutualScore + presenceScore + trustScore + collegeScore + recency + cappedKarma;

  return {
    score: total,
    breakdown: {
      mutual: mutualScore,
      presence: presenceScore,
      trust: trustScore + cappedKarma,
      college: collegeScore,
      recency,
      total,
    },
    mutualTags,
    mutualCount,
  };
}

/**
 * Rank an array of travelers against a viewer profile.
 * Returns ranked list from highest to lowest score.
 */
export function rankTravelers(
  viewer: UserProfile,
  travelers: UserProfile[]
): RankTraveler[] {
  const ranked = travelers
    .filter((t) => t.id !== viewer.id)
    .map((t) => {
      const { score, breakdown, mutualTags, mutualCount } = rankSingleTraveler(viewer, t);
      return {
        profile: t,
        score,
        breakdown,
        mutualTags,
        mutualCount,
      } as RankTraveler;
    });

  // sort by score desc, then by mutualCount desc, then by profile.id asc for stability
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount;
    return a.profile.id.localeCompare(b.profile.id);
  });

  return ranked;
}