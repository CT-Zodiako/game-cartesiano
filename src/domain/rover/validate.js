import { COMMANDS, DOMAIN_ERROR_CODES, ORIENTATIONS, createDomainError } from './types.js';

function isInt(n) {
  return Number.isInteger(n);
}

export function validatePlateau(plateau) {
  if (!plateau || !isInt(plateau.xMax) || !isInt(plateau.yMax) || plateau.xMax < 0 || plateau.yMax < 0) {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_PLATEAU, 'Plateau inválido: xMax/yMax deben ser enteros >= 0', {
      plateau,
    });
  }
  return plateau;
}

export function validateState(state, plateau) {
  validatePlateau(plateau);
  if (!state || !isInt(state.x) || !isInt(state.y)) {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COORDINATE, 'Estado inválido: x/y deben ser enteros', { state });
  }
  if (!ORIENTATIONS.includes(state.orientation)) {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_ORIENTATION, 'Orientación inválida', {
      state,
      allowed: ORIENTATIONS,
    });
  }
  if (state.x < 0 || state.y < 0 || state.x > plateau.xMax || state.y > plateau.yMax) {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COORDINATE, 'Coordenadas fuera de rango del plateau', {
      state,
      plateau,
    });
  }
  return state;
}

export function validateCommands(commands) {
  if (typeof commands !== 'string') {
    throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, 'Comandos inválidos: debe ser string', { commands });
  }
  for (const cmd of commands) {
    if (!COMMANDS.includes(cmd)) {
      throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, `Comando inválido: ${cmd}`, {
        command: cmd,
        allowed: COMMANDS,
      });
    }
  }
  return commands;
}
