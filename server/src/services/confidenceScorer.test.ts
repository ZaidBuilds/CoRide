import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateConfidence, ConfidenceBreakdown } from './confidenceScorer';

const close = (a: number, b: number, digits = 3) => assert.ok(Math.abs(a - b) < 10 ** -digits / 2, `${a} ≉ ${b}`);

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
    // rawScore = 30+25+20+20+50 = 145, no decay → 145 / 145 = 1
    close(result.confidence, 145 / 145);
    assert.deepEqual(result.breakdown, maxBreakdown);
  });

  test('old input (0.80 decay) reduces the score', () => {
    const result = calculateConfidence(maxBreakdown, 700_000);
    // rawScore = 145, decay = 0.80 → decayedRaw = 116, 116 / 145 = 0.8
    close(result.confidence, 116 / 145);
  });

  test('middle-aged input (0.92 decay) reduces the score', () => {
    const result = calculateConfidence(maxBreakdown, 300_000);
    // rawScore = 145, decay = 0.92 → decayedRaw = 133.4, 133.4 / 145 = 0.92
    close(result.confidence, 133.4 / 145);
  });

  test('zero breakdown yields zero confidence', () => {
    const result = calculateConfidence(zeroBreakdown, 0);
    assert.equal(result.confidence, 0);
  });

  test('confidence is never above 1', () => {
    const result = calculateConfidence(maxBreakdown, 0);
    assert.ok(result.confidence <= 1);
  });

  test('confidence is never below 0', () => {
    const result = calculateConfidence(zeroBreakdown, 100_000);
    assert.ok(result.confidence >= 0);
  });
});