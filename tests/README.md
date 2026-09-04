# Test layout

Vitest test files are grouped by the subsystem they exercise:

- `audio/` — Web Audio, music, and SFX behavior.
- `generation/` — seeded campaign, names, portraits, procedural art, and asset generation.
- `persistence/` — saves, settings, campaign progress, serialization, and telemetry.
- `platform/` — app routes, manifests, and other platform-facing contracts.
- `rendering/` — canvas, WebGL, terrain, sprites, camera, and render-layer behavior.
- `simulation/` — mission state, AI, combat, orders, pathfinding, production, and balance.
- `ui/` — React components, screens, hooks, input, menus, tooltips, and UI logic.
- `e2e/` — Playwright browser suites.

Keep `setup.ts` at the test root because it is the shared Vitest setup file. New tests should go in the closest owning subsystem; cross-cutting tests should follow the primary behavior they verify rather than their file extension.
