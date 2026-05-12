import type { RoverState, Plateau, Command } from './types.js';
import { cloneState, createDomainError, DOMAIN_ERROR_CODES } from './types.js';
import { validateCommands, validatePlateau, validateState } from './validate.js';
import { moveForward, turnLeft, turnRight } from './transform.js';

export interface RoverStep {
  stepIndex: number;
  cmd: Command;
  prev: RoverState;
  next: RoverState;
  warning?: { code: string; message: string };
}

export interface RoverSequenceResult {
  finalState: RoverState;
  trace: RoverStep[];
}

export function executeCommand(state: RoverState, cmd: Command, plateau: Plateau): { nextState: RoverState; warning?: { code: string; message: string } } {
  validatePlateau(plateau);
  validateState(state, plateau);

  if (cmd === 'L') return { nextState: turnLeft(state) };
  if (cmd === 'R') return { nextState: turnRight(state) };
  if (cmd === 'M') return moveForward(state, plateau);

  throw createDomainError(DOMAIN_ERROR_CODES.INVALID_COMMAND, `Comando inválido: ${cmd}`, { cmd });
}

export function executeRoverSequence(initial: RoverState, commands: string, plateau: Plateau): RoverSequenceResult {
  validatePlateau(plateau);
  validateState(initial, plateau);
  validateCommands(commands);

  let state = cloneState(initial);
  const trace: RoverStep[] = [];

  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i] as Command;
    const prev = cloneState(state);
    const { nextState, warning } = executeCommand(state, cmd, plateau);
    state = cloneState(nextState);
    trace.push({
      stepIndex: i,
      cmd,
      prev,
      next: cloneState(nextState),
      ...(warning ? { warning: { code: warning.code, message: warning.message } } : {}),
    });
  }

  return { finalState: state, trace };
}
