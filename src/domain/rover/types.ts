// ── Rover Domain Types ───────────────────────────────────────────────────────

export const ORIENTATIONS = ['N', 'E', 'S', 'W'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const COMMANDS = ['L', 'R', 'M'] as const;
export type Command = (typeof COMMANDS)[number];

export interface Plateau {
  xMax: number; // positive limit, range: [-xMax, xMax]
  yMax: number; // positive limit, range: [-yMax, yMax]
}

export interface RoverState {
  x: number;
  y: number;
  orientation: Orientation;
}

export interface DomainError extends Error {
  name: 'DomainError';
  code: string;
  meta?: Record<string, unknown>;
}

export interface Warning {
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export const DOMAIN_ERROR_CODES = {
  INVALID_PLATEAU: 'INVALID_PLATEAU',
  INVALID_COORDINATE: 'INVALID_COORDINATE',
  INVALID_ORIENTATION: 'INVALID_ORIENTATION',
  INVALID_COMMAND: 'INVALID_COMMAND',
} as const;

export const WARNING_CODES = {
  MOVE_OUT_OF_BOUNDS: 'MOVE_OUT_OF_BOUNDS',
  ROVER_OVERLAP_ALLOWED: 'ROVER_OVERLAP_ALLOWED',
} as const;

export function createDomainError(code: string, message: string, meta: Record<string, unknown> = {}): DomainError {
  const err = new Error(message) as DomainError;
  err.name = 'DomainError';
  err.code = code;
  err.meta = meta;
  return err;
}

export function createWarning(code: string, message: string, meta: Record<string, unknown> = {}): Warning {
  return { code, message, meta };
}

export function cloneState(state: RoverState): RoverState {
  return { x: state.x, y: state.y, orientation: state.orientation };
}
