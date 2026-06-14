# Game Cartesiano

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

### Desarrollo (modo single-player)

```bash
npm run dev
```

Esto levanta Vite en `http://localhost:5173` (o el puerto disponible).

### Modo Online (multiplayer)

Para jugar online necesitás dos terminales:

**Terminal 1 - Servidor:**

```bash
npm start
```

Servidor en `http://localhost:8080` y `ws://localhost:8080/ws`

**Terminal 2 - Frontend:**

```bash
npm run dev
```

Luego agregá `?online=1` a la URL, por ejemplo:
`http://localhost:5173/?online=1`

### Tests

```bash
npm test
```

Esto ejecuta los tests de UI y servidor (`tests/ui/*.test.ts` y `tests/server/*.test.ts`).

## Cómo jugar

### Modo single-player

1. Mirar la coordenada objetivo que aparece en pantalla
2. Hacer click en una celda del tablero para elegir la posición
3. Presionar **Comprobar** para validar
4. Repetir para sumar puntaje

### Modo online

1. Ir a tab **Online**
2. Configurar (opcional): jugadores máx, rondas, segundos por ronda, coordenadas máx
3. El host crea una sala y comparte el código
4. Otros jugadores se unen con el código
5. El host inicia la partida
6. Todos ven el mismo objetivo y compiten por quién responde más rápido
