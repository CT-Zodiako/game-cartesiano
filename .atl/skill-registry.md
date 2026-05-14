# Skill Registry

**Delegator use only.** Delegators resolve matching skills and inject compact rules into sub-agent prompts.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Anime.js adapter patterns in HyperFrames | animejs | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/animejs/SKILL.md |
| PR creation workflow | branch-pr | /Users/cristiantovar/.config/opencode/skills/branch-pr/SKILL.md |
| Library/framework docs via Context7 | context7-mcp | /Users/cristiantovar/.agents/skills/context7-mcp/SKILL.md |
| Contribute new HyperFrames catalog items | contribute-catalog | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/contribute-catalog/SKILL.md |
| CSS deterministic animation patterns | css-animations | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/css-animations/SKILL.md |
| Discover/install skills | find-skills | /Users/cristiantovar/.agents/skills/find-skills/SKILL.md |
| Go testing patterns | go-testing | /Users/cristiantovar/.config/opencode/skills/go-testing/SKILL.md |
| GSAP patterns in HyperFrames | gsap | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/gsap/SKILL.md |
| Build HyperFrames compositions | hyperframes | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/hyperframes/SKILL.md |
| HyperFrames CLI workflow | hyperframes-cli | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/hyperframes-cli/SKILL.md |
| HyperFrames media preprocessing | hyperframes-media | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/hyperframes-media/SKILL.md |
| Install/use HyperFrames registry blocks | hyperframes-registry | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/hyperframes-registry/SKILL.md |
| Issue creation workflow | issue-creation | /Users/cristiantovar/.config/opencode/skills/issue-creation/SKILL.md |
| Dual adversarial review | judgment-day | /Users/cristiantovar/.config/opencode/skills/judgment-day/SKILL.md |
| Lottie deterministic adapter patterns | lottie | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/lottie/SKILL.md |
| Port Remotion to HyperFrames | remotion-to-hyperframes | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/remotion-to-hyperframes/SKILL.md |
| Create new AI agent skills | skill-creator | /Users/cristiantovar/.config/opencode/skills/skill-creator/SKILL.md |
| Tailwind v4.2 patterns for HyperFrames | tailwind | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/tailwind/SKILL.md |
| Three.js deterministic HyperFrames patterns | three | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/three/SKILL.md |
| Web Animations API deterministic patterns | waapi | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/waapi/SKILL.md |
| Website capture to HyperFrames video | website-to-hyperframes | /Users/cristiantovar/DEV/projects/game_cartesiano/.agents/skills/website-to-hyperframes/SKILL.md |

## Compact Rules

### animejs
- Use only for HyperFrames Anime.js work.
- Register/track animation instances on `window.__hfAnime`.
- Make timelines seek-driven and deterministic.
- Avoid non-deterministic time sources.
- Prefer adapter patterns from skill references.

### branch-pr
- Follow issue-first workflow before opening PR.
- Validate branch state and diff scope.
- Create clear PR summary and risk notes.
- Use `gh` CLI for PR operations.
- Do not skip required checks.

### context7-mcp
- Resolve library ID first, then query docs.
- Use fetched docs as primary source.
- Use for frameworks/APIs/SDK/CLI questions.
- Keep queries specific and task-oriented.
- Prefer version-specific IDs when applicable.

### contribute-catalog
- Use only for upstream catalog contributions.
- Do not use for local in-project authoring.
- Follow registry block/component contribution format.
- Validate wiring and examples before PR.
- Keep contribution scoped and reviewable.

### css-animations
- Author CSS animations with deterministic seek behavior.
- Control timing via stable keyframes and delays.
- Ensure predictable fill/play state for rendering.
- Avoid random/time-now driven animation.
- Align animation state to HyperFrames timeline.

### find-skills
- Use when user asks to discover or add skills.
- Match requests to existing installed skills first.
- Recommend installation only when missing.
- Keep suggestions tied to concrete user intent.
- Prefer minimal, actionable guidance.

