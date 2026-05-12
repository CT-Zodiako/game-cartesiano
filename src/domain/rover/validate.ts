import type { Plateau, RoverState, Orientation } from './types.js';
import { createDomainError, DOMAIN_ERROR_CODES, ORIENTATIONS, COMMANDS } from './types.js';

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

export function validatePlateau(plateau: unknown): asserts plateau is Plateau {
  const p = plateau as Plateau | null;
  if (!p || !isInt(p.xMax) || !isInt(p.yMax) || p.xMax < 0 || p.yMax < 0) {
    throw createDomainError(
      DOMAIN_ERROR_CODES.INVALID_PLATEAU,
      'Plateau inválido: xMax/yMax deben ser enteros >= 0',
      { plateau },
    );
  }
}

export function validateOrientation(o: unknown): asserts o is Orientation {
  if (!ORIENTATIONS.includes(o as Orientation)) {
    throw createDomainError(
      DOMAIN_ERROR_CODES.INVALID_ORIENTATION,
      `Orientación inválida: ${o}`,
      { allowed: ORIENTATIONS },
    );
  }
}

export function validateState(state: unknown, plateau: Plateau): asserts state is RoverState {
  validatePlateau(plateau);
  const s = state as RoverState | null;
  if (!s || !isInt(s.x) || !isInt(s.y)) {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COORDINATE, 'Estado inválido: x/y deben ser enteros', { state });
  }
  validateOrientation(s.orientation);
  if (s.x < 0 || s.y < 0 || s.x > plateau.xMax || s.y > plateau.yMax) {
    throw createDomainError(
      DOMAIN_ERROR_CODES.INVALID_COORDINATE,
      `Coordenadas fuera de rango del plateau (0-${plateau.xMax}, 0-${plateau.yMax})`,
      { state, plateau },
    );
  }
}

export function validateCommands(commands: unknown): asserts commands is string {
  if (typeof commands !== 'string') {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, 'Comandos inválidos: debe ser string', { commands });
  }
  for (const cmd of commands) {
    if (!COMMANDS.includes(cmd as never)) {
      throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, `Comando inválido: ${cmd}`, {
        command: cmd,
        allowed: COMMANDS,
      });
    }
  }
}
