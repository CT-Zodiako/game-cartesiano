# Game Cartesiano (Mars Rover Math)

Proyecto educativo en JavaScript para practicar plano cartesiano con una dinámica de juego.

La app muestra una grilla (Phaser) donde tenés que ubicar el rover en la coordenada objetivo. Si acertás, sumás puntos; si fallás, se descuenta.

## Tecnologías

- JavaScript (ES Modules)
- Phaser 3 (vía CDN)
- Node.js (para correr tests)

## Estructura general

- `index.html`: interfaz principal
- `game.js`: lógica del juego en el navegador
- `src/domain/rover/`: reglas del dominio (movimiento, validación, ejecución)
- `src/application/`: parser y simulación de escenarios
- `src/ui/`: adaptadores de UI
- `tests/`: tests unitarios y de integración

## Cómo iniciar el proyecto

Como usa módulos ES en navegador, conviene levantar un servidor local (no abrir el HTML directo con `file://`).

### Opción recomendada (Python)

1. Parate en la carpeta del proyecto.
2. Ejecutá:

```bash
python3 -m http.server 5500
```

3. Abrí en el navegador:

```text
http://localhost:5500
```

## Ejecutar tests

Con Node.js 18+:

```bash
node --test
```

## Objetivo del juego

1. Mirar la coordenada objetivo que aparece en pantalla.
2. Hacer click en una celda del tablero para elegir la posición del rover.
3. Presionar **Comprobar** para validar.
4. Repetir para sumar puntaje.
