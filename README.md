# XY Arena

Juego educativo de plano cartesiano - competencia multiplayer para ver quién ubica más rápido las coordenadas.

## Tecnologías

- **Frontend**: TypeScript + Vite + Phaser 3
- **Tests**: tsx + Node.js test runner

## Estructura

```
src/
├── domain/rover/     # Tipos del dominio
├── infrastructure/  # Cliente WebSocket
└── ui/               # Phaser (board, scenes), DOM (state panel)
tests/                # Tests unitarios
```

## Cómo correrlo

### Instalar dependencias

```bash
npm install
```

### Desarrollo (multijugador online)

Para jugar necesitás dos terminales:

**Terminal 1 - Servidor:**

```bash
npm start
```

Servidor en `http://localhost:8080` y `ws://localhost:8080/ws`

**Terminal 2 - Frontend:**

```bash
npm run dev
```

Abrí `http://localhost:5173` (o el puerto disponible) para crear o unirte a una sala.

### Tests

```bash
npm test
```

Esto ejecuta los tests de UI y servidor (`tests/ui/*.test.ts` y `tests/server/*.test.ts`).

## Cómo jugar

1. Configurar (opcional): jugadores máx, rondas, segundos por ronda, coordenadas máx
2. El host crea una sala y comparte el código
3. Otros jugadores se unen con el código
4. El host inicia la partida; todos reciben una cuenta regresiva sincronizada de 3 → 2 → 1 antes de la ronda 1.
5. Todos ven el mismo objetivo y compiten por quién responde más rápido.
6. Al terminar, el ranking final se cierra primero. Después, el host vuelve a ver el control normal **Iniciar partida**; este conserva sala, código, configuración y jugadores conectados, y usa una nueva cuenta regresiva antes de reiniciar puntajes y volver a la ronda 1. Los demás jugadores esperan al host.
7. Si el host sale durante la cuenta regresiva, una partida activa o tras el ranking final, la sala se cancela para todos. Si un jugador no host sale durante la cuenta regresiva, esta se cancela y la sala vuelve al lobby o conserva su ranking final.
