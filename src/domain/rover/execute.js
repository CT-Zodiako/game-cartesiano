import { cloneState, createDomainError, DOMAIN_ERROR_CODES } from './types.js';
import { validateCommands, validatePlateau, validateState } from './validate.js';
import { moveForward, turnLeft, turnRight } from './transform.js';

export function executeCommand(state, cmd, plateau) {
  validatePlateau(plateau);
  validateState(state, plateau);

  if (cmd === 'L') return { nextState: turnLeft(state) };
  if (cmd === 'R') return { nextState: turnRight(state) };
  if (cmd === 'M') return moveForward(state, plateau);

  throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, `Comando inválido: ${cmd}`, { cmd });
}

export function executeRoverSequence(initial, commands, plateau) {
  validatePlateau(plateau);
  validateState(initial, plateau);
  validateCommands(commands);

  let state = cloneState(initial);
  const trace = [];

  [...commands].forEach((cmd, i) => {
    const prev = cloneState(state);
    const { nextState, warning } = executeCommand(state, cmd, plateau);
    state = cloneState(nextState);
    trace.push({
      stepIndex: i,
      cmd,
      prev,
      next: cloneState(nextState),
      ...(warning ? { warning } : {}),
    });
  });

  return { finalState: state, trace };
}
