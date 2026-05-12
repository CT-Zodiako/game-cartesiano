const C2S_TYPES = new Set([
  'CREATE_ROOM',
  'JOIN_ROOM',
  'START_GAME',
  'SUBMIT_CLAIM',
  'PING',
]);

const S2C_TYPES = new Set([
  'ROOM_SNAPSHOT',
  'ROUND_STARTED',
  'CLAIM_ACK',
  'LATE_ALERT',
  'RANKING_UPDATED',
  'ROUND_ENDED',
  'GAME_ENDED',
  'ERROR',
  'PONG',
]);

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateEnvelope(raw, allowedTypes) {
  if (!isObject(raw)) {
    return { ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Payload debe ser objeto.' } };
  }
  if (typeof raw.type !== 'string' || !allowedTypes.has(raw.type)) {
    return { ok: false, error: { code: 'INVALID_TYPE', message: 'Tipo de evento inválido.' } };
  }
  if (typeof raw.reqId !== 'string' || raw.reqId.length < 1) {
    return { ok: false, error: { code: 'INVALID_REQ_ID', message: 'reqId es requerido.' } };
  }
  return { ok: true };
}

function validateCreateRoom(event) {
  if (typeof event.playerName !== 'string' || event.playerName.trim().length < 1) {
    return { ok: false, error: { code: 'INVALID_PLAYER_NAME', message: 'playerName inválido.' } };
  }
  return { ok: true };
}

function validateJoinRoom(event) {
  if (typeof event.roomCode !== 'string' || event.roomCode.trim().length < 4) {
    return { ok: false, error: { code: 'INVALID_ROOM_CODE', message: 'roomCode inválido.' } };
  }
  if (typeof event.playerName !== 'string' || event.playerName.trim().length < 1) {
    return { ok: false, error: { code: 'INVALID_PLAYER_NAME', message: 'playerName inválido.' } };
  }
  if (event.reconnectToken != null && typeof event.reconnectToken !== 'string') {
    return { ok: false, error: { code: 'INVALID_RECONNECT_TOKEN', message: 'reconnectToken inválido.' } };
  }
  return { ok: true };
}

function validateStartGame(event) {
  if (typeof event.roomId !== 'string' || event.roomId.length < 1) {
    return { ok: false, error: { code: 'INVALID_ROOM_ID', message: 'roomId es requerido.' } };
  }
  return { ok: true };
}

function validateSubmitClaim(event) {
  if (typeof event.roomId !== 'string' || event.roomId.length < 1) {
    return { ok: false, error: { code: 'INVALID_ROOM_ID', message: 'roomId es requerido.' } };
  }
  if (!Number.isInteger(event.roundId) || event.roundId < 1) {
    return { ok: false, error: { code: 'INVALID_ROUND_ID', message: 'roundId inválido.' } };
  }
  if (typeof event.playerId !== 'string' || event.playerId.length < 1) {
    return { ok: false, error: { code: 'INVALID_PLAYER_ID', message: 'playerId inválido.' } };
  }
  if (!isObject(event.target) || !Number.isInteger(event.target.x) || !Number.isInteger(event.target.y)) {
    return { ok: false, error: { code: 'INVALID_TARGET', message: 'target inválido.' } };
  }
  if (event.sentAtClientMs != null && !Number.isFinite(event.sentAtClientMs)) {
    return { ok: false, error: { code: 'INVALID_CLIENT_TS', message: 'sentAtClientMs inválido.' } };
  }
  return { ok: true };
}

function validatePing() {
  return { ok: true };
}

const validatorsByType = {
  CREATE_ROOM: validateCreateRoom,
  JOIN_ROOM: validateJoinRoom,
  START_GAME: validateStartGame,
  SUBMIT_CLAIM: validateSubmitClaim,
  PING: validatePing,
};

export function validateC2SEvent(raw) {
  const env = validateEnvelope(raw, C2S_TYPES);
  if (!env.ok) return env;
  const event = { ...raw, type: raw.type };
  const validator = validatorsByType[event.type];
  const shape = validator ? validator(event) : { ok: true };
  if (!shape.ok) return shape;
  return { ok: true, event };
}

export function createErrorEvent(reqId, code, message) {
  return {
    type: 'ERROR',
    reqId: reqId ?? 'unknown',
    code,
    message,
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serverTsMs: Date.now(),
  };
}

export function isS2CType(type) {
  return S2C_TYPES.has(type);
}
