import test from 'node:test';
import assert from 'node:assert/strict';

import { turnLeft, turnRight, moveForward } from '../../../src/domain/rover/transform.js';
import { executeRoverSequence } from '../../../src/domain/rover/execute.js';
import { validateState } from '../../../src/domain/rover/validate.js';

test('turn left/right keeps position and rotates orientation', () => {
  const state = { x: 1, y: 1, orientation: 'N' };
  assert.deepEqual(turnLeft(state), { x: 1, y: 1, orientation: 'W' });
  assert.deepEqual(turnRight(state), { x: 1, y: 1, orientation: 'E' });
});

test('move forward out of bounds stays still and warns', () => {
  const plateau = { xMax: 5, yMax: 5 };
  const state = { x: 0, y: 0, orientation: 'S' };
  const { nextState, warning } = moveForward(state, plateau);
  assert.deepEqual(nextState, state);
  assert.equal(warning.code, 'MOVE_OUT_OF_BOUNDS');
});

test('PRD sequence LMLMLMLMM => (1,3,N)', () => {
  const plateau = { xMax: 5, yMax: 5 };
  const initial = { x: 1, y: 2, orientation: 'N' };
  const out = executeRoverSequence(initial, 'LMLMLMLMM', plateau);
  assert.deepEqual(out.finalState, { x: 1, y: 3, orientation: 'N' });
  assert.equal(out.trace.length, 9);
});

test('invalid coordinate outside plateau throws explicit boundary error', () => {
  const plateau = { xMax: 5, yMax: 5 };
  assert.throws(
    () => validateState({ x: 6, y: 2, orientation: 'N' }, plateau),
    (err) => err?.code === 'INVALID_COORDINATE' && /fuera de rango/i.test(err?.message),
  );
});

test('orientation domain enforcement rejects unsupported orientation', () => {
  const plateau = { xMax: 5, yMax: 5 };
  assert.throws(
    () => validateState({ x: 1, y: 1, orientation: 'NE' }, plateau),
    (err) => err?.code === 'INVALID_ORIENTATION',
  );
});
