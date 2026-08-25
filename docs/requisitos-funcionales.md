# Requisitos Funcionales — Game Cartesiano

**Propósito/estado:** requisitos deseados del producto; cuando el PRD marca bugs, este documento describe el comportamiento objetivo a implementar.

Juego educativo del plano cartesiano. Competencia para ver quién ubica más rápido las coordenadas.

## RF-1: Modo Online (Multijugador)

### RF-1.1: Creación de sala
Permite crear una sala configurando:
- Nombre del host
- `maxPlayers` (default 8), `rounds` (default 3), `roundDurationMs` (default 20000ms)
- `maxX` / `maxY` del tablero (default 10)
- El servidor asigna código de sala único (6 caracteres alfanuméricos)

### RF-1.2: Unión a sala
Permite unirse con código de sala + nombre. Solo si sala está en estado `LOBBY`.

### RF-1.3: Inicio de partida
Solo el host puede iniciar. Requiere mínimo 2 jugadores en sala.

### RF-1.4: Partida multijugador — targets individuales
Cada jugador recibe su **propio objetivo aleatorio** por ronda (no el mismo para todos).
- El servidor genera un target distinto por `(roundId, playerId)`
- El claim se valida contra el target asignado a ese jugador específico

### RF-1.5: Scoring competitivo
```javascript
pointsEarned = Math.max(100, Math.floor(1000 * (1 - elapsed / roundDurationMs)))
```
- Mínimo garantizado por acierto: 100 puntos
- Máximo: 1000 puntos (respuesta inmediata)
- Claim incorrecto o tardío: 0 puntos, no penaliza

### RF-1.6: Ranking en vivo
- `RANKING_UPDATED` se emite a todos tras cada `CLAIM_ACK` aceptado
- Al terminar todas las rondas se emite `GAME_ENDED` con ranking final

---

## RF-2: Protocolo WebSocket

### RF-2.1: Eventos C2S (cliente → servidor)
| Evento | Payload |
|--------|---------|
| `CREATE_ROOM` | `{ playerName, config: { maxPlayers, rounds, roundDurationMs, maxX, maxY } }` |
| `JOIN_ROOM` | `{ playerName, roomCode }` |
| `START_GAME` | `{ roomId }` (solo host, ≥2 jugadores) |
| `SUBMIT_CLAIM` | `{ roomId, roundId, playerId, target: { x, y }, sentAtClientMs }` |
| `PING` | `{}` |

### RF-2.2: Eventos S2C (servidor → cliente)
| Evento | Payload |
|--------|---------|
| `ROOM_SNAPSHOT` | `{ roomState, yourPlayerId? }` |
| `ROUND_STARTED` | `{ roundId, deadlineMs, target: { x, y } }` |
| `CLAIM_ACK` | `{ status: ACCEPTED\|REJECTED, reason, pointsEarned, totalScore }` |
| `RANKING_UPDATED` | `{ ranking: [{ playerId, name, totalScore }] }` |
| `GAME_ENDED` | `{ ranking: [{ playerId, name, totalScore }] }` |
| `ERROR` | `{ code, message }` |

### RF-2.3: Validación de payloads
- Mensajes malformados son silenciados (try/catch en server.js)
- `JOIN_ROOM` con código inválido devuelve `ERROR(ROOM_NOT_FOUND)`
- `JOIN_ROOM` a sala llena devuelve `ERROR(ROOM_FULL)`
- `SUBMIT_CLAIM` fuera de `ROUND_ACTIVE` es ignorado sin respuesta

---

## RF-3: Visualización

### RF-3.1: Tablero con cuatro cuadrantes (Phaser 3)
- Grilla con ejes X e Y en el centro
- Coordenadas de -10 a 10 en ambos ejes
- Vértices clickeables (radio 6px)
- `punto.gif` posicionado en el vértice actual
- Marcador visual del objetivo dibujado sobre el vértice correspondiente del tablero

### RF-3.2: Panel de información (DOM)
- Objetivo actual en texto
- Feedback de acierto/error
- Cuenta regresiva del turno
- Ranking en vivo
