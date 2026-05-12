import test from 'node:test';
import assert from 'node:assert/strict';

import { bumpRankingVersion, computeRanking } from '../../server/ranking.js';

test('ranking tie-break is deterministic', () => {
  const players = new Map();
  players.set('p-b', { playerId: 'p-b', name: 'B', totalScore: 100, connected: true, lastAcceptedAtMs: 1000 });
  players.set('p-a', { playerId: 'p-a', name: 'A', totalScore: 100, connected: true, lastAcceptedAtMs: 1000 });
  const ranking = computeRanking(players);
  assert.equal(ranking[0].playerId, 'p-a');
});

test('ranking version increments', () => {
  const room = { rankingVersion: 0 };
  assert.equal(bumpRankingVersion(room), 1);
  assert.equal(bumpRankingVersion(room), 2);
});
