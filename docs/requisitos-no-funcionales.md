# Requisitos No Funcionales — Game Cartesiano

## RNF-1: Performance

### RNF-1.1: Tiempo de respuesta
- El servidor DEBE responder a mensajes WebSocket en < 50ms (percentil 95)
- La UI DEBE actualizar el tablero en < 16ms (60 FPS)

### RNF-1.2: Latencia tolerable
- El modo online tolera latencia de red de hasta 200ms entre clientes
- El servidor procesa mensajes en orden FIFO, ignorando llegadas tardías

### RNF-1.3: Concurrencia
- El servidor DEBE manejar mínimo 50 salas concurrentes
- Cada sala soporta hasta 8 jugadores simultáneos

---

## RNF-2: Disponibilidad

### RNF-2.1: Uptime
- El servidor backend DEVE tener uptime del 99.5%
- Graceful degradation: si el servidor cae, el modo ejercicio sigue funcionando

### RNF-2.2: Caída de conexión
- Si un jugador pierde conexión, tiene 30 segundos para reconectarse
- El servidor retiene su estado durante ese período
- Pasado ese tiempo, el jugador es removido de la sala

---

## RNF-3: Seguridad

### RNF-3.1: Validación de entrada
- Todos los inputs del cliente DEBEN ser validados en el servidor
- Coordenadas fuera del dominio son rechazadas con ERROR
- Códigos de sala con formato inválido son rechazados

### RNF-3.2: Autoría del juego
- Solo el host puede iniciar la partida (START_GAME)
- El servidor es la única fuente de verdad para scoring y timing

### RNF-3.3: Rate limiting
- Máximo 1 mensaje SUBMIT_CLAIM por ronda por jugador
- Mensajes duplicados son idempotentes (no duplican puntuación)

---

## RNF-4: Escalabilidad

### RNF-4.1: Arquitectura sin estado compartido
- Cada sala es independiente; no hay estado global entre salas
- El servidor puede escalar horizontalmente si se comparte estado externo

### RNF-4.2: Persistencia
- No se requiere persistencia en v1 (datos en memoria)
- Rankings pueden mostrarse en memoria durante la sesión

---

## RNF-5: Compatibilidad

### RNF-5.1: Navegadores soportados
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### RNF-5.2: Dispositivos
- Desktop: Chrome, Firefox, Safari (prioridad)
- Mobile: Safari iOS, Chrome Android (funcional)
- Touch events soportados en Phaser

### RNF-5.3: Responsive design
- breakpoints: 900px (mobile), sin límite (desktop)
- Tablero ocupa 100% del ancho disponible
- Panel lateral se apila en mobile

---

## RNF-6: Mantenibilidad

### RNF-6.1: Testing
- Coverage mínimo de dominio: 80%
- Tests de integración para flujos principales
- Tests de protocolo WebSocket (mock de servidor)

### RNF-6.2: Modularidad
- Dominio separado de infraestructura (Clean Architecture)
- Módulos WebSocket independientes de lógica de juego
- UI (Phaser) separada de lógica de dominio

### RNF-6.3: Documentación
- Este documento de requisitos
- User stories con criterios de aceptación
- README con instrucciones de запуска
- JSDoc en funciones públicas
