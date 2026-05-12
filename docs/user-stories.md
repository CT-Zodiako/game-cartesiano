# User Stories — Game Cartesiano

Historias de usuarios organizadas por epics del proyecto.

---

## Epic 1: Modo Ejercicio (Single-Player)

### US-1.1: Completar desafío de coordenadas
**Como** estudiante quiero ver una coordenada objetivo en pantalla para practicar el plano cartesiano.

**Criterios de aceptación:**
- [ ] El sistema muestra una coordenada aleatoria en el tablero
- [ ] El estudiante puede hacer click en el vértice correspondiente
- [ ] Al presionar "Comprobar" se valida la respuesta
- [ ] Se muestra feedback de acierto o error

---

### US-1.2: Seguimiento de puntaje
**Como** estudiante quiero ver mi puntaje acumulado para motivarme a mejorar.

**Criterios de aceptación:**
- [ ] Cada acierto suma puntos
- [ ] Cada error descuenta puntos
- [ ] El puntaje se actualiza en tiempo real

---

### US-1.3: Reinicio de partida
**Como** estudiante quiero que el rover se reinicie tras cada intento para practicar continuamente.

**Criterios de aceptación:**
- [ ] Tras "Comprobar" el rover vuelve a S=(0,0,N)
- [ ] Se genera un nuevo objetivo aleatorio
- [ ] La secuencia puede continuar indefinidamente

---

## Epic 2: Modo Online (Multijugador)

### US-2.1: Crear sala de juego
**Como** jugador quiero crear una sala para invitar a otros jugadores.

**Criterios de aceptación:**
- [ ] Ingreso mi nombre y genero un código de sala
- [ ] Recibo un código de 6 caracteres para compartir
- [ ] Soy el "host" de la sala y puedo iniciar la partida

---

### US-2.2: Unirse a sala existente
**Como** jugador quiero unirme a una sala existente para jugar con amigos.

**Criterios de aceptación:**
- [ ] Ingreso el código de sala y mi nombre
- [ ] Me conecto al servidor y aparezco en el lobby
- [ ] Puedo ver la lista de jugadores conectados

---

### US-2.3: Partida sincronizada
**Como** jugador quiero que la partida sea justa con temporizador compartido.

**Criterios de aceptación:**
- [ ] El servidor define el reloj oficial (20 segundos por ronda)
- [ ] Todos los jugadores ven el mismo objetivo
- [ ] Las respuestas tardías son rechazadas
- [ ] El ranking se actualiza en tiempo real

---

### US-2.4: Scoring competitivo
**Como** jugador quiero que mi puntaje refleje velocidad y precisión.

**Criterios de aceptación:**
- [ ] Aciertos tempranos，得到更高分数
- [ ] Errores penalizan el puntaje
- [ ] El ranking final muestra la clasificación

---

## Epic 3: Experiencia de Usuario

### US-3.1: Tablero cartesiano visual
**Como** estudiante quiero ver el tablero con la grilla clara para ubicar coordenadas.

**Criterios de aceptación:**
- [ ] Ejes X e Y claramente visibles
- [ ] Cada vértice es clickeable
- [ ] El rover se visualiza en la posición actual

---

### US-3.2: Responsive mobile
**Como** estudiante quiero jugar desde el celular de forma cómoda.

**Criterios de aceptación:**
- [ ] La UI se adapta a pantallas pequeñas
- [ ] Los botones son touch-friendly
- [ ] El tablero ocupa el ancho disponible

---

## Epic 4: Técnico

### US-4.1: Tests unitarios de dominio
**Como** desarrollador quiero tests para validar las reglas de dominio.

**Criterios de aceptación:**
- [ ] Parser de comandos L/R/M/M
- [ ] Validación de fronteras del plateau
- [ ] Cálculo de scoring

---

### US-4.2: Tests de integración de UI
**Como** desarrollador quiero tests que validen la interacción con Phaser.

**Criterios de aceptación:**
- [ ] Click en vértice actualiza estado
- [ ] Comprobar valida y reinicia
- [ ] Feedback visible en pantalla

---

### US-4.3: Tests de protocolo WebSocket
**Como** desarrollador quiero tests de los mensajes C2S/S2C.

**Criterios de aceptación:**
- [ ] CREATE_ROOM / JOIN_ROOM
- [ ] START_GAME / ROOM_SNAPSHOT
- [ ] SUBMIT_CLAIM / ROUND_RESULT
