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

1. Configurar (opcional): jugadores máx, rondas, segundos por ronda, coordenadas máx (o "Tablero móvil" para ±4)
2. El host crea una sala y comparte el código
3. Otros jugadores se unen con el código
4. El host inicia la partida; todos reciben una cuenta regresiva sincronizada de 3 → 2 → 1 antes de la ronda 1.
5. Cada jugador recibe su propio punto aleatorio en cada ronda; cuanto más rápido responde bien, más puntos gana.
6. Al terminar, el ranking final se cierra primero. Después, el host vuelve a ver el control normal **Iniciar partida**; este conserva sala, código, configuración y jugadores conectados, y usa una nueva cuenta regresiva antes de reiniciar puntajes y volver a la ronda 1. Los demás jugadores esperan al host.
7. Si el host sale durante la cuenta regresiva, una partida activa o tras el ranking final, la sala se cancela para todos. Si un jugador no host sale durante la cuenta regresiva, esta se cancela y la sala vuelve al lobby o conserva su ranking final.

## Aprendizaje y retroalimentación

- **Guía "¿Cómo se juega?"**: cinco pasos con un mini tablero animado igual al del juego (origen, primero X, después Y, cuadrantes y una jugada completa: la mano aparece sobre el vértice y toca, sin arrastrar) y una sola línea de texto por paso. Es obligatoria: aparece en cada carga, no se puede saltar ni cerrar, y "Siguiente" se habilita a los 5 segundos de cada paso. En el último paso, la casilla "No volver a mostrar esta guía" evita que vuelva a abrirse sola; el botón "¿Cómo se juega?" la sigue abriendo.
- **Colores por eje**: los números del eje X son azules y los del eje Y son verdes, igual que en el material de clase.
- **Cambio de ronda visible**: al empezar cada ronda la coordenada se agranda y brilla, el borde del tablero destella, aparece "Ronda N de M", el marcador vuelve al origen y en celulares el menú lateral se cierra para dejar el tablero a pantalla completa.
- **Menú ☰ en celulares**: un botón "Menú" arriba, sobre el tiempo y la coordenada; el tablero queda pegado al encabezado y los controles (crear o unirse a sala, código, posiciones, iniciar partida, guía y sonido) están en un menú lateral. Se abre solo al entrar, si se corta la conexión o al terminar la partida, y se cierra al empezar la cuenta regresiva.
- **Tablero móvil ±4**: la opción "Tablero móvil" de la sala usa el rango de -4 a 4 para que las casillas sean más grandes en celulares; en pantallas angostas el tablero también usa márgenes más chicos.
- **Cuadrantes nombrados**: el tablero muestra I, II, III y IV dentro de cada cuadrante, entre vértices, sin tapar puntos seleccionables.
- **Respuesta revelada**: el punto objetivo nunca se dibuja durante la ronda (sería dar la respuesta). Después de responder, el tablero marca el vértice correcto con un círculo y el cartel "Punto correcto (x, y)".
- **Pistas al fallar**: el juego explica el error más probable: orden invertido, signo de X o de Y, cuadrante equivocado o error de conteo, con el recorrido "primero X, después Y".
- **Correcto pero segundo**: si respondés bien pero otro jugador llegó antes, se muestra como correcto (+0 puntos), no como error.
- **Resumen personal**: al terminar, cada jugador ve aciertos, errores, rondas sin responder, porcentaje y una sugerencia según su error más frecuente.
- **Sonido**: el botón 🔊/🔇 silencia los sonidos y recuerda la elección.
- **Conexión perdida**: si se corta la conexión dentro de una sala, el juego vuelve al menú, lo explica y deja precargado el código para volver a unirse.

## Página privada de encuestas (`/docente`)

`/docente` muestra los códigos QR de los formularios publicados (pretest y postest de cada grupo, y la evaluación V3 del juego). Está protegida con usuario y contraseña del navegador (HTTP Basic) y sólo existe si el servidor tiene configurada la contraseña:

| Variable | Uso |
|---|---|
| `DOCENTE_PASSWORD` | Contraseña obligatoria. Sin ella, `/docente` responde 404. |
| `DOCENTE_USER` | Usuario (por defecto `docente`). |

En Railway se configuran en el servicio → Variables. Los enlaces de los formularios están en `server/teacher-page.ts`.

