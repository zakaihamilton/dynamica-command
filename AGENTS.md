<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Genesis Protocol is a single, fully client-side Next.js 16 + React 19 browser RTS game (Canvas 2D). There is no backend service, database, or environment variables to configure — all campaign content is generated deterministically from a 4-digit seed and persisted to `localStorage`. See `README.md` for the full command list and game details.

Node 22 and Yarn 1.22.22 are preinstalled. The startup update script runs `yarn install --frozen-lockfile` and `yarn playwright install chromium`, so dependencies and the e2e browser are already present when you start.

Standard commands (defined in `package.json`, don't duplicate — reference there):

- `yarn dev` — Next.js dev server on port 3000 (this is the app; run it to test the UI).
- `yarn test` — Vitest, 384 headless unit tests, no browser needed.
- `yarn build` — production build.
- `yarn test:e2e` — Playwright. Its `webServer` runs `yarn build && PORT=3100 ... yarn start`, so it builds and serves its own production server on port 3100 (independent of the port-3000 dev server); it needs the Chromium installed by the update script.
- `yarn inspect <seed>` / `yarn sim --seed <seed> --mission <n> --ticks <n>` — headless CLIs via `tsx`.

Non-obvious caveats:

- `yarn lint` is clean on a checkout.
- First deploy of a seed routes to `/tutorial`. Briefing/play smoke tests in `tests/e2e/smoke.spec.ts` mark that seed's tutorial complete in `localStorage` so they can open `/briefing` directly; a separate smoke case covers menu → `/tutorial` → Skip training → `/briefing`.
- To manually reach the battlefield: New Game → enter a seed (or use ROLL) → Launch → advance through the first-deploy tutorial (Spacebar / Skip) → briefing → Launch. The seed field is split into individual digit inputs, so ROLL is the most reliable way to seed it in automated/browser testing.
