/**
 * Pure confidence scorer — given a confidence breakdown and the age of the
 * input (in ms since the timestamp), returns the overall confidence score
 * (0–1) and the breakdown unchanged.
 *
 * The score applies an exponential-time decay so that very old detections
 * are weighted less heavily, matching the logic in
 * {@link TransitContextEngine.evaluate}.
 */
export interface ConfidenceBreakdown {
  stationMatch: number;   // 0–30
  routeMatch: number;     // 0–25
  movementMatch: number;  // 0–20
  scheduleMatch: number;  // 0–20
  userConfirm: number;    // 0 or 50
}

/**
 * Compute the overall confidence score from a breakdown and the elapsed time
 * since the original timestamp.
 *
 * @param breakdown   the per-signal match scores
 * @param ageMsTotal  milliseconds since the original timestamp (e.g.
 *                    `Date.now() - input.timestamp`).  If `undefined` the
 *                    decay factor is `1` (no ageing).
 * @returns an object with the overall confidence (0–1) and the breakdown
 *          (convenient for callers that only need the score).
 */
export function calculateConfidence(
  breakdown: ConfidenceBreakdown,
  ageMsTotal?: number
): { confidence: number; breakdown: ConfidenceBreakdown } {
  const rawScore =
    breakdown.stationMatch +
    breakdown.routeMatch +
    breakdown.movementMatch +
    breakdown.scheduleMatch +
    breakdown.userConfirm;

  // time‑decay factor
  let timeDecay = 1;
  if (ageMsTotal !== undefined) {
    if (ageMsTotal > 600_000) timeDecay = 0.8;
    else if (ageMsTotal > 180_000) timeDecay = 0.92;
  }

  const decayedRaw = rawScore * timeDecay;
  const confidence = Math.min(decayedRaw / 145, 1);

  return { confidence, breakdown };
}