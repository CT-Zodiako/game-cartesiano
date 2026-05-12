import { validateCommands, validatePlateau, validateState } from '../domain/rover/validate.js';
import type { Plateau, RoverState, Orientation } from '../domain/rover/types.js';

export const PARSE_CODES = {
  PARSE_PLATEAU_FORMAT: 'PARSE_PLATEAU_FORMAT',
  PARSE_ROVER_BLOCK_INCOMPLETE: 'PARSE_ROVER_BLOCK_INCOMPLETE',
  PARSE_ORIENTATION_INVALID: 'PARSE_ORIENTATION_INVALID',
  PARSE_COMMAND_INVALID: 'PARSE_COMMAND_INVALID',
  PARSE_COORD_OUT_OF_RANGE: 'PARSE_COORD_OUT_OF_RANGE',
} as const;

export interface ParseError {
  code: string;
  message: string;
  line: number;
  roverIndex?: number;
  severity: 'error';
}

export interface ParseResult {
  ok: false;
  errors: ParseError[];
}

export interface ParseSuccess {
  ok: true;
  value: {
    plateau: Plateau;
    rovers: Array<{ id: string; initial: RoverState; commands: string }>;
  };
  warnings: unknown[];
}

export type ParseScenarioResult = ParseResult | ParseSuccess;

function parseInts(line: string): { x: number; y: number } | null {
  const m = line.match(/^(\d+)\s+(\d+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

function parseRoverState(line: string): RoverState | null {
  const m = line.match(/^(\d+)\s+(\d+)\s+([A-Za-z]+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), orientation: m[3].toUpperCase() as Orientation };
}

export function parseScenario(text: string): ParseScenarioResult {
  const raw = String(text ?? '').split(/\r?\n/);
  const lines = raw
    .map((content, idx) => ({ content: content.trim(), line: idx + 1 }))
    .filter((entry) => entry.content.length > 0);

  if (lines.length === 0) {
    return {
      ok: false,
      errors: [{ code: PARSE_CODES.PARSE_PLATEAU_FORMAT, message: 'Falta línea de plateau (Xmax Ymax)', line: 1, severity: 'error' }],
    };
  }

  const errors: ParseError[] = [];
  const p = parseInts(lines[0].content);
  if (!p) {
    return {
      ok: false,
      errors: [{ code: PARSE_CODES.PARSE_PLATEAU_FORMAT, message: 'Formato de plateau inválido', line: lines[0].line, severity: 'error' }],
    };
  }

  const plateau: Plateau = { xMax: p.x, yMax: p.y };
  try {
    validatePlateau(plateau);
  } catch (e) {
    return {
      ok: false,
      errors: [{ code: PARSE_CODES.PARSE_PLATEAU_FORMAT, message: (e as Error).message, line: lines[0].line, severity: 'error' }],
    };
  }

  const body = lines.slice(1);
  if (body.length % 2 !== 0) {
    errors.push({
      code: PARSE_CODES.PARSE_ROVER_BLOCK_INCOMPLETE,
      message: 'Bloque de rover incompleto: falta línea de comandos o estado',
      line: body[body.length - 1].line,
      roverIndex: Math.floor(body.length / 2),
      severity: 'error',
    });
  }

  const rovers: Array<{ id: string; initial: RoverState; commands: string }> = [];
  const pairCount = Math.floor(body.length / 2);
  for (let i = 0; i < pairCount; i += 1) {
    const stateEntry = body[i * 2];
    const cmdEntry = body[i * 2 + 1];

    const state = parseRoverState(stateEntry.content);
    if (!state) {
      errors.push({
        code: PARSE_CODES.PARSE_ORIENTATION_INVALID,
        message: 'Formato de estado de rover inválido. Esperado: "x y O"',
        line: stateEntry.line,
        roverIndex: i,
        severity: 'error',
      });
      continue;
    }

    try {
      validateState(state, plateau);
    } catch (e) {
      errors.push({
        code: (e as { code: string }).code === 'INVALID_ORIENTATION' ? PARSE_CODES.PARSE_ORIENTATION_INVALID : PARSE_CODES.PARSE_COORD_OUT_OF_RANGE,
        message: (e as Error).message,
        line: stateEntry.line,
        roverIndex: i,
        severity: 'error',
      });
    }

    const commands = cmdEntry.content.toUpperCase();
    try {
      validateCommands(commands);
    } catch (e) {
      errors.push({
        code: PARSE_CODES.PARSE_COMMAND_INVALID,
        message: (e as Error).message,
        line: cmdEntry.line,
        roverIndex: i,
        severity: 'error',
      });
    }

    rovers.push({ id: `R${i + 1}`, initial: state, commands });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { plateau, rovers }, warnings: [] };
}
