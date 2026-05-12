# Especificación Técnica — Game Cartesiano

## ST-1: Visión General del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Phaser  │  │  Game.js │  │  WebSocket Client    │  │
│  │ (Visual) │  │ (Lógica) │  │  (Online Mode)       │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket / HTTP
┌────────────────────────▼────────────────────────────────┐
│                   SERVIDOR (Node.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  WS Gateway  │  │ Room Engine  │  │   Scoring    │   │
│  │  (protocol)  │  │   (FSM)      │  │  (Ranking)   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## ST-2: Stack Tecnológico

### Frontend
- **Phaser 3.90** (CDN) — motor de renderizado del tablero
- **Vanilla JS** (ES Modules) — lógica de juego y UI
- **WebSocket API** nativa — comunicación con servidor

### Backend
- **Node.js** — runtime
- **ws** — librería WebSocket server
- **Sin frameworks** — lógica pura en módulos

### Testing
- **Node.js built-in test runner** (`node --test`)
- **Sin dependencias externas** de testing

---

## ST-3: Estructura de Archivos

```
game_cartesiano/
├── index.html          # Entry point
├── game.js             # Bootstrap y coordinación
├── src/
│   ├── domain/
│   │   ├── rover/
│   │   │   ├── state.js       # Estado, orientación, transiciones
│   │   │   ├── parser.js      # Parseo de comandos L/R/M
│   │   │   └── validator.js   # Validación de fronteras
│   │   └── scoring/
│   │       └── index.js      # Fórmula de scoring
│   ├── application/
│   │   └── scenarios.js       # Simulación de partidas
│   └── ui/
│       ├── phaser/
│       │   ├── RoverScene.js   # Escena del tablero
│       │   └── Board.js        # Renderizado de grilla
│       └── dom/
│           └── hud.js          # Panel lateral y controles
├── server/
│   ├── protocol-v1.js  # Schemas y validador de mensajes
│   ├── room-engine.js  # FSM de sala
│   ├── scoring.js     # Lógica de puntuación
│   ├── ranking.js     # Clasificación
│   └── ws-gateway.js  # Servidor WebSocket
├── docs/               # Documentación
│   ├── user-stories.md
│   ├── requisitos-funcionales.md
│   ├── requisitos-no-funcionales.md
│   └── arquitectura.md (este archivo)
└── tests/
    ├── domain/
    ├── ui/
    └── integration/
```

---

## ST-4: Dominio del Rover

### Estado
```javascript
const state = {
  x: number,      // 0 ≤ x ≤ X_MAX
  y: number,      // 0 ≤ y ≤ Y_MAX
  theta: 'N'|'E'|'S'|'W'
}
```

### Orientaciones (índice circular)
```javascript
const DIRS = ['N', 'E', 'S', 'W']  // índice: N=0, E=1, S=2, W=3
// L: índice - 1 (mod 4)
// R: índice + 1 (mod 4)
```

### Comandos
| Comando | Función |
|---------|---------|
| `L` | Rotar 90° a la izquierda |
| `R` | Rotar 90° a la derecha |
| `M` | Avanzar 1 unidad en dirección actual |

### Validación de fronteras
```javascript
// Antes de mover: verificar que nueva posición esté dentro del dominio
function isValidPosition(x, y, xMax, yMax) {
  return 0 <= x && x <= xMax && 0 <= y && y <= yMax
}
```

---

## ST-5: Protocolo WebSocket (v1)

### Handshake
```javascript
// Cliente conecta a ws://localhost:8080
// ws-gateway valida origen y asigna sala
```

### Estados de Sala (FSM)
```
LOBBY ──(START_GAME)──▶ PLAYING ──(3 rondas)──▶ ENDED
   │                       │
   └──────(LEAVE_ROOM)─────┘
```

### Rooms
```javascript
const room = {
  code: string,           // 6 chars alfanuméricos
  host: string,           // nombre del host
  players: Map<id, Player>,
  state: 'LOBBY'|'PLAYING'|'ENDED',
  roundNumber: number,
  target: { x, y },
  claims: Map<playerId, { x, y, timestamp }>
}
```

### Player
```javascript
const player = {
  id: string,
  name: string,
  score: number,
  ws: WebSocket
}
```

---

## ST-6: Fórmula de Scoring

```javascript
function calculateScore(submitTime, roundStartTime, isCorrect) {
  if (!isCorrect) return 0

  const elapsed = submitTime - roundStartTime  // ms
  const clampedTime = Math.min(elapsed, 20000)  // 20s max
  const timeBonus = 20 - (clampedTime / 1000)

  return Math.round(timeBonus * 100 + 1000)
}
```

### Ejemplos
| Tiempo de respuesta | Puntuación |
|--------------------|------------|
| < 1s | 2900-3000 |
| 5s | 2500 |
| 10s | 2000 |
| 20s | 1000 |

---

## ST-7: API REST (meta, opcional v2)

No en scope para v1. En v2 se contempla:
- `GET /api/rooms/:code` — estado de sala (polling fallback)
- `POST /api/rooms` — crear sala sin WebSocket

---

## ST-8: Configuración

```javascript
// Constantes globales (pueden extraerse a config.js)
const CONFIG = {
  GRID_SIZE: 10,           // X_MAX, Y_MAX
  ROUND_DURATION: 20000,    // ms
  MAX_ROUNDS: 3,
  MAX_PLAYERS: 8,
  RECONNECT_WINDOW: 30000,  // ms
  TICK_INTERVAL: 1000       // ms (ROOM_SNAPSHOT)
}
```

---

## ST-9: Flujo de Ronda (detallado)

```
1. GAME_STARTED → servidor envía a todos
2. ROUND_STARTED → { roundNumber: 1, target: { x, y } }
3. Cada cliente renderiza el objetivo
4. Jugador hace click → SUBMIT_CLAIM
5. [20s] Servidor recibe claims o timeout
6. ROUND_ENDED → { roundNumber, results: [...] }
7. Ranking actualizado
8. [Si rounds < 3] → volver a paso 2
9. GAME_ENDED → rankings finales
```

### Resolucción de colisiones
- First-wins: el primer claim en timestamp gana
- Claims con mismo timestamp: jugador con ID menor gana
- Claims duplicados: idempotentes, sin duplicar score
