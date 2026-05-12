import { validateCommands, validatePlateau, validateState } from '../domain/rover/validate.js';

export const PARSE_CODES = Object.freeze({
  PARSE_PLATEAU_FORMAT: 'PARSE_PLATEAU_FORMAT',
  PARSE_ROVER_BLOCK_INCOMPLETE: 'PARSE_ROVER_BLOCK_INCOMPLETE',
  PARSE_ORIENTATION_INVALID: 'PARSE_ORIENTATION_INVALID',
  PARSE_COMMAND_INVALID: 'PARSE_COMMAND_INVALID',
  PARSE_COORD_OUT_OF_RANGE: 'PARSE_COORD_OUT_OF_RANGE',
});

function parseInts(line) {
  const m = line.match(/^(\d+)\s+(\d+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

function parseRoverState(line) {
  const m = line.match(/^(\d+)\s+(\d+)\s+([A-Za-z]+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), orientation: m[3].toUpperCase() };
}

export function parseScenario(text) {
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

  const errors = [];
  const p = parseInts(lines[0].content);
  if (!p) {
    return {
      ok: false,
      errors: [{ code: PARSE_CODES.PARSE_PLATEAU_FORMAT, message: 'Formato de plateau inválido', line: lines[0].line, severity: 'error' }],
    };
  }

  const plateau = { xMax: p.x, yMax: p.y };
  try {
    validatePlateau(plateau);
  } catch (e) {
    return {
      ok: false,
      errors: [{ code: PARSE_CODES.PARSE_PLATEAU_FORMAT, message: e.message, line: lines[0].line, severity: 'error' }],
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

  const rovers = [];
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
        code: e.code === 'INVALID_ORIENTATION' ? PARSE_CODES.PARSE_ORIENTATION_INVALID : PARSE_CODES.PARSE_COORD_OUT_OF_RANGE,
        message: e.message,
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
        message: e.message,
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
