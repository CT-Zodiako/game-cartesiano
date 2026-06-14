# Contexto del Juego — Game Cartesiano

**Propósito/estado:** guía visual para prompts e iteración de UI; toma `design.md` como referencia estética y `PRD.md` como estado funcional.

## ¿Qué es?

**Game Cartesiano** es un juego educativo de plano cartesiano para estudiantes.
La mecánica principal: se muestra una coordenada objetivo y el jugador debe
hacer clic en el vértice correcto del tablero. Hay dos modos:

- **Single-player (Modo Ejercicio):** practica solo, puntaje +1/-1
- **Multiplayer Online:** hasta 8 jugadores compiten en tiempo real (20 s por ronda)
  con ranking por velocidad y precisión

---

## Estética visual del tablero (código actual)

| Elemento           | Valor            |
|--------------------|------------------|
| Fondo              | `#0f172a` (azul noche oscuro) |
| Líneas de grilla   | `#334155` (gris azulado tenue) |
| Ejes principales   | `#94a3b8` (gris claro, grosor 2px) |
| Labels de ejes     | `#cbd5e1` / `#e2e8f0` |
| Trayectoria/path   | `#a3e635` (verde lima brillante) |
| Punto del jugador  | sprite `punto.gif` (32×32, escala 1.25) |
| Rango de coordenadas | `-10 ≤ x ≤ 10`, `-10 ≤ y ≤ 10` |
| Origen             | Centro exacto del tablero |

---

## Mecánica de juego

1. El sistema genera una coordenada objetivo aleatoria (ej. `(-3, 7)`)
2. El jugador hace clic en el vértice del tablero que corresponde
3. Feedback inmediato: ✓ acierto o ✗ error
4. En modo online: el servidor valida con temporizador oficial
   - Fórmula de score: `Math.max(100, Math.floor(1000 * (1 - elapsed / roundDurationMs)))`
5. El objetivo debe verse también como marcador en el tablero, no solo como texto en el HUD

---

## Stack tecnológico

- **Renderer:** Phaser 3 (WebGL/Canvas)
- **Frontend:** TypeScript + Vite
- **Backend:** Node.js + WebSocket
- **UI adicional:** DOM overlay para panel de info (puntaje, objetivo, cuenta regresiva)

---

## Audiencia

Estudiantes de nivel secundaria practicando plano cartesiano.
Interfaz oscura tipo "game" para que se sienta como competencia, no como tarea.

---

## Prompt sugerido para imagen

```
A dark educational math game UI screenshot showing a Cartesian coordinate plane,
dark navy background (#0f172a), subtle blue-gray grid lines, bold white X and Y axes
meeting at the center origin, coordinate labels from -10 to 10 on both axes in light
gray. A glowing lime-green dot marks the player's selected point on the grid, and a visible cyan target marker highlights the target coordinate on the board. Top HUD shows: target
coordinate "(-3, 7)" in cyan, current position "(2, 5)" in white, score "+200 pts",
and a countdown timer "12s" in red. The overall aesthetic is a sleek dark-mode
competitive multiplayer game for students. Flat vector game UI style, no gradients.
```

---

## Notas para iterar el prompt

- Cambiar el estilo: `pixel art`, `neon cyberpunk`, `flat vector`, `3D isometric`
- Cambiar el estado del juego: mostrar el lobby de sala online con lista de jugadores
- Añadir: efectos de partículas en acierto, confetti al terminar ronda
- Agregar jugadores: mostrar mini-avatares de hasta 8 jugadores con sus scores laterales
