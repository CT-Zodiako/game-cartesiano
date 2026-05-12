import os

# Define the PRD content in Markdown
prd_content = """# PRD: Mars Rover Math Engine - Documentación Técnica

Este documento define las especificaciones técnicas para el desarrollo de un motor de simulación basado en el reto Mars Rover. El objetivo es proporcionar una plataforma donde el aprendizaje de conceptos matemáticos sea una consecuencia directa de la implementación lógica.

---

## 1. El Plano Cartesiano: Estructura de Datos Espacial

**Concepto Matemático:** El Plano Cartesiano es el **Espacio de Estado** del sistema.
**Implementación Técnica:** El "Plateau" se define como una matriz de coordenadas enteras dentro de un dominio acotado.

### 1.1. Definición del Dominio
- **Ejes:** Se define un eje de abscisas ($X$) y un eje de ordenadas ($Y$).
- **Origen:** El punto de referencia absoluto es $(0,0)$, ubicado en la esquina inferior izquierda (mínimo global).
- **Límites (Upper-Right):** El límite máximo $(X_{max}, Y_{max})$ define el rango del plano.
- **Tipo de Dato:** Enteros no negativos ($x, y \in \mathbb{Z} \geq 0$).

---

## 2. Definición Matemática de Función (Transición de Estado)

En este motor, cada comando NASA (`L`, `R`, `M`) no es una instrucción de control de flujo, sino una **Función de Transformación de Estado** $f: S \to S$.

### 2.1. El Estado del Rover ($S$)
El estado se define como una tupla inmutable: 
$$S = (x, y, \theta)$$
Donde:
- $x, y$: Coordenadas cartesianas.
- $\theta$: Orientación (Cardinalidad $\in \{N, E, S, W\}$).

### 2.2. Funciones de Rotación (Giro)
Son funciones cíclicas que operan exclusivamente sobre la variable $\theta$.
- **Función $L$ (Left):** $f(\theta) = (\text{índice}(\theta) + 3) \pmod 4$
- **Función $R$ (Right):** $f(\theta) = (\text{índice}(\theta) + 1) \pmod 4$

### 2.3. Función de Traslación (Movimiento $M$)
Es una función de suma vectorial basada en vectores unitarios de dirección.
$$f(x, y, \theta) = (x + \Delta x, y + \Delta y, \theta)$$

| Orientación ($\theta$) | Vector Unitario ($\vec{v}$) | Transformación |
| :--- | :--- | :--- |
| **North (N)** | $(0, 1)$ | $y = y + 1$ |
| **South (S)** | $(0, -1)$ | $y = y - 1$ |
| **East (E)** | $(1, 0)$ | $x = x + 1$ |
| **West (W)** | $(-1, 0)$ | $x = x - 1$ |

---

## 3. Función Lineal: Desplazamiento y Pendiente

**Concepto Matemático:** La función lineal $f(t) = mt + b$.
**Implementación Técnica:** Cuando el comando `M` se repite $n$ veces sin cambios de dirección.

### 3.1. Modelado de la Trayectoria
Si el Rover está orientado al Norte y recibe $n$ comandos `M`:
- **Ecuación:** $y(n) = 1 \cdot n + y_{inicial}$
- **Pendiente ($m$):** Es la unidad de movimiento constante (1 unidad/comando).
- **Intersección ($b$):** Es la posición inicial en el eje correspondiente antes de iniciar la secuencia de movimiento.

---

## 4. Requerimientos Funcionales y Validaciones

### 4.1. Parser de Instrucciones
El sistema debe procesar un `string` de comandos y ejecutar una **composición de funciones**:
$$Estado_{Final} = (f_n \circ f_{n-1} \circ \dots \circ f_1)(Estado_{Inicial})$$

### 4.2. Validación de Fronteras (Dominio Acotado)
Antes de cada actualización de estado de movimiento, el motor debe validar la pre-condición:
- $0 \leq x' \leq X_{max}$
- $0 \leq y' \leq Y_{max}$
Si el nuevo estado viola esta condición, la función de traslación debe retornar el estado actual (inmovilidad) o lanzar una excepción de "Fuera de Dominio".

### 4.3. Procesamiento Secuencial
Cada Rover debe completar su cadena de funciones antes de que el siguiente Rover inicie su ejecución, garantizando la integridad de los datos en el plano (evitando colisiones lógicas en el estado).

---

## 5. Arquitectura Sugerida para la Demo

- **Backend (API):** Un controlador que reciba el JSON/Texto de entrada, realice el parsing y ejecute el motor de lógica matemática.
- **Frontend (Visualizador):** Una grilla interactiva que escuche los cambios de estado y anime el desplazamiento del rover, dibujando la "traza" del movimiento para visualizar la función lineal resultante.

---
*Documento generado para fines educativos y de ingeniería de software.*
"""

file_path = "/mnt/data/PRD_Mars_Rover_Math.md"

with open(file_path, "w") as f:
    f.write(prd_content)

print(f"File saved at: {file_path}")