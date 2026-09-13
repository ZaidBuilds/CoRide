import { calculateConfidence, ConfidenceBreakdown } from './confidenceScorer';

describe('calculateConfidence', () => {
  const maxBreakdown: ConfidenceBreakdown = {
    stationMatch: 30,
    routeMatch: 25,
    movementMatch: 20,
    scheduleMatch: 20,
    userConfirm: 50,
  };

  const zeroBreakdown: ConfidenceBreakdown = {
    stationMatch: 0,
    routeMatch: 0,
    movementMatch: 0,
    scheduleMatch: 0,
    userConfirm: 0,
  };

  test('young input (no decay) returns rawScore / 145', () => {
    const result = calculateConfidence(maxBreakdown, 0);
    // rawScore = 125, no decay → 125 / 145 ≈ 0.862
    expect(result.confidence).toBeCloseTo(125 / 145, 3);
    expect(result.breakdown).toEqual(maxBreakdown);
  });

  test('old input (0.80 decay) reduces the score', () => {
    const result = calculateConfidence(maxBreakdown, 700_000);
    // rawScore = 125, decay = 0.80 → decayedRaw = 100, 100 / 145 ≈ 0.690
    expect(result.confidence).toBeCloseTo(100 / 145, 3);
  });

  test('middle-aged input (0.92 decay) reduces the score', () => {
    const result = calculateConfidence(maxBreakdown, 300_000);
    // rawScore = 125, decay = 0.92 → decayedRaw = 115, 115 / 145 ≈ 0.793
    expect(result.confidence).toBeCloseTo(115 / 145, 3);
  });

  test('zero breakdown yields zero confidence', () => {
    const result = calculateConfidence(zeroBreakdown, 0);
    expect(result.confidence).toBe(0);
  });

  test('confidence is never above 1', () => {
    const result = calculateConfidence(maxBreakdown, 0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('confidence is never below 0', () => {
    const result = calculateConfidence(zeroBreakdown, 100_000);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});