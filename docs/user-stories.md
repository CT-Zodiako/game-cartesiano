# User Stories — Game Cartesiano

**Propósito/estado:** historias y criterios objetivo; los estados reflejan el PRD actual (`completo`, `parcial`, `bloqueado`, `pendiente`) para no confundir comportamiento deseado con implementado.

Juego educativo del plano cartesiano. Competencia para ver quién ubica más rápido las coordenadas.

---

## Epic 1: Modo Online (Multijugador)

### US-1.1: Menú de entrada online
**Como** jugador quiero elegir entre crear o unirse a una sala.

**Criterios de aceptación:**
- [completo] Dos opciones claras: "Crear Sala" y "Unirse a Sala"
- [completo] Paneles separados para cada acción
- [completo] Botón "Volver" para regresar al menú

### US-1.2: Crear sala
**Como** jugador quiero crear una sala para invitar a otros.

**Criterios de aceptación:**
- [completo] Ingreso mi nombre
- [completo] Puedo configurar: jugadores, rondas, tiempo, coordenadas
- [completo] Se genera código de sala de 6 caracteres
- [completo] Código visible en el lobby

### US-1.3: Unirse a sala
**Como** jugador quiero unirme a una sala existente.

**Criterios de aceptación:**
- [completo] Ingreso mi nombre
- [completo] Ingreso código de sala (6 caracteres)
- [completo] Me conecto al servidor

### US-1.4: Lobby con código visible
**Como** jugador quiero ver el código de mi sala.

**Criterios de aceptación:**
- [completo] Código de sala grande y visible arriba del lobby
- [completo] Botón "Iniciar partida" solo para el host
- [completo] Botón "Salir de la sala" disponible

### US-1.5: Ranking en vivo desde LOBBY
**Como** jugador quiero ver los jugadores que entran a la sala.

**Criterios de aceptación:**
- [completo] Los jugadores aparecen en el ranking al entrar
- [completo] Se muestra score 0 o "—" antes de empezar
- [completo] Se actualiza cuando alguien se une o sale

### US-1.6: Objetivos individuales por ronda
**Como** jugador quiero tener mi propio objetivo.

**Criterios de aceptación:**
- [parcial] Cada jugador recibe un objetivo aleatorio; el PRD advierte contratos online rotos
- [bloqueado] El servidor valida contra el target asignado sin rechazos cruzados; depende de corregir `claimed` por jugador

### US-1.7: Scoring competitivo por velocidad
**Como** jugador quiero que mi puntaje refleje qué tan rápido respondí.

**Criterios de aceptación:**
- [bloqueado] Respuestas rápidas = más puntos (hasta 1000); depende de alinear `CLAIM_ACK`
- [bloqueado] Respuestas lentas = mínimo 100 si es correcto; depende de alinear `CLAIM_ACK`
- [bloqueado] Incorrectas/tardías = 0 puntos; depende de alinear contrato cliente-servidor

### US-1.8: Ranking en vivo durante juego
**Como** jugador quiero ver el ranking actualizado.

**Criterios de aceptación:**
- [bloqueado] Se actualiza tras cada `CLAIM_ACK` aceptado; depende de alinear `pointsEarned`/`scoreDelta`
- [parcial] Todos ven el mismo ranking después de corregir el contrato online

### US-1.9: Modal de ranking final
**Como** jugador quiero ver el podium al terminar.

**Criterios de aceptación:**
- [parcial] Top 3 en podium (oro centro, plata izq, bronce der)
- [parcial] Corona 👑 para el ganador
- [parcial] Resto de jugadores listados del 4° en adelante
- [parcial] Tu posición resaltada si participas
- [bloqueado] El evento final debe llegar con el campo esperado; PRD reporta `ranking` vs `finalRanking` desalineado

---

## Epic 2: Experiencia de Usuario

### US-2.1: Tablero con cuatro cuadrantes
**Como** estudiante quiero ver el plano cartesiano completo.

**Criterios de aceptación:**
- [completo] Ejes X e Y claramente visibles en el centro
- [completo] Coordenadas negativas a izquierda y abajo
- [completo] Coordenadas positivas a derecha y arriba
- [completo] Cada vértice es clickeable
- [pendiente] El target se muestra como marcador visual en el tablero

### US-2.2: Sistema de assets
**Como** estudiante quiero ver elementos gráficos.

**Criterios de aceptación:**
- [completo] Sprites desde `public/assets/`
- [completo] El punto usa `punto.gif`

### US-2.3: Responsive
**Como** estudiante quiero jugar desde distintos dispositivos.

**Criterios de aceptación:**
- [completo] El tablero se adapta al contenedor
- [completo] ResizeObserver actualiza el canvas

---

## Epic 3: Técnico

### US-3.1: Código tipado en TypeScript strict
**Como** desarrollador quiero código sin errores.

**Criterios de aceptación:**
- [completo] Todo el código en `src/` es TypeScript strict
- [completo] Tipos del protocolo WS definidos

### US-3.2: Servidor TypeScript
**Como** desarrollador quiero el servidor en TypeScript.

**Criterios de aceptación:**
- [pendiente] El servidor actual es `server.js`; migrarlo a `server.ts` es deuda técnica del PRD
- [pendiente] El servidor TypeScript debe importar/compartir tipos con `src/infrastructure/ws/events.ts`
