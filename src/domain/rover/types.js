export const ORIENTATIONS = Object.freeze(['N', 'E', 'S', 'W']);
export const COMMANDS = Object.freeze(['L', 'R', 'M']);

export const WARNING_CODES = Object.freeze({
  MOVE_OUT_OF_BOUNDS: 'MOVE_OUT_OF_BOUNDS',
  ROVER_OVERLAP_ALLOWED: 'ROVER_OVERLAP_ALLOWED',
});

export const DOMAIN_ERROR_CODES = Object.freeze({
  INVALID_PLATEAU: 'INVALID_PLATEAU',
  INVALID_COORDINATE: 'INVALID_COORDINATE',
  INVALID_ORIENTATION: 'INVALID_ORIENTATION',
  INVALID_COMMAND: 'INVALID_COMMAND',
});

export function createDomainError(code, message, meta = {}) {
  const err = new Error(message);
  err.name = 'DomainError';
  err.code = code;
  err.meta = meta;
  return err;
}

export function createWarning(code, message, meta = {}) {
  return { code, message, meta };
}

export function cloneState(state) {
  return { x: state.x, y: state.y, orientation: state.orientation };
}
