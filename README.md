# Dynamica Command

Dynamica Command is a browser **Command & Conquer–like** RTS. Enter a **4-digit seed** (`0000`–`9999`) to create a full campaign: factions, characters, story, maps, and objectives. The same code always creates the same campaign. Progress saves in this browser — no account required.

**[Play from source](#run)** · [github.com/zakaihamilton/dynamica-command](https://github.com/zakaihamilton/dynamica-command)

![Desktop mission gameplay](docs/mission-desktop.png)

## Run

Requires Node.js and [Yarn 1](https://classic.yarnpkg.com/) (`packageManager`: `yarn@1.22.22`).

```bash
yarn install --frozen-lockfile
yarn dev
```

Open the app, then choose **New Game** or type a seed such as `0421` and choose **Launch**. Progress autosaves under that seed. **Tutorial** opens a guided training range with no time limit. **Options** (welcome and pause) control **music and sound effects**, including volume sliders. Pause also opens named save slots, load, and briefing. Browse unit and building art at **`/assets`**.

| Script | What it does |
| --- | --- |
| `yarn dev` | Next.js dev server |
| `yarn build` / `yarn start` | Production build and serve |
| `yarn test` | Vitest (headless, no browser) |
| `yarn typecheck` | TypeScript type checking without emitting files |
| `yarn test:e2e` | Playwright browser smoke test; runs a browser preflight first |
| `yarn inspect 0421` | Dump generated campaign JSON |
| `yarn sim --seed 0421 --mission 0 --ticks 200` | Tick a mission without the UI |
| `yarn balance --from 0 --to 39 --jobs 8 --check true` | Run the competent commander through the full mission horizon with bounded worker parallelism and enforce balance thresholds. `--jobs 1` is the serial reference; omit it for a bounded CPU-based default. CI samples seeds `0000`–`0039` (320 scenarios) with 8 workers. |
| `yarn health:invariants` | Validate generated campaign topology and scenario reachability across representative seeds |
| `yarn health:coverage` | Run focused V8 coverage; long generated-map and commander sweeps run in `health:invariants` |
| `yarn health:performance` | Enforce terrain atlas, simulation, combat, and routing performance budgets |
| `yarn health:balance` | Run the strict 320-scenario competent-commander acceptance sweep used by CI |
| `yarn compress-art` | Convert PNG art plates to alpha WebP (`--dry-run`, `portraits` / `sprites` / `terrain` / `all`) |

For local E2E runs, the preflight launches the same headless browser used by Playwright and reports an actionable install/path error before starting the app. Run `yarn playwright install chromium`, or point at an installed browser with `PLAYWRIGHT_CHROME_PATH=/absolute/path/to/chrome yarn test:e2e`. Ubuntu CI installs and runs the bundled Chromium as the authoritative browser environment.

## How a seed works

A seed is a four-digit campaign code. Enter the same number later and you get the same world, factions, and eight missions. Progress (units, credits, explored map, and build queues) autosaves on this device for that seed. Pause **Save Mission** also writes a named slot you can keep beside that autosave. Music and sound settings are saved separately.

```text
seed 0421
  ├─ world setting, tone, conflict
  ├─ two factions (names, palettes)
  ├─ commander, advisor, enemy leader (faces + copy)
  └─ 8 missions
       ├─ win category + parameters
       ├─ briefing
       └─ map (size, heightmap, resources, bases)
```

Share a seed to share a universe. **Load Mission** lists named save slots and autosaves on this device, and each campaign has an **operations map**. From New Game, enter or roll a seed and choose Operations map to inspect the theater before deployment. Select an operation to preview its primary and secondary objectives, expected duration, map scale, and unlocks before deploying. Unlocked operations launch from their briefing; completed operations can be replayed for better medals and scores.

## Campaign

Eight missions, about **5–20 minutes** each for classic and hold-the-line operations (later missions run longer). Timed operations (escort, sabotage, rescue, extraction) use a longer window: **10–30 minutes** of active time (sabotage **12–30**), plus a 7-minute wait before an escort convoy starts moving. Mission briefings show whole minutes; the battlefield clock counts down to the second. Every seed includes escort, sabotage, rescue, and extraction, plus four of the eight classic win categories:

| Category | You win by… |
| --- | --- |
| Harvest quota | Earning a credit total (lifetime harvested, not current balance) |
| Force quota | Training N units (any, or a specific role such as tanks) |
| Structure quota | Completing N buildings |
| Destroy marked | Destroying 1–3 tagged enemy structures |
| Raze all | Destroying every enemy building |
| Decapitate | Destroying the enemy Construction Yard |
| Annihilate | Wiping out enemy units and buildings |
| Hold the line | Surviving a timer with your Construction Yard standing |
| Escort | Walking marked allies into a zone |
| Sabotage | Destroying marked structures before a deadline |
| Rescue | Freeing stranded units by reaching them |
| Extraction | Bringing cargo units back to your yard |

Lose if your Construction Yard falls. Hold, escort, sabotage, rescue, and extraction also fail when their timer expires. Escort, extraction, and rescue fail immediately if a Convoy Truck, unextracted cargo unit, or unrescued stranded unit is destroyed. Briefings show portraits of your commander, advisor, and the enemy leader, and name the objective.

### Loop

Harvest ore → spend credits and power → place buildings → train units → fight. From the first mission, Barracks can train Field Medics and War Factories can produce Repair Trucks. Escort missions use durable, unarmed Convoy Trucks as their marked targets. Medics heal infantry and Repair Trucks repair vehicles on their own, or you can send them with a right-click. Stop holds them in place. Damaged buildings can be repaired from the sidebar wrench for a fraction of their build cost, or **sold** with the scrap tool (`F`) for a partial refund. The enemy expands, guards its yard, raids Harvesters, uses support units, and falls back when battered. Maps grow from small early theaters to large late ones, with **valleys, plains, hills, and mountains**. Units can climb one height step; a two-level drop is a cliff. Buildings need flat ground (no water, no overlap, one height).

Each mission allows at most one Barracks and one War Factory. Hover a unit or building for health, faction, and extras such as Harvester cargo or a marked target.

### Controls

| Input | Action |
| --- | --- |
| Left click / drag | Select |
| Right click | Move, attack, or harvest |
| Right click / touch friendly target | Assign a selected support unit to heal that compatible human or vehicle |
| Ctrl / Cmd + right click | Attack-move (Harvesters still gather on ore) |
| Repair wrench / R | Click a damaged friendly building to start or stop repairs |
| Sell / F | Click a finished friendly building to scrap it for credits |
| Stop / X | Halt selected units |
| Selection panel | Stance (Aggressive / Defend / Hold) and formation (Line / Column / Wedge) |
| Minimap click / drag | Move the camera |
| WASD / arrows | Pan |
| Q / E / T | Construction / production / selected tabs |
| 1–5 | Sidebar cameo (Ctrl+1–5 cancels) |
| H / Home | Jump to Construction Yard |
| Space | Center camera on selection |
| Esc | Pause, or cancel place/repair/sell |
| Hover | Tooltip on the unit or building under the cursor (shortcuts appear in HUD tips) |
| Sidebar left click | Place buildings and train units from the command tabs |
| Sidebar right click | Cancel construction or a queued unit and refund its cost |
| Touch (under 800px) | Command tray for move, attack-move, harvest, stop, stance, and formation |

## For developers

### Architecture

Next.js (App Router) + TypeScript + Canvas 2D. The browser is a renderer and input adapter. **`lib/gen` and `lib/sim` import nothing from the DOM** so tests and CLIs use the same functions as the UI. See [`docs/architecture.md`](docs/architecture.md) for the runtime state flow and extension boundaries.

The **battlefield draws sprites** (procedural specs and `public/art` rasters). CPU-projected 3D meshes (`draw3dModel`) are used for turret heads and the Asset Bay preview lab, not for units in play.

```text
app/           menu, briefing, play, tutorial, campaign, campaign-complete
components/    HUD, canvas, talking heads
lib/seed       4-digit seed → mulberry32 forks
lib/gen        world, factions, maps, story, sprite specs
lib/sim        tick, pathfinding, economy, combat, support, repair, AI, objectives
lib/iso        tile ↔ screen projection (DOM-free; used by render and audio)
lib/render     sprites, minimap, camera pan, CPU 3D turret/preview
lib/audio      generated SFX + seeded background music (Web Audio)
lib/persist    save/load + audio settings (localStorage or in-memory)
scripts/       inspect + headless sim
tests/         Vitest
```

### Public asset API

The Asset Bay is intentionally public and does not require an account or API key. The browser UI is available at `/assets`; JSON consumers can use these stable routes:

| Route | Purpose |
| --- | --- |
| `GET /api/assets` | List all generated assets; optional `category` is `unit`, `building`, `wreck`, or `rubble`. |
| `GET /api/assets/:id` | Return metadata, dimensions, source URL, and supported directions for one catalog ID such as `unit:infantry`. |
| `GET /api/assets/:id/preview` | Return an SVG preview; units accept `facing=0`–`7`, while buildings, wrecks, and rubble accept the default facing `0` only. |
| `OPTIONS /api/assets` | CORS preflight for the list endpoint. |

Responses advertise `apiVersion: 1`, allow cross-origin reads, and use a one-hour public cache (`Cache-Control: public, max-age=3600, s-maxage=3600`). Consumers should pin the API version and treat catalog IDs as the stable asset identifiers; a future incompatible contract will increment the version.

Units, buildings, portraits, biomes, and terrain plates are **seed-tinted rasters** under `public/art`, composited with procedural specs (cliffs, wrecks, damage overlays). SFX and **background music** are generated in Web Audio from the seed. Music adapts to mission pressure, while battlefield effects are rate-limited and subtly stereo-positioned. Welcome and pause **Options** expose independent toggles and volume controls.

### Headless API

```ts
createCampaign(seed)
createMission({ seed, missionIndex })
tick(state, commands?)
issue(state, command)   // move | attackMove | attack | support | harvest | build | produce
                        // cancelBuild | cancelProduce | repair | sell | stop | stance | formation
inspect(state)          // compact JSON: credits, counts, objective, result
```

`yarn sim` exit codes: `0` playing, `10` win, `11` lose.

Optional `--orders orders.json`:

```json
[{ "tick": 12, "command": { "type": "move", "unitIds": [4], "x": 10, "y": 8 } }]
```

The balance harness uses the same public command API as a player. It builds missing infrastructure, maintains power, produces counters and support units, and assigns objective-aware orders. It runs through the full generated operation window by default (up to 30 minutes, or 37 with escort staging); `--ticks` is an intentional shorter cap and `--check true` rejects any truncated scenarios. `--jobs N` assigns deterministic seed/mission scenarios to worker threads; results are sorted by seed and mission so `--jobs 1` remains a serial reference. Omit `--jobs` for a bounded worker count based on available CPU parallelism. Progress is printed to stderr for long runs; use `--progress false` to suppress it or `--progress-every 8` to report every eighth scenario. Use `--strategy baseline` to run the older harvest-and-attack baseline, `--details true` to include per-seed records, or `--check true` to enforce the softened 60–97.5% competent win-rate, ≤20% timeout, ≥40% per-kind/per-mission win-rate, zero reliability failures, and ≤40 average-casualty targets (override them with `--min-win-rate`, `--max-win-rate`, `--max-timeout-rate`, `--min-kind-samples`, `--min-kind-win-rate`, `--max-kind-timeout-rate`, `--max-truncated-rate`, `--max-average-casualties`, and the reliability flags). `yarn health:performance` measures late-game 96×96 commander-plus-simulation p95, terrain atlas cost, and blocked-LOS combat p95.

HUD `data-testid`s for browser smoke tests: `seed`, `credits`, `objective`, `mission-result`.

## Stack

- Next.js 16, React 19, TypeScript
- Canvas isometric renderer (no Phaser)
- Vitest + `tsx` for tests and CLIs
- CSS Modules for menu/HUD chrome
