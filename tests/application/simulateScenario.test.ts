import test from 'node:test';
import assert from 'node:assert/strict';

import { parseScenario } from '../../src/application/parser.ts';
import { simulateScenario } from '../../src/application/simulateScenario.ts';

test('parser valid and invalid', () => {
  const ok = parseScenario('5 5\n1 2 N\nLMLMLMLMM\n3 3 E\nMMRMMRMRRM');
  assert.equal(ok.ok, true);
  assert.equal((ok as { value: { rovers: unknown[] } }).value.rovers.length, 2);

  const bad = parseScenario('5 5\n1 2 N\nLMX');
  assert.equal(bad.ok, false);
  assert.equal((bad as { errors: { code: string }[] }).errors[0].code, 'PARSE_COMMAND_INVALID');
});

test('parser rejects malformed rover block with missing command line', () => {
  const bad = parseScenario('5 5\n1 2 N\nLMLMLMLMM\n3 3 E');
  assert.equal(bad.ok, false);
  assert.equal((bad as { errors: { code: string }[] }).errors.some((e) => e.code === 'PARSE_ROVER_BLOCK_INCOMPLETE'), true);
});

test('global timeline order is A then B', () => {
  const parsed = parseScenario('5 5\n1 2 N\nLMLMLMLMM\n3 3 E\nMMRMMRMRRM');
  assert.equal(parsed.ok, true);
  const out = simulateScenario((parsed as { value: Parameters<typeof simulateScenario>[0] }).value);

  assert.equal(out.finals.length, 2);
  assert.deepEqual(out.finals[0].state, { x: 1, y: 3, orientation: 'N' });
  assert.deepEqual(out.finals[1].state, { x: 5, y: 1, orientation: 'E' });
  assert.equal(out.timeline.slice(0, 9).every((f) => f.roverId === 'R1'), true);
  assert.equal(out.timeline.slice(9).every((f) => f.roverId === 'R2'), true);
});
