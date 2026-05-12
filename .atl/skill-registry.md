# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | /Users/cristiantovar/.config/opencode/skills/branch-pr/SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | /Users/cristiantovar/.config/opencode/skills/issue-creation/SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | /Users/cristiantovar/.config/opencode/skills/skill-creator/SKILL.md |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | /Users/cristiantovar/.config/opencode/skills/go-testing/SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen". | judgment-day | /Users/cristiantovar/.config/opencode/skills/judgment-day/SKILL.md |
| When the user asks about libraries, frameworks, API references, or needs code examples. | context7-mcp | /Users/cristiantovar/.agents/skills/context7-mcp/SKILL.md |
| When the user is looking for functionality that might exist as an installable skill. | find-skills | /Users/cristiantovar/.agents/skills/find-skills/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Cada PR DEBE linkear un issue aprobado (`status:approved`).
- El PR DEBE tener exactamente una label `type:*`.
- Nombre de rama obligatorio: `type/description` con regex permitida.
- Usá conventional commits válidos (`type(scope): description` o `type: description`).
- Corré `shellcheck` en scripts modificados antes de abrir PR.
- Incluí `Closes/Fixes/Resolves #N` en body usando el template.
- No usar `Co-Authored-By` ni abrir PR sin issue.

### issue-creation
- Nunca crear issues en blanco: usar template bug/feature.
- Todo issue nace con `status:needs-review`; no habilita PR todavía.
- Un maintainer debe agregar `status:approved` antes de implementar.
- Preguntas van a Discussions, no a Issues.
- Verificá duplicados antes de crear.
- Completá todos los campos requeridos y checks de pre-flight.

### skill-creator
- Crear skills solo para patrones reutilizables, no tareas one-off.
- Estructura mínima: `skills/{name}/SKILL.md` (+ assets/references opcionales).
- Frontmatter obligatorio: `name`, `description` con Trigger, `license`, `metadata`.
- Preferí reglas críticas y ejemplos mínimos; sin contenido redundante.
- `references/` debe apuntar a archivos locales, no URLs web.
- Registrar el skill nuevo en `AGENTS.md`.

### go-testing
- Priorizar tests table-driven para lógica de negocio.
- Probar `Model.Update()` directo para transiciones de estado Bubble Tea.
- Usar `teatest.NewTestModel()` para flujos TUI end-to-end.
- Golden files para validar salida visual de `View()`.
- Cubrir casos de éxito y error explícitamente.
- En IO/sistema usar `t.TempDir()` y separar unit vs integración.

### judgment-day
- Resolver skill registry antes de lanzar jueces y propagar reglas compactas.
- Lanzar 2 jueces ciegos en paralelo con mismo scope, nunca secuencial.
- Sintetizar hallazgos en: confirmed, suspect A/B, contradiction.
- Clasificar WARNING como `real` o `theoretical`; teóricos se reportan como INFO.
- Ronda 1: pedir confirmación del usuario antes de arreglar.
- Re-juzgar tras fixes; tras 2 iteraciones con issues, escalar decisión al usuario.

### context7-mcp
- Siempre resolver library ID antes de consultar docs (`resolve-library-id`).
- Pasar la pregunta completa del usuario como `query`.
- Elegir match por nombre exacto, score y fuente oficial.
- Si hay versión pedida, usar ID versionado cuando exista.
- Responder basado en docs actuales de Context7, no memoria del modelo.

### find-skills
- Usar cuando el usuario busca capacidades instalables o workflows existentes.
- Primero identificar dominio/tarea, luego revisar leaderboard de skills.sh.
- Si falta cobertura, buscar con `npx skills find <query>`.
- Validar calidad: installs, reputación de source y stars del repo.
- Recomendar con comando de instalación y enlace de referencia.
- Si no hay skill, ofrecer ayuda directa y opción `npx skills init`.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| — | — | No se detectaron archivos de convención en el root del proyecto |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
