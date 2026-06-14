import test from 'node:test';
import assert from 'node:assert/strict';

import { computeScoreFromElapsedMs } from '../../src/domain/scoring/index.js';

test('scoring matches MVP examples', () => {
  assert.equal(computeScoreFromElapsedMs(2_000), 910);
  assert.equal(computeScoreFromElapsedMs(10_000), 550);
  assert.equal(computeScoreFromElapsedMs(19_500), 122);
  assert.equal(computeScoreFromElapsedMs(20_100), 0);
});

test('scoring covers round boundary cases', () => {
  assert.equal(computeScoreFromElapsedMs(0), 1_000);
  assert.equal(computeScoreFromElapsedMs(20_000), 100);
  assert.equal(computeScoreFromElapsedMs(20_001), 0);
});
