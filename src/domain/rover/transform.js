import { WARNING_CODES, cloneState, createWarning } from './types.js';

const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' };
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
const V = { N: { x: 0, y: 1 }, E: { x: 1, y: 0 }, S: { x: 0, y: -1 }, W: { x: -1, y: 0 } };

export function turnLeft(state) {
  return { ...cloneState(state), orientation: LEFT[state.orientation] };
}

export function turnRight(state) {
  return { ...cloneState(state), orientation: RIGHT[state.orientation] };
}

export function moveForward(state, plateau) {
  const d = V[state.orientation];
  const candidate = { ...cloneState(state), x: state.x + d.x, y: state.y + d.y };
  const out = candidate.x < 0 || candidate.y < 0 || candidate.x > plateau.xMax || candidate.y > plateau.yMax;

  if (out) {
    return {
      nextState: cloneState(state),
      warning: createWarning(
        WARNING_CODES.MOVE_OUT_OF_BOUNDS,
        `Movimiento fuera de frontera: (${candidate.x},${candidate.y})`,
        { attempted: candidate, plateau },
      ),
    };
  }

  return { nextState: candidate };
}
