# Code Review Rules

## Project
- Keep the game educational and deterministic for tests.
- Preserve the TypeScript ESM setup (`type: module`).
- Keep server-side multiplayer logic independent from browser DOM APIs.

## TypeScript
- Prefer explicit domain types for protocol messages and game state.
- Avoid `any`; use narrowed unions or `unknown` with validation.
- Keep pure scoring/ranking/domain logic isolated from transport code.

## Tests
- Keep behavior tests close to the feature they verify.
- Run `npm test` before committing multiplayer or scoring changes.
- Include regression coverage for protocol, ranking, and room lifecycle changes.

## Documentation
- Update README and docs when user-visible gameplay, deployment, or architecture changes.
