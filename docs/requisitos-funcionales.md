# Requisitos Funcionales — Game Cartesiano

## RF-1: Modo Ejercicio (Single-Player)

### RF-1.1: Sistema de objetivos
El sistema DEBE generar coordenadas objetivo aleatorias dentro del dominio del tablero.
- Dominio: `0 ≤ x ≤ X_max`, `0 ≤ y ≤ Y_max`
- X_max e Y_max se configuran en el arranque

### RF-1.2: Interacción por click
El sistema DEBE aceptar clicks solo en vértices del tablero (radio de 6px de tolerancia).
- Cada vértice corresponde a una coordenada entera
- El estado del rover se actualiza al seleccionar

### RF-1.3: Validación de respuesta
El sistema DEBE validar la posición seleccionada contra el objetivo:
- **Acierto:** posición del rover == objetivo
- **Error:** posición del rover != objetivo

### RF-1.4: Sistema de puntaje
El sistema DEBE:
- Sumar +10 puntos por acierto
- Descontar -5 puntos por error
- Mostrar puntaje acumulado en pantalla

### RF-1.5: Ciclo de juego
Tras cada validación DEBE:
1. Mostrar feedback (acierto/error)
2. Reiniciar rover a S=(0,0,N)
3. Generar nuevo objetivo aleatorio
4. Continuar sin interrumpir la sesión

---

## RF-2: Modo Online (Multijugador)

### RF-2.1: Creación de sala
El sistema DEBE permitir crear una sala con:
- Nombre del host
- Código de sala único (6 caracteres alfanuméricos)
- Estado inicial: `LOBBY`

### RF-2.2: Unión a sala
El sistema DEBE permitir unirse a una sala existente con:
- Código de sala válido
- Nombre del jugador
- Verificar que la sala esté en estado `LOBBY`

### RF-2.3: Gestión de jugadores
El sistema DEBE:
- Limitar a máximo 8 jugadores por sala
- Permitir que el host inicie solo desde estado `LOBBY`
- Sincronizar lista de jugadores conectados

### RF-2.4: Partida multijugador
El servidor DEBE:
- Coordinar 3 rondas por partida
- Definir el reloj oficial de 20 segundos
- Enviar ROOM_SNAPSHOT periódico a todos los clientes
- Procesar SUBMIT_CLAIM de cada jugador

### RF-2.5: Scoring competitivo
El servidor DEBE calcular puntuación por ronda:
```
puntuación = clamp(20 - tiempo_respuesta, 0, 20) * 100
```
- Tiempo límite: 20 segundos
- Aciertos en tiempo: puntuación = 1000 + bonus por tiempo
- Respuestas tardías: rechazadas
- Errores: 0 puntos

### RF-2.6: Ranking en vivo
El sistema DEBE:
- Actualizar ranking tras cada ronda
- Enviar ranking a todos los jugadores
- Mostrar ranking final al terminar la partida

---

## RF-3: Protocolo WebSocket

### RF-3.1: Eventos C2S (cliente → servidor)
| Evento | Payload |
|--------|---------|
| `CREATE_ROOM` | `{ playerName: string }` |
| `JOIN_ROOM` | `{ roomCode: string, playerName: string }` |
| `START_GAME` | `{}` (solo host) |
| `SUBMIT_CLAIM` | `{ position: { x, y } }` |
| `LEAVE_ROOM` | `{}` |

### RF-3.2: Eventos S2C (servidor → cliente)
| Evento | Payload |
|--------|---------|
| `ROOM_CREATED` | `{ roomCode, players }` |
| `ROOM_JOINED` | `{ roomCode, players, gameState }` |
| `PLAYER_JOINED` | `{ playerName }` |
| `PLAYER_LEFT` | `{ playerName }` |
| `GAME_STARTED` | `{ roundDuration: 20000 }` |
| `ROUND_STARTED` | `{ roundNumber, target }` |
| `ROUND_ENDED` | `{ roundNumber, results }` |
| `GAME_ENDED` | `{ rankings }` |
| `ROOM_SNAPSHOT` | `{ players, roundNumber, timeLeft }` |
| `ERROR` | `{ code, message }` |

### RF-3.3: Validación de payloads
El sistema DEBE validar todos los payloads entrantes:
- Tipos de datos correctos
- Rangos válidos
- Campos requeridos presentes
- Devolver `ERROR` con código apropiado ante invalidéz

---

## RF-4: Visualización

### RF-4.1: Tablero cartesiano
La interfaz DEBE mostrar:
- Grilla con ejes X e Y visibles
- Vértices clickeables en cada coordenada
- Rover visual en la posición actual

### RF-4.2: Panel de información
La interfaz DEBE mostrar:
- Objetivo actual
- Estado del rover (posición y orientación)
- Puntaje (single-player) o ranking (multiplayer)
- Cuenta regresiva del turno

### RF-4.3: Feedback de respuesta
La interfaz DEBE:
- Mostrar mensaje de acierto/error tras cada intento
- Animar el rover si corresponde
- Actualizar el ranking tras cada ronda
