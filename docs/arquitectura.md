# Especificación Técnica — Game Cartesiano

## ST-1: Visión General del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  RoverScene  │  │   main.ts    │  │   WSClient    │  │
│  │  (Phaser 3)  │  │ (Bootstrap)  │  │  (Online)     │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              UI (index.html)                       │  │
│  │  - Header: coordenada + objetivo + tiempo         │  │
│  │  - Menú online: crear/unirse como paneles         │  │
│  │  - Lobby con código de sala visible               │  │
│  │  - Ranking en vivo (lobby + final)                │  │
│  │  - Botón "Marcar" (solo modo single-player)       │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket / HTTP
┌────────────────────────▼────────────────────────────────┐
│               SERVIDOR (Node.js — server.ts)            │
│  TypeScript: WebSocket + HTTP estático                  │
│  Sala, rondas, scoring y ranking manejados inline        │
└─────────────────────────────────────────────────────────┘
```

---

## ST-2: Stack Tecnológico

### Frontend
- **Phaser 3** (CDN) — motor de renderizado del tablero
- **TypeScript** (strict) — todo el código cliente
- **Vite** — bundler / dev server (proxy `/ws` → `:8080`)
- **WebSocket API** nativa del browser
- **HTML/CSS** — UI con estilos modernos

### Backend
- **Node.js** — runtime
- **ws ^8** — librería WebSocket server
- **TypeScript** — `server.ts`

---

## ST-3: Estructura de Archivos

```
game_cartesiano/
├── index.html              # Entry point + UI completa
├── server.ts               # Servidor WebSocket + HTTP estático (TypeScript)
├── vite.config.ts          # Config Vite
├── tsconfig.json           # TypeScript strict
├── package.json
├── public/
│   └── assets/
│       └── punto.gif       # Sprite del punto
├── src/
│   ├── main.ts             # Bootstrap + lógica online + UI handlers
│   ├── domain/
│   │   └── rover/
│   │       └── types.ts    # RoverState, Plateau
│   ├── infrastructure/
│   │   └── ws/
│   │       ├── client.ts   # WSClient + handlers
│   │       └── events.ts   # Tipos del protocolo
│   └── ui/
│       ├── dom/
│       │   └── statePanel.ts
│       └── phaser/
│           ├── RoverScene.ts
│           └── board.ts
└── docs/
```

---

## ST-4: Flujo Online

### Menú de Entrada
```
┌─────────────────────────┐
│     MODO ONLINE         │
│  Elige una opción       │
│                         │
│  [+ Crear Sala]         │ ───► Panel crear sala
│    "Crea nueva..."     │
│                         │
│  [🔗 Unirse a Sala]     │ ───► Panel unirse
│    "Código de 6 chars"  │
└─────────────────────────┘
```

### Panel Crear Sala
- Nombre del jugador
- Configuración (jugadores, rondas, tiempo, coordenadas)
- Botón "Crear Sala"
- Botón "← Volver"

### Panel Unirse
- Nombre del jugador
- Código de sala (6 caracteres)
- Botón "Unirse"
- Botón "← Volver"

### Lobby (visible tras crear/unirse)
```
┌─────────────────────────┐
│      SALA ABC123        │  <- Código grande visible
│                         │
│  [Iniciar partida]     │  <- Solo visible para el host
│  [Salir de la sala]    │
└─────────────────────────┘

🏆 POSICIONES  EN VIVO
1. Player1  -  0
2. Player2  -  0
```

---

## ST-5: Modal Ranking Final

Al terminar la partida, aparece un modal con:
- **Podium**: Top 3 (oro centro, plata izquierda, bronce derecha)
- **Corona 👑** para el ganador
- **Lista** del 4° en adelante
- Tu posición resaltada si eres participante

---

## ST-6: UI del Juego (Header)

```
┌────────────────────────────────────────────────────────┐
│  TU ELECCIÓN     OBJETIVO          TIEMPO             │
│  (5, 3)          (-4, -5)          12s               │
└────────────────────────────────────────────────────────┘
```
- **Tu elección** (cyan): se actualiza al hacer click en el tablero
- **Objetivo** (rosa): la coordenada a encontrar
- **Tiempo** (amarillo): countdown de la ronda

---

## ST-7: Protocolo WebSocket

### Eventos C2S
| Tipo | Descripción |
|------|-------------|
| `CREATE_ROOM` | Crear sala con config |
| `JOIN_ROOM` | Unirse con código |
| `START_GAME` | Iniciar partida (solo host) |
| `SUBMIT_CLAIM` | Enviar respuesta |

### Eventos S2C
| Tipo | Descripción |
|------|-------------|
| `ROOM_SNAPSHOT` | Estado de la sala + players |
| `ROUND_STARTED` | Nueva ronda + target |
| `CLAIM_ACK` | Resultado del claim |
| `RANKING_UPDATED` | Ranking en vivo |
| `GAME_ENDED` | Fin de partida |

---

## ST-8: Scoring

```typescript
// Online
pointsEarned = Math.max(100, Math.floor(1000 * (1 - elapsed / roundDurationMs)))

// Single-player
hit ? score += 1 : score = Math.max(0, score - 1)
```

---

## ST-9: Configuración por Defecto

```typescript
{
  maxPlayers: 8,
  rounds: 3,
  roundDurationMs: 20000,  // 20 segundos
  maxX: 10,
  maxY: 10
}
```