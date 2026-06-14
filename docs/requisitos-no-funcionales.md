# Requisitos No Funcionales — Game Cartesiano

## RNF-1: Performance

### RNF-1.1: Tiempo de respuesta
- El servidor DEBE responder a mensajes WebSocket en < 50ms (p95)
- La UI DEBE actualizar el tablero en < 16ms (60 FPS vía Phaser)

### RNF-1.2: Latencia tolerable
- El modo online tolera latencia de red de hasta 200ms entre clientes
- El scoring usa timestamp de llegada al servidor (no del cliente)

### RNF-1.3: Concurrencia
- El servidor maneja múltiples salas concurrentes en memoria
- Cada sala soporta hasta 8 jugadores (configurable al crear sala)

---

## RNF-2: Disponibilidad

### RNF-2.1: Degradación graceful
- Si el servidor no está disponible, el modo ejercicio (single-player) sigue funcionando sin conexión

### RNF-2.2: Reconexión
- **No implementado en la versión actual.** El campo `reconnectToken` está en los tipos pero el servidor no lo procesa.
- Al desconectarse, el jugador pierde su sesión

---

## RNF-3: Seguridad

### RNF-3.1: Validación de entrada
- `JOIN_ROOM` a sala inexistente devuelve `ERROR(ROOM_NOT_FOUND)`
- `JOIN_ROOM` a sala llena devuelve `ERROR(ROOM_FULL)`
- Mensajes malformados (JSON inválido) son silenciados

### RNF-3.2: Autoría del juego
- Solo el host puede enviar `START_GAME` (validado por `hostId`)
- El servidor es la única fuente de verdad para scoring, timing y targets
- El cliente envía `playerId` en `SUBMIT_CLAIM` pero el servidor usa el `playerId` de la sesión (no el del mensaje)

### RNF-3.3: Rate limiting de claims
- Máximo 1 `SUBMIT_CLAIM` aceptado por coordenada por ronda (via `claimed` Set)
- ⚠ La clave del Set es `"x:y"` — si dos jugadores tienen el mismo target, el segundo es rechazado como `TOO_LATE` (bug pendiente)

---

## RNF-4: Escalabilidad

### RNF-4.1: Estado en memoria
- No hay base de datos ni persistencia entre sesiones
- Al reiniciar el servidor, todas las salas y puntuaciones se pierden
- No se contempla escala horizontal en v1

---

## RNF-5: Compatibilidad

### RNF-5.1: Navegadores soportados
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Requiere soporte de WebSocket nativo y WebGL (Phaser)

### RNF-5.2: Dispositivos
- Desktop: prioridad
- Mobile: funcional (touch events soportados en Phaser)

### RNF-5.3: Responsive
- El tablero usa `ResizeObserver` para ajustarse al contenedor
- El panel lateral no tiene breakpoints definidos aún

---

## RNF-6: Mantenibilidad

### RNF-6.1: Testing
- El único test activo es `tests/ui/statePanel.test.ts` (`npm test`)
- Los tests en `tests/server/` están huérfanos (módulos del servidor fueron reemplazados por `server.js` monolítico)
- Cobertura de dominio: pendiente (los archivos de dominio fueron reducidos a `types.ts` en la migración)

### RNF-6.2: Arquitectura
- Cliente: Clean Architecture en TypeScript (`domain` / `infrastructure` / `ui`)
- Servidor: monolito JavaScript (`server.js`) — pendiente migración a TypeScript
- Phaser cargado por CDN, declarado como ambient en `src/types/`

### RNF-6.3: Deuda técnica conocida
- `server.js` en JS mientras el resto del proyecto es TS
- `renderState()` llamado en `main.ts:246` pero no definido (crash en single-player)
- Target no se renderiza visualmente en el tablero (`targetGfx` nunca se dibuja)
- `CLAIM_ACK` usa `pointsEarned` en el servidor pero `scoreDelta` en el tipo TS
- `GAME_ENDED` envía `ranking` pero el tipo TS define `finalRanking`
- `JOIN_ROOM` broadcast `yourPlayerId` del nuevo jugador a todos (corrompe identidad de existentes)
- `handleRoomSnapshot` importado en `main.ts` pero no usado (error `noUnusedLocals`)
- `drawGrid` y `cellCenter` en `board.ts` exportados pero no usados