### go-testing
- Apply Go-first test patterns and table tests.
- Use targeted coverage strategy, not blanket tests.
- Use teatest patterns for Bubbletea TUIs.
- Keep tests deterministic and isolated.
- Prefer clear fixtures and fast feedback loops.

### gsap
- Use GSAP patterns compatible with HyperFrames.
- Keep timelines deterministic and seekable.
- Favor transforms/will-change for performance.
- Use timeline labels/positions intentionally.
- Avoid uncontrolled runtime side effects.

### hyperframes
- Use for HTML-based video composition authoring.
- Keep animation deterministic for preview/render parity.
- Separate scene timing, media, and transitions clearly.
- Use dedicated companion skills for CLI/media tasks.
- Validate composition flow end-to-end.

### hyperframes-cli
- Use for init/lint/inspect/preview/render workflow.
- Use doctor/info/browser for environment diagnostics.
- Keep command sequence explicit and reproducible.
- Route asset preprocessing to hyperframes-media.
- Prefer quick validation before full render.

### hyperframes-media
- Use for TTS/transcribe/remove-background preprocessing.
- Expect first-run model download latency.
- Chain outputs cleanly into composition inputs.
- Choose model/voice based on quality-speed tradeoff.
- Keep asset paths explicit.

### hyperframes-registry
- Use for `hyperframes add` and registry wiring.
- Install blocks/components in correct project location.
- Wire block sub-compositions explicitly.
- Merge component snippets safely.
- Verify `hyperframes.json` consistency.

### issue-creation
- Follow issue-first policy and template quality.
- Provide clear scope, acceptance, and rationale.
- Use `gh` CLI for issue creation/inspection.
- Avoid vague bug/feature descriptions.
- Keep issue actionable by implementers.

### judgment-day
- Run dual blind review process when requested.
- Synthesize findings and apply validated fixes.
- Re-judge after fixes; escalate after max iterations.
- Keep evidence and verdicts explicit.
- Do not shortcut the protocol.

### lottie
- Use deterministic Lottie/dotLottie adapters.
- Register instances on `window.__hfLottie`.
- Drive playback by timeline seek, not wall-clock.
- Avoid runtime drift between preview/render.
- Validate exported animation timing.

### remotion-to-hyperframes
- Use only when user explicitly requests migration.
- For new videos, use hyperframes skill instead.
- Flag unsupported React-side patterns early.
- Prefer runtime interop over lossy translation.
- Keep behavior parity as acceptance criteria.

### skill-creator
- Create skills with valid frontmatter and contracts.
- Prioritize hard rules, gates, and output contract.
- Keep references local and stable.
- Optimize for LLM runtime execution.
- Avoid verbose background in skill body.

### tailwind
- Use Tailwind v4.2 browser-runtime patterns.
- Prefer CSS-first token strategy where needed.
- Distinguish v3 syntax from v4 expectations.
- Decide runtime vs compiled CSS by constraints.
- Keep utilities deterministic in render contexts.

### three
- Build deterministic Three.js scenes for HyperFrames.
- Sync camera/mixer/shader state to seek timeline.
- Avoid non-deterministic per-frame randomness.
- Keep render loop controlled by host timeline.
- Optimize for predictable WebGL output.

### waapi
- Use WAAPI with explicit `currentTime` control.
- Track animations via `document.getAnimations()`.
- Ensure timing/fill modes are render-stable.
- Avoid uncontrolled autoplay behavior.
- Align keyframe effects to deterministic seeking.

### website-to-hyperframes
- Trigger whenever user provides a URL for video output.
- Follow capture → script → storyboard → build flow.
- Keep output aligned to source site narrative.
- Validate visual accuracy and pacing.
- Deliver render-ready HyperFrames composition.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| — | — | No project convention index files detected in root (`agents.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `copilot-instructions.md`). |
