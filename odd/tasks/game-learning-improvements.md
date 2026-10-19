# Game learning improvements

Improve XY Arena as a learning tool using the survey findings (connection, device, visual design, stability, weak decomposition).
Branch: `feat/learning-feedback`. UI copy stays in Spanish (existing project convention).

## Specs

- S1 Post-answer feedback: after a claim is answered (correct, wrong, or late), the board reveals the correct vertex; it is never drawn while the round is active, because that would give the answer away. A wrong answer explains the mistake: swapped order "(x, y)", wrong sign on X or Y, wrong quadrant, or a point on an axis.
- S2 Axis readability: X labels and Y labels use distinct colors (X blue, Y green, as in the class presentation) so students do not confuse the two numberings ("LA UBICACION DE LOS NUMEROS EN LOS CASILLAS DE X y Y SE PUDE EQUIBOCAR PERSONAS QUE NO ENTIENDAN LA LOGICA DEL JUEGO").
- S3 Connection loss: when the connection drops while the player is in a room, the game does not stay stuck on a stale room; it returns to the entry menu, explains what happened, and pre-fills the room code so the player can rejoin.
- S4 Tutorial: a "¿Cómo se juega?" guide explains origin, X axis, Y axis, the "(x, y)" order, and the quadrants; it opens automatically on the first visit and can be reopened at any time.
- S5 Personal summary: the final ranking shows the player's own hits, misses, accuracy, and the most frequent mistake type, with a short practice suggestion.
- S6 Sound control: a persistent mute toggle; feedback never relies on color alone.
- S7 Docs: README and PRD describe the new behavior and the current project state.

## Tasks

- T1 S1 domain feedback + board reveal — inline — commit: pending
- T2 S2 axis label colors — inline — commit: pending
- T3 S3 connection-loss recovery — inline — commit: pending
- T4 S4 tutorial — inline — commit: pending
- T5 S5 personal summary — inline — commit: pending
- T6 S6 sound toggle — inline — commit: pending
- T7 S7 docs — inline — commit: pending

## Log

- L1 User (2026-10-18): "hagamoslo" — approving the improvement list: marker → mobile/limits → stability → tutorial and feedback → progressive practice, plus summary, sound/accessibility, and real mobile/multiplayer checks.
- L2 Evidence: the target marker is disabled on purpose; drawing it during the round reveals the answer. Corner hits such as (-10, 10) are already covered by `tests/ui/board.test.ts` (commit b305798).
- L3 Open decision: `tests/ui/online-only.test.ts` pins an online-only game, so a solo practice mode needs the user's approval. Full room rejoin after a drop needs a server reconnect token (identity and concurrency risk); deferred to the user's decision.
