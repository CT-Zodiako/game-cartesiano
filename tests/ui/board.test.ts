import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellToPixel, pixelToCell } from '../../src/ui/phaser/board.ts';

const plateau = { xMax: 10, yMax: 10 };
const width = 660;
const height = 660;

for (const x of [-10, 10]) {
  for (const y of [-10, 10]) {
    test(`selects corner (${x}, ${y}) exactly and with an inward offset`, () => {
      const { px, py } = cellToPixel(x, y, plateau, width, height);
      assert.deepEqual(pixelToCell(px, py, plateau, width, height), { x, y });
      assert.deepEqual(pixelToCell(px - Math.sign(x) * 8, py + Math.sign(y) * 8, plateau, width, height), { x, y });
      assert.equal(pixelToCell(px + Math.sign(x) * 14, py, plateau, width, height), null);
      assert.equal(pixelToCell(px, py - Math.sign(y) * 14, plateau, width, height), null);
    });
  }
}

test('rejects nearby misses and snaps to the nearest adjacent vertex', () => {
  assert.equal(pixelToCell(44, 30, plateau, width, height), null);
  assert.equal(pixelToCell(45, 30, plateau, width, height), null);
  assert.deepEqual(pixelToCell(52, 30, plateau, width, height), { x: -9, y: 10 });
});

test('bounds the radius by the smaller grid step on a rectangular board', () => {
  assert.deepEqual(pixelToCell(34, 30, plateau, 260, 660), { x: -10, y: 10 });
  assert.equal(pixelToCell(35, 30, plateau, 260, 660), null);
});

test('caps large-grid targets and preserves explicit smaller radii', () => {
  assert.deepEqual(pixelToCell(50, 30, plateau, 2060, 2060), { x: -10, y: 10 });
  assert.equal(pixelToCell(55, 30, plateau, 2060, 2060), null);
  assert.equal(pixelToCell(38, 30, plateau, width, height, 30, 6), null);
});
