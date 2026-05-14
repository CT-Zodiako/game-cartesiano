# User Stories — Game Cartesiano

Juego educativo del plano cartesiano. Competencia para ver quién ubica más rápido las coordenadas.

---

## Epic 1: Modo Ejercicio (Single-Player)

### US-1.1: Completar desafío de coordenadas
**Como** estudiante quiero ver una coordenada objetivo para practicar.

**Criterios de aceptación:**
- [x] El sistema muestra una coordenada aleatoria en [-10, 10]
- [x] El estudiante puede hacer click en el vértice correspondiente
- [x] Al presionar "Marcar" se valida la respuesta
- [x] Se muestra feedback de acierto o error

### US-1.2: Seguimiento de puntaje
**Como** estudiante quiero ver mi puntaje acumulado.

**Criterios de aceptación:**
- [x] Cada acierto suma 1 punto
- [x] Cada error descuenta 1 punto (mínimo 0)
- [x] El puntaje se actualiza en pantalla

### US-1.3: Ciclo continuo de práctica
**Como** estudiante quiero que el juego continúe sin reiniciar.

**Criterios de aceptación:**
- [x] Tras "Marcar" el punto vuelve a (0,0)
- [x] Se genera un nuevo objetivo automáticamente

### US-1.4: UI mejorada del juego
**Como** estudiante quiero una interfaz visual atractiva.

**Criterios de aceptación:**
- [x] Header con tres displays: Tu elección, Objetivo, Tiempo
- [x] Botón "Marcar" con estilo de máquina expendedora
- [x] "Tu elección" se actualiza al hacer click en el tablero

---

## Epic 2: Modo Online (Multijugador)

### US-2.1: Menú de entrada online
**Como** jugador quiero elegir entre crear o unirse a una sala.

**Criterios de aceptación:**
- [x] Dos opciones claras: "Crear Sala" y "Unirse a Sala"
- [x] Paneles separados para cada acción
- [x] Botón "Volver" para regresar al menú

### US-2.2: Crear sala
**Como** jugador quiero crear una sala para invitar a otros.

**Criterios de aceptación:**
- [x] Ingreso mi nombre
- [x] Puedo configurar: jugadores, rondas, tiempo, coordenadas
- [x] Se genera código de sala de 6 caracteres
- [x] Código visible en el lobby

### US-2.3: Unirse a sala
**Como** jugador quiero unirme a una sala existente.

**Criterios de aceptación:**
- [x] Ingreso mi nombre
- [x] Ingreso código de sala (6 caracteres)
- [x] Me conecto al servidor

### US-2.4: Lobby con código visible
**Como** jugador quiero ver el código de mi sala.

**Criterios de aceptación:**
- [x] Código de sala grande y visible arriba del lobby
- [x] Botón "Iniciar partida" solo para el host
- [x] Botón "Salir de la sala" disponible

### US-2.5: Ranking en vivo desde LOBBY
**Como** jugador quiero ver los jugadores que entran a la sala.

**Criterios de aceptación:**
- [x] Los jugadores aparecen en el ranking al entrar
- [x] Se muestra score 0 o "—" antes de empezar
- [x] Se actualiza cuando alguien se une o sale

### US-2.6: Objetivos individuales por ronda
**Como** jugador quiero tener mi propio objetivo.

**Criterios de aceptación:**
- [x] Cada jugador recibe un objetivo aleatorio distinto
- [x] El servidor valida contra el target asignado

### US-2.7: Scoring competitivo por velocidad
**Como** jugador quiero que mi puntaje refleje qué tan rápido respondí.

**Criterios de aceptación:**
- [x] Respuestas rápidas = más puntos (hasta 1000)
- [x] Respuestas lentas = mínimo 100 si es correcto
- [x] Incorrectas/tardías = 0 puntos

### US-2.8: Ranking en vivo durante juego
**Como** jugador quiero ver el ranking actualizado.

**Criterios de aceptación:**
- [x] Se actualiza tras cada CLAIM_ACK aceptado
- [x] Todos ven el mismo ranking

### US-2.9: Modal de ranking final
**Como** jugador quiero ver el podium al terminar.

**Criterios de aceptación:**
- [x] Top 3 en podium (oro centro, plata izq, bronce der)
- [x] Corona 👑 para el ganador
- [x] Resto de jugadores listados del 4° en adelante
- [x] Tu posición resaltada si participas

---

## Epic 3: Experiencia de Usuario

### US-3.1: Tablero con cuatro cuadrantes
**Como** estudiante quiero ver el plano cartesiano completo.

**Criterios de aceptación:**
- [x] Ejes X e Y claramente visibles en el centro
- [x] Coordenadas negativas a izquierda y abajo
- [x] Coordenadas positivas a derecha y arriba
- [x] Cada vértice es clickeable

### US-3.2: Sistema de assets
**Como** estudiante quiero ver elementos gráficos.

**Criterios de aceptación:**
- [x] Sprites desde `public/assets/`
- [x] El punto usa `punto.gif`

### US-3.3: Responsive
**Como** estudiante quiero jugar desde distintos dispositivos.

**Criterios de aceptación:**
- [x] El tablero se adapta al contenedor
- [x] ResizeObserver actualiza el canvas

---

## Epic 4: Técnico

### US-4.1: Código tipado en TypeScript strict
**Como** desarrollador quiero código sin errores.

**Criterios de aceptación:**
- [x] Todo el código en `src/` es TypeScript strict
- [x] Tipos del protocolo WS definidos

### US-4.2: Servidor TypeScript
**Como** desarrollador quiero el servidor en TypeScript.

**Criterios de aceptación:**
- [x] `server.ts` en TypeScript