# Expanded Prompt: Game Cartesiano - Mission Briefing

## Title + Style Block
- **Theme**: Mission Control HUD
- **Palette**: 
  - Primary (BG): `#0f172a`
  - On-Primary (Text): `#e2e8f0`
  - Accent (Target/Info): `#22d3ee`
  - Success (Rover/Acierto): `#a3e635`
  - Error (Alerts/Timer): `#f87171`
- **Typography**: 
  - Headline: `JetBrains Mono` (Bold 800)
  - Data: `Space Mono` (Regular 600)
  - Body: `Inter` (Regular 400)
- **Motion Energy**: High (Snappy, percussive)

## Rhythm Declaration
`hook-PUNCH-breathe-PEAK-CTA`

## Global Rules
- **Parallax**: Background grid drifts slowly (10px) throughout the video.
- **Micro-motion**: Scanning line sweeps from top to bottom every 2s.
- **Transitions**: Primarily Glitch or Whip Pan for high energy.
- **Layers**: 
  - BG: Deep navy fill + Scanning lines + Faded Cartesian grid (15% opacity).
  - MG: Coordinate markers + Rover path + HUD Panels.
  - FG: Floating text + Glitch overlays + Accent glows.

---

## Per-Scene Beats

### Scene 1: Mission Initiation (0.0s - 3.5s)
- **Concept**: Cinematic HUD boot-up sequence. The viewer is being initialized into the Mission Control.
- **Mood direction**: Cyberpunk terminal, technical, urgent.
- **Depth layers**: 
  - BG: Radial glow in center (#22d3ee at 10% opacity).
  - MG: Monospace code snippets scrolling vertically at edges (5% opacity).
  - FG: "GAME CARTESIANO" headline in center.
- **Animation choreography**: 
  - Headline GLITCHES in from 0 scale.
  - Subhead "INITIALIZING HUD..." types on character by character.
  - Corner HUD registration marks SLAM into place.
- **Transition out**: Glitch transition, 0.4s.

### Scene 2: Coordinate Lock (3.5s - 7.5s)
- **Concept**: Explaining the core mechanic. A target coordinate is generated and "locked" on the grid.
- **Mood direction**: Precise, mathematical, satisfying.
- **Depth layers**: 
  - BG: Full Cartesian grid with bold X/Y axes (#94a3b8).
  - MG: Target marker at `(-5, 3)` pulsing in Cyan.
  - FG: Floating HUD box showing `TARGET: (-5, 3)`.
- **Animation choreography**: 
  - Grid DRAWS itself via SVG paths in 0.5s.
  - HUD Box SLIDES in from right with `expo.out`.
  - Target marker SCALES in with `back.out(2)`.
- **Transition out**: Whip pan left, 0.3s.

### Scene 3: Rover Deployment (7.5s - 11.5s)
- **Concept**: The Rover moves to the target and scores. High energy payoff.
- **Mood direction**: Victorious, energetic, game-like.
- **Depth layers**: 
  - BG: Grid remains.
  - MG: Lime-green path line drawing from (0,0) to target.
  - FG: Large "+100 PTS" floating text.
- **Animation choreography**: 
  - Path line DRAWS itself following the movement.
  - Score PUNCHES into existence and scales up 20% before settling.
  - "ACIERTO!" label SLAMS down from top.
- **Transition out**: Shader transition (Ridged Burn), 0.6s.

### Scene 4: Online Battle (11.5s - 16.0s)
- **Concept**: Multiplayer mode. Multiple indicators flash, showing the competitive side.
- **Mood direction**: Intense, crowded, competitive.
- **Depth layers**: 
  - BG: Matrix of multiple mini-grids.
  - MG: Scrolling leaderboard with 8 names.
  - FG: "ONLINE MULTIPLAYER" banner across center.
- **Animation choreography**: 
  - Leaderboard CASCADE animation, each row staggered 0.05s.
  - Banner SHATTERS into place with glitch effect.
  - Countdown timer "12s" in red pulses on the beat.
- **Transition out**: Blur through, 0.5s.

### Scene 5: Final Call (16.0s - 20.0s)
- **Concept**: Final branding and call to action.
- **Mood direction**: Clean, authoritative, final.
- **Depth layers**: 
  - BG: Solid Slate-950 + subtle scanning noise.
  - MG: Website URL + Logo.
  - FG: "DOMINATE THE PLANE" headline.
- **Animation choreography**: 
  - Headline SLIDES up from 0 opacity.
  - URL types on with cursor blink.
  - Logo SCALES in with `expo.out`.
- **Transition out**: Final fade to black.

---

## Recurring Motifs
- Monospace font for all numeric data.
- Cyan pulse for targets, Lime for success.
- Glitch artifacts on every scene entry.

## Negative Prompt
- No rounded fonts.
- No pastel colors.
- No slow transitions between gameplay beats.
- No "web page" layout; keep it as a game HUD.
