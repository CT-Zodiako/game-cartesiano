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

- [x] T1 S1 domain feedback + board reveal — inline — commit: 20aaf5d
- [x] T2 S2 axis label colors — inline — commit: e04adfd
- [x] T3 S3 connection-loss recovery — inline — commit: 97b5d61
- [x] T4 S4 tutorial — inline — commit: 0511369
- [x] T5 S5 personal summary — inline — commit: f375124
- [x] T6 S6 sound toggle — inline — commit: dc22f12
- [x] T8 S1 correct-but-beaten answers shown as correct — inline — commit: cc7fca0
- [x] T9 S1 readable reveal and post-round clicks — inline — commit: 547d70b
- [x] T7 S7 docs — inline — commit: (this commit)

## Delivery

- Slice 1 (review PR 1): T1–T3, commits 20aaf5d..97b5d61 (~379 lines).
- Slice 2 (review PR 2, chained on slice 1): T4, T8, T5, commits 0511369..f375124.
- Slice 3 (review PR 3, chained on slice 2): T6, T9, T7, from dc22f12.

## Log

- L1 User (2026-10-18): "hagamoslo" — approving the improvement list: marker → mobile/limits → stability → tutorial and feedback → progressive practice, plus summary, sound/accessibility, and real mobile/multiplayer checks.
- L2 Evidence: the target marker is disabled on purpose; drawing it during the round reveals the answer. Corner hits such as (-10, 10) are already covered by `tests/ui/board.test.ts` (commit b305798).
- L3 Open decision: `tests/ui/online-only.test.ts` pins an online-only game, so a solo practice mode needs the user's approval. Full room rejoin after a drop needs a server reconnect token (identity and concurrency risk); deferred to the user's decision.
- L4 Evidence: the server answers TOO_LATE only after validating the vertex (`server/room-engine.ts`), so a TOO_LATE claim is a correct answer beaten by a faster player; the client showed it as "Error" / "Tiempo agotado" (fixed in T8).
- L5 Live check (2026-10-18, two browser players): wrong X sign showed "Revisá el signo de X: 3 es hacia la derecha." with the correct vertex revealed; killing the server sent the guest back to the menu with "Se perdió la conexión con la sala DLT29G…" and the code pre-filled; the final ranking showed "Aciertos: 1 de 2 (50%)". Found and fixed: the locked board faded the revealed vertex, and post-round clicks showed an error card (T9).
- L6 User (2026-10-18): "mantenemso el eugo solo" — keep the game online-only; no solo practice mode.
- L7 User (2026-10-18): "en la guia podemos poenr esto mismo [tap hint image] podemo poenr a la cuadricula lo de lso cuadrantes nombrarlos" — add the tap animation to the guide and name the quadrants on the board.
- L8 User (2026-10-18): "no se sabe cuando cambia la cordenada no se nota que ya cambio la cordenada y la cuadricula toca hacer minmo de 4 * 4 yaque en alunos cel es muy pequeno [...] y no ocupa toda lap antalla el tablero y es mas dificl selccionar" — round-change animation + round badge + marker reset, mobile range ±4, narrow margin 22px, auto-scroll to the board on phones (found live: joining scrolled the board off-screen).
- L9 User (2026-10-18): "podemos ahcer que apra el cel se vuelva un menu amrigesa y desde ah peuda hacer todo ya que ese escroll hacia ariba para buscar el tablelro es incomoddo no tine usabilidad" — off-canvas hamburger menu on phones; scroll-to-board removed.
- L10 User (2026-10-18): "no em gusta cmose ve sieto que peirde muhco espacio [...] entre las dodne esta el tiempo y el tablero y le pegas el menu muy pegado a ellos puede hacer el menu ariba de lo de tiempo cordenada y la ayude acerlo arriba deform de boton olo para cel ?" — phone menu button moved to its own top bar; board aligned right under the header.
- L11 User (2026-10-18): "vale vamos ahcer la guia mas dinamica , ejemplo en el origen podsmo poner la selecion del origen como se ve en el jeugo real y la explicaicon , la idea esque no toque leer muhcoq eu se muy intutiva y el boton siguiente se activ e despeus de unos 10 seg de leer la idea es engnachar por eso debemso ser realsitas que se meuva que tnga naiamcion la guia y la guia es obligatoria" — animated mini-board scenes per step, one-line texts, 10 s unlock, mandatory first run (reopened guide stays optional).
- L12 User (2026-10-18): "a esot peude ponerle este era el punto correcto para dar infromacion [revealed ring screenshot]" — label "Punto correcto (x, y)" next to the revealed ring, opening toward the board center.
- L13 User (2026-10-18): "quiero cambiar el tiempo de esepra por 5 seg cada paso, en la ultima ayuda no hagas la animacion de mover el mouse solo haz que se perecino ay que lo de no arrastrar con solo tocar se contradice con la ccion que se mira en la animacion" — wait 5 s per step; last scene hand appears on the vertex and taps instead of travelling.
- L14 User (2026-10-18): "la guia es obligatorio y no veo los 5 segundo para pasar me deja pasar y cuando recargo la guia no aparee" + choice "aparece siempre al fina debe mostrar un checkde no mostrar mas" — guide mandatory on every open (load, reload, button) with 5 s wait; last-step checkbox "No volver a mostrar esta guía" stops automatic opening; new storage key xy-arena-tutorial-hidden.
- L15 User (2026-10-18): "podemos meter un landing para poner los qr de las enceuntas las del juego como las que no jeugan ponlo en ua ruta que yo solo acceda" + choices: password (recommended) and publish the 5 forms — /docente with HTTP Basic auth from DOCENTE_PASSWORD; forms published as "Cualquier persona con el enlace".
- L16 User (2026-10-18): "antes de poenr la ocntrasena quiero algo quiero una visualizacion en pantalla compelta por qr , ten ecneutna que es apra mostrar en pantalla videobean y telefono" — full-screen stage per QR on /docente (white background, max-size QR, prev/next by buttons, keys, swipe, wake lock).
- L17 User (2026-10-18): "podemos poner el qr del juego" — game QR (https://xyarena.xyz/) added to Grupo A between pretest and postest on /docente.
