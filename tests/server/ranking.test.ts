import test from 'node:test';
import assert from 'node:assert/strict';

import { bumpRankingVersion, computeRanking } from '../../server/ranking.js';
import type { RankingPlayer } from '../../server/ranking.js';

test('ranking sorts by score and deterministic playerId tie-break', () => {
  const players = new Map<string, RankingPlayer>();
  players.set('p-b', { playerId: 'p-b', name: 'B', totalScore: 100, connected: true, lastAcceptedAtMs: 1000 });
  players.set('p-c', { playerId: 'p-c', name: 'C', totalScore: 200, connected: true, lastAcceptedAtMs: 900 });
  players.set('p-a', { playerId: 'p-a', name: 'A', totalScore: 100, connected: true, lastAcceptedAtMs: 1000 });
  const ranking = computeRanking(players);
  assert.deepEqual(ranking.map((entry) => entry.playerId), ['p-c', 'p-a', 'p-b']);
});

test('ranking serializes missing and non-finite lastAcceptedAtMs as null', () => {
  const ranking = computeRanking([
    { playerId: 'p-a', name: 'A', totalScore: 0, connected: false },
    { playerId: 'p-b', name: 'B', totalScore: 0, connected: false, lastAcceptedAtMs: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(ranking[0].lastAcceptedAtMs, null);
  assert.equal(ranking[1].lastAcceptedAtMs, null);
});

test('ranking version increments', () => {
  const room = { rankingVersion: 0 } as { rankingVersion: number };
  assert.equal(bumpRankingVersion(room), 1);
  assert.equal(bumpRankingVersion(room), 2);
});
