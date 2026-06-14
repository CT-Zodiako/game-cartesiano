# PRD — Game Cartesiano

## Visión

Juego educativo multijugador en tiempo real donde los jugadores compiten por ubicar coordenadas en el plano cartesiano lo más rápido posible. El que responde primero y bien gana más puntos.

---

## Estado actual del proyecto

| Área | Estado |
|------|--------|
| Tablero Phaser (grilla, click, punto) | ✅ Funciona |
| Modo single-player (ciclo de juego) | ⚠️ Crash en "Marcar" (`renderState` no definido) |
| Modo online — lobby, sala, inicio | ✅ Funciona |
| Modo online — rondas y scoring | ⚠️ Contrato roto entre servidor y cliente |
| Target visible en tablero | ❌ No implementado |
| Tests del servidor | ❌ Todos huérfanos |
| Servidor en TypeScript | ❌ Sigue en JS |

---

## Bugs críticos (rompen el juego)

### BUG-1 — `renderState` no definido
**Dónde:** `src/main.ts:246`
**Síntoma:** ReferenceError al presionar "Marcar" en modo single-player. El juego crashea.
**Fix:** Eliminar la llamada o reemplazarla por `renderHud()` que sí existe.

---

### BUG-2 — El objetivo nunca se dibuja en el tablero
**Dónde:** `src/ui/phaser/RoverScene.ts` — método `drawAll()`
**Síntoma:** `targetGfx` se inicializa y se limpia en cada frame, pero nunca se dibuja sobre él. El jugador solo ve la coordenada en texto, no en el tablero.
**Fix:** En `drawAll()`, si `this.targetState !== null`, dibujar un marcador visual (círculo, cruz) sobre el vértice correspondiente usando `targetGfx` y `cellToPixel`.

---

### BUG-3 — `JOIN_ROOM` corrompe la identidad de jugadores existentes
**Dónde:** `server.js` — handler `JOIN_ROOM`
**Síntoma:** Al unirse un jugador nuevo, el servidor hace `broadcast()` con `yourPlayerId` del recién llegado. Todos los jugadores ya en el lobby reciben ese ID como si fuera el suyo — pierden su identidad.
**Fix:** Unicastear al nuevo jugador con su `yourPlayerId`. Broadcastear al resto sin ese campo (o con el suyo propio por separado).

---

### BUG-4 — Contrato `CLAIM_ACK` roto entre servidor y tipos
**Dónde:** `server.js` vs `src/infrastructure/ws/events.ts`
**Síntoma:** El servidor envía `{ pointsEarned }`, el tipo TS define `scoreDelta`. `main.ts` workaudioea con un cast manual. El campo correcto nunca llega tipado.
**Fix:** Unificar el nombre en ambos lados. Usar `pointsEarned` en `events.ts` o `scoreDelta` en `server.js` — lo que sea, pero uno solo.

---

### BUG-5 — `GAME_ENDED` envía `ranking` pero el tipo define `finalRanking`
**Dónde:** `server.js` vs `src/infrastructure/ws/events.ts` — `GameEndedEvent`
**Síntoma:** El cliente nunca procesa el evento de fin de partida correctamente.
**Fix:** Alinear el nombre del campo en server y tipo.

---

### BUG-6 — `claimed` Set usa clave de coordenada en vez de jugador
**Dónde:** `server.js` — handler `SUBMIT_CLAIM`
**Síntoma:** Si dos jugadores reciben el mismo target por coincidencia aleatoria, el segundo es rechazado con `TOO_LATE` aunque su respuesta sea válida.
**Fix:** Cambiar la clave del Set a `playerId`, o usar un `Map<playerId, boolean>` para trackear claims por jugador.

---

## Deuda técnica

### DT-1 — `server.js` en JavaScript
El servidor es el único archivo JS en un proyecto que migró a TypeScript. Sin tipos, los bugs de protocolo (BUG-3, BUG-4, BUG-5, BUG-6) son invisibles en compile-time.

**Impacto:** Cada cambio en el protocolo requiere sincronización manual entre `server.js` y `events.ts`. Tarde o temprano se desincroniza.

**Acción:** Migrar `server.js` a `server.ts`. Importar los mismos tipos de `src/infrastructure/ws/events.ts` en ambos lados.

---

### DT-2 — Tests del servidor huérfanos
Los archivos en `tests/server/` (scoring, room-engine, ws-gateway, ranking) referencian módulos que fueron eliminados. No corren. No hay cobertura del servidor.

**Acción:** Una vez migrado `server.js` a TS modular, reescribir los tests contra los nuevos módulos.

---

### DT-3 — `handleRoomSnapshot` importado pero no usado
**Dónde:** `src/main.ts:4`
**Síntoma:** Con `noUnusedLocals: true` en tsconfig, `tsc --noEmit` falla. Vite en dev lo silencia.
**Acción:** Eliminar el import o usarlo en vez del handler inline.

---

### DT-4 — Código muerto en `board.ts`
- `drawGrid()` — exportada, nunca llamada (`RoverScene` dibuja la grilla inline)
- `cellCenter()` — exportada, nadie la usa

**Acción:** Eliminar o consolidar con el código inline de `RoverScene`.

---

### DT-5 — `WSClient.on()` sobreescribe silenciosamente
Un solo handler por tipo de evento (Map). Si dos callers registran el mismo tipo, el segundo gana sin aviso ni error.

**Acción:** Cambiar a `Map<string, WsEventHandler[]>` con array de listeners, o documentar explícitamente la restricción.

---

## Prioridades de implementación

| # | Ítem | Tipo | Esfuerzo estimado |
|---|------|------|-------------------|
| 1 | BUG-1 Fix `renderState` | Bug | < 30 min |
| 2 | BUG-2 Dibujar target en tablero | Bug | 1–2 h |
| 3 | BUG-3 Fix `JOIN_ROOM` broadcast | Bug | 30 min |
| 4 | BUG-4 + BUG-5 Alinear contrato CLAIM_ACK / GAME_ENDED | Bug | 30 min |
| 5 | BUG-6 Fix `claimed` Set por jugador | Bug | 30 min |
| 6 | DT-1 Migrar `server.js` a TypeScript | Deuda técnica | 2–4 h |
| 7 | DT-2 Reescribir tests del servidor | Deuda técnica | 3–5 h |
| 8 | DT-3 + DT-4 Limpiar imports y código muerto | Deuda técnica | 30 min |

---

## Fuera de scope (v1)

- Reconexión de jugadores (`reconnectToken` definido en tipos pero no implementado)
- Persistencia de rankings entre sesiones
- Escala horizontal del servidor
- API REST como fallback al WebSocket
