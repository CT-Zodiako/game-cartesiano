---
name: Game Cartesiano - Mission Control
colors:
  primary: "#0f172a"
  on-primary: "#e2e8f0"
  accent: "#22d3ee"
  success: "#a3e635"
  error: "#f87171"
  muted: "#475569"
typography:
  headline:
    fontFamily: JetBrains Mono
    fontSize: 5rem
    fontWeight: 800
    letterSpacing: -0.02em
  body:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.6
  data:
    fontFamily: Space Mono
    fontSize: 1.5rem
    fontWeight: 600
rounded:
  md: 8px
spacing:
  md: 20px
  lg: 40px
motion:
  energy: high
  easing:
    entry: "expo.out"
    exit: "power4.in"
    ambient: "sine.inOut"
  duration:
    entrance: 0.5
    hold: 2.0
    transition: 0.7
  atmosphere:
    - grid-lines
    - radial-glow
    - scanning-lines
  transition: glitch
---

## Overview

High-tech "Mission Control" aesthetic. The goal is to make learning the Cartesian plane feel like a sophisticated space mission. Sharp typography, glowing accents, and percussive motion.

## Colors

- **Primary** (`#0f172a`) — Deep space background.
- **On-Primary** (`#e2e8f0`) — Clear data readouts.
- **Accent** (`#22d3ee`) — Mission info, targets, and navigational markers.
- **Success** (`#a3e635`) — Rover path and correct hits.
- **Error** (`#f87171`) — Critical alerts, failed hits, and low time.
- **Muted** (`#475569`) — Grid lines and background structure.

## Typography

- **Headline** — `JetBrains Mono` for that terminal/engineer feel.
- **Body** — `Inter` for readability.
- **Data** — `Space Mono` for all coordinates and numerical values.

## Layout

- **Structure**: HUD Overlay — Content anchored to corners with a central grid focus.
- **Density**: Normal.
- **Corners**: Rounded (`8px`) for cards and buttons.

## Elevation

Layered — Use subtle glows (`{{ac25}}`) instead of shadows to create depth on a dark canvas.

## Do's and Don'ts

### Do's
- Use `Space Mono` for all (x, y) coordinates.
- Ensure the Cartesian grid is always visible in the background.
- Use Lime-400 (`#a3e635`) for any successful movement or "Acierto" state.

### Don'ts
- Do not use generic sans-serif for numbers.
- Avoid bright light backgrounds.
- Do not use slow, floaty animations for data updates; use snappy `expo.out`.
