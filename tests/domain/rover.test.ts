import test from 'node:test';
import assert from 'node:assert/strict';

import { turnLeft, turnRight, moveForward } from '../../src/domain/rover/transform.ts';
import { executeRoverSequence } from '../../src/domain/rover/execute.ts';
import { validateState } from '../../src/domain/rover/validate.ts';

test('turn left/right keeps position and rotates orientation', () => {
  const state = { x: 1, y: 1, orientation: 'N' as const };
  assert.deepEqual(turnLeft(state), { x: 1, y: 1, orientation: 'W' });
  assert.deepEqual(turnRight(state), { x: 1, y: 1, orientation: 'E' });
});

test('move forward out of bounds stays still and warns', () => {
  const plateau = { xMax: 5, yMax: 5 };
  const state = { x: 0, y: 0, orientation: 'S' as const };
  const { nextState, warning } = moveForward(state, plateau);
  assert.deepEqual(nextState, state);
  assert.equal(warning?.code, 'MOVE_OUT_OF_BOUNDS');
});

test('PRD sequence LMLMLMLMM => (1,3,N)', () => {
  const plateau = { xMax: 5, yMax: 5 };
  const initial = { x: 1, y: 2, orientation: 'N' as const };
  const out = executeRoverSequence(initial, 'LMLMLMLMM', plateau);
  assert.deepEqual(out.finalState, { x: 1, y: 3, orientation: 'N' });
  assert.equal(out.trace.length, 9);
});

test('invalid coordinate outside plateau throws explicit boundary error', () => {
  const plateau = { xMax: 5, yMax: 5 };
  assert.throws(
    () => validateState({ x: 6, y: 2, orientation: 'N' }, plateau),
    (err: unknown) => (err as { code: string })?.code === 'INVALID_COORDINATE' && /fuera de rango/i.test((err as Error)?.message ?? ''),
  );
});

test('orientation domain enforcement rejects unsupported orientation', () => {
  const plateau = { xMax: 5, yMax: 5 };
  assert.throws(
    () => validateState({ x: 1, y: 1, orientation: 'NE' as never }, plateau),
    (err: unknown) => (err as { code: string })?.code === 'INVALID_ORIENTATION',
  );
});
