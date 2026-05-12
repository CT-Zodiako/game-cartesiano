import type { RoverState, Plateau, Warning } from './types.js';
import { cloneState, createWarning, WARNING_CODES } from './types.js';

const LEFT: Record<string, string> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const RIGHT: Record<string, string> = { N: 'E', E: 'S', S: 'W', W: 'N' };
const VECTOR: Record<string, { x: number; y: number }> = {
  N: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: -1 },
  W: { x: -1, y: 0 },
};

export function turnLeft(state: RoverState): RoverState {
  return { ...cloneState(state), orientation: LEFT[state.orientation] as RoverState['orientation'] };
}

export function turnRight(state: RoverState): RoverState {
  return { ...cloneState(state), orientation: RIGHT[state.orientation] as RoverState['orientation'] };
}

export function moveForward(state: RoverState, plateau: Plateau): { nextState: RoverState; warning?: Warning } {
  const d = VECTOR[state.orientation];
  const candidate: RoverState = { ...cloneState(state), x: state.x + d.x, y: state.y + d.y };
  const outOfBounds = candidate.x < 0 || candidate.y < 0 || candidate.x > plateau.xMax || candidate.y > plateau.yMax;

  if (outOfBounds) {
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
