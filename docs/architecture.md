# Architecture

Genesis Protocol is a deterministic, client-side real-time strategy game. The URL seed and mission identify a generated theater; the browser owns the mutable simulation session and persists it locally.

## Boundaries

```text
Next.js routes
  ├─ menu / tutorial / briefing / campaign screens
  ├─ play route
  │    └─ GameClient (client-only)
  │         ├─ React chrome and overlays
  │         ├─ Canvas input adapter
  │         └─ runtime hooks
  └─ public asset API

runtime hooks
  ├─ useGameRuntimeState  — campaign, initial state, refs, save session
  ├─ useGameActions       — converts UI actions into queued Commands
  ├─ useGameInput         — pointer/touch selection and ground targeting
  ├─ useGameKeyboard      — keyboard shortcut adapter
  ├─ useGameSession       — pause, save/load, tutorial, and navigation
  ├─ useGameLoop          — browser effects around the simulation loop
  └─ useGameRenderer      — Canvas frame rendering and effects

lib/gen + lib/sim
  └─ DOM-free deterministic game domain used by the UI, tests, and CLIs
```

The `lib/gen` and `lib/sim` layers must not import React, browser globals, or Canvas APIs. This keeps generated campaigns and simulation replays usable from Vitest and the headless scripts.

## Seed and generated content

`createCampaign(seed)` derives forked RNG streams for the world, factions, characters, story, mission objectives, biomes, and map inputs. `createMission({ seed, missionIndex })` turns the generated campaign and map into a mutable `SimState`.

Generated content is not saved. A save contains the current simulation state, including units, buildings, fog, queues, RNG state, objective runtime, and navigation revision. Regenerating from the same seed remains the source of truth for static campaign data.

## Runtime state flow

```text
pointer / touch / keyboard / sidebar
                │
                ▼
        Command[] queue (ref)
                │
                ▼
requestAnimationFrame → lib/game/loop.ts
                │
                ├─ drains commands
                ├─ tick(state, commands)
                │    ├─ production and economy
                │    ├─ movement and pathfinding
                │    ├─ combat, repair, and support
                │    ├─ mission director / scenario
                │    ├─ AI and fog
                │    └─ objectives and lifecycle cleanup
                │
                ├─ updates the authoritative state ref
                ├─ emits simulation events
                └─ redraws Canvas / HUD effects

state ref ──┬─ renderer and minimaps
            ├─ selection, camera, and hover logic
            ├─ audio event dispatch
            └─ autosave / terminal save / telemetry
```

The simulation is fixed-step (`12` ticks per second). Rendering may interpolate between ticks, but it must never mutate authoritative simulation state. The loop discards hidden-window time rather than simulating a large backlog when the tab regains focus.

React state is used for values that affect visible UI. Mutable refs hold the high-frequency state and interaction state so the Canvas loop does not require a React render on every simulation tick. `useGameLoop` publishes a shallow entity-array update periodically, after commands, and at terminal states.

## Commands and events

User intent enters through the public `Command` union in `lib/types.ts` and is applied by `issue` / `applyCommands` in `lib/sim/orders`. Simulation systems return `SimEvent` values for production, combat, objectives, alerts, and command rejection.

Keep gameplay rules in `lib/sim`. UI code should translate events into presentation effects such as sound, alerts, navigation, or overlays. Headless callers should use the same public API:

```ts
const state = createMission({ seed: 421, missionIndex: 0 });
const result = tick(state, commands);
```

## Navigation and performance

Static terrain and building occupancy are cached by `navigationRevision` in `staticNavigationFor`. Unit occupancy remains per-tick because units move frequently. Building placement, selling, cancellation, and destruction invalidate the revision. Flow fields and A* searches share this cached static grid.

Performance-sensitive work should be measured with `yarn health:performance`. The benchmark covers late-game simulation, terrain atlas generation, foreground routing, multi-destination flow fields, and blocked-line-of-sight combat. Do not loosen a threshold without recording why the workload or target changed.

## Persistence boundaries

- `lib/persist/save`: versioned simulation serialization and validation.
- `lib/persist/campaign`: unlocks, medals, and best scores.
- `lib/persist/settings`: audio and UI preferences.
- `lib/persist/telemetry`: bounded local mission metrics.
- `SaveSession`: best-effort same-tab and cross-tab conflict detection around `localStorage`.

Explicit save/load actions may adopt a new snapshot. Implicit autosaves refuse to overwrite a detected external change so another tab or imported transfer is not silently lost.

## Adding a feature

1. Add or update the domain type in `lib/types.ts`.
2. Put deterministic generation in `lib/gen` and simulation rules in `lib/sim`.
3. Add commands/events rather than reaching into UI state from the simulation.
4. Add focused unit tests, plus a determinism or generated-seed invariant when the feature affects seeded content.
5. Connect the UI through a hook or surface component, keeping Canvas rendering and browser APIs out of the domain layer.
6. Run typecheck, lint, targeted tests, the full suite, build, and the relevant health scripts.
