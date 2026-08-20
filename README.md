# Genesis Protocol

A browser **Command & Conquer–like** isometric RTS. One **4-digit seed** (`0000`–`9999`) writes the whole theater: factions, characters, campaign plot, mission maps, win conditions, and every sprite. Enter the same number later to resume.

**[Play from source](#run)** · [github.com/zakaihamilton/genesis-protocol](https://github.com/zakaihamilton/genesis-protocol)

## Run

Requires Node.js and [Yarn 1](https://classic.yarnpkg.com/) (`packageManager`: `yarn@1.22.22`).

```bash
yarn
yarn dev
```

Open the app, then **New Game** or type a seed such as `0421` and **Deploy**. Progress autosaves in the browser under that seed. The first deploy of a seed runs a guided **tutorial**. Pause opens save/load, briefing, **music and sound toggles**, and an **assets browser** for generated sprites.

| Script | What it does |
| --- | --- |
| `yarn dev` | Next.js dev server |
| `yarn build` / `yarn start` | Production build and serve |
| `yarn test` | Vitest (headless, no browser) |
| `yarn test:e2e` | Playwright browser smoke test (run `yarn playwright install chromium` once) |
| `yarn inspect 0421` | Dump generated campaign JSON |
| `yarn sim --seed 0421 --mission 0 --ticks 200` | Tick a mission without the UI |
| `yarn compress-art` | Convert PNG art plates to alpha WebP (`--dry-run`, `portraits` / `sprites` / `terrain` / `all`) |

## How a seed works

The four digits are hashed into forked RNGs (`world`, `faction:0`, `mission:3`, …). Campaign content is **never stored** — it is regenerated. Only mutable sim state (units, credits, fog, queues) is saved in `localStorage` as `genesis-protocol:save:0421`. Audio preferences (`music` / `sound effects`) persist separately as `genesis-protocol:settings`.

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

Share a seed to share a universe. Resume from the menu lists every local save.

## Campaign

Eight missions, about **5–20 minutes** each (later missions run longer). Every seed always includes the four scenario kinds (`escort`, `sabotage`, `rescue`, `extraction`) plus four of the eight classic win categories:

| Category | You win by… |
| --- | --- |
| Harvest quota | Earning a credit total (lifetime harvested, not current balance) |
| Force quota | Producing N units (any, or a seeded role such as tanks) |
| Structure quota | Completing N buildings |
| Destroy marked | Razing 1–3 tagged enemy structures |
| Raze all | Destroying every enemy building |
| Decapitate | Destroying the enemy construction yard |
| Annihilate | Wiping enemy units and buildings |
| Hold the line | Surviving a timer with your yard standing |
| Escort | Walking marked allies into a zone |
| Sabotage | Destroying marked structures before a deadline |
| Rescue | Freeing stranded units by reaching them |
| Extraction | Bringing cargo units back to your yard |

Lose if your construction yard falls (or the timer expires on a hold). Briefings use generated talking-head portraits and name the objective.

### Loop

Harvest resource fields → spend credits and power → place buildings → produce units → fight. Damaged structures can be repaired from the sidebar wrench for a fraction of their build cost, or **sold** with the scrap tool (`F`) for a partial refund. Enemy AI expands, guards its yard, raids harvesters, and falls back when battered. Maps grow from ~48×48 early to ~96×96 late, with **valleys, plains, hills, and mountains**. Units can climb one elevation step; a two-level drop is a cliff. Buildings need a flat footprint (no water, no overlap, one height).

Yards, power plants, and barracks are **2×2**; refineries and factories **3×2**; turrets are **1×1**. Hover a unit or building for a tooltip (kind, faction, HP, and extras such as harvester cargo or a marked target).

### Controls

| Input | Action |
| --- | --- |
| Left click / drag | Select |
| Right click | Move, attack, or harvest |
| Ctrl / Cmd + right click | Attack-move (harvesters still gather on ore) |
| Repair wrench / R | Click a damaged friendly building to start or stop repairs |
| Sell / F | Click a finished friendly building to scrap it for credits |
| Stop / X | Halt selected units |
| Selection panel | Stance (Aggressive / Defend / Hold) and formation (Line / Column / Wedge) |
| Minimap click / drag | Move camera focus |
| WASD / arrows | Pan |
| Q / E / T | Construction / production / selected tabs |
| 1–5 | Sidebar cameo (Ctrl+1–5 cancels) |
| H / Home | Jump to construction yard |
| Space | Center camera on selection |
| Esc | Pause, or cancel place/repair/sell |
| Hover | Tooltip on the unit or building under the cursor (shortcuts appear in HUD tips) |
| Sidebar left click | Place buildings and produce units from the command tabs |
| Sidebar right click | Cancel construction or a queued unit and refund its cost |
| Touch (under 800px) | Command tray for move, attack-move, harvest, stop, stance, and formation |

## Architecture

Next.js (App Router) + TypeScript + Canvas 2D. The browser is a renderer and input adapter. **`lib/gen` and `lib/sim` import nothing from the DOM** so tests and CLIs use the same functions as the UI.

The **battlefield draws sprites** (procedural specs and `public/art` rasters). CPU-projected 3D meshes (`draw3dModel`) are used for turret heads and the pause-menu assets/preview lab, not for units in play.

```text
app/           menu, briefing, play, tutorial, campaign-complete
components/    HUD, canvas, talking heads
lib/seed       4-digit seed → mulberry32 forks
lib/gen        world, factions, maps, story, sprite specs
lib/sim        tick, pathfinding, economy, combat, repair, AI, objectives
lib/render     isometric camera, sprites, minimap, CPU 3D turret/preview
lib/audio      generated SFX + seeded background music (Web Audio)
lib/persist    save/load + audio settings (localStorage or in-memory)
scripts/       inspect + headless sim
tests/         Vitest
```

Sprites, biome tiles, roads, cliffs, portraits, SFX, and **background music** are **generated** (native-resolution shape specs + seeded palettes + Web Audio). The generated art is deterministic per seed, rendered on a minimum 640×480 surface, and uses no stock unit art. Pause **Options** toggles music and sound effects independently.

### Headless API

```ts
createCampaign(seed)
createMission({ seed, missionIndex })
tick(state, commands?)
issue(state, command)   // move | attackMove | attack | harvest | build | produce
                        // cancelBuild | cancelProduce | repair | sell | stop | stance | formation
inspect(state)          // compact JSON: credits, counts, objective, result
```

`yarn sim` exit codes: `0` playing, `10` win, `11` lose.

Optional `--orders orders.json`:

```json
[{ "tick": 12, "command": { "type": "move", "unitIds": [4], "x": 10, "y": 8 } }]
```

HUD `data-testid`s for browser smoke tests: `seed`, `credits`, `objective`, `mission-result`.

## Stack

- Next.js 16, React 19, TypeScript
- Canvas isometric renderer (no Phaser)
- Vitest + `tsx` for tests and CLIs
- CSS Modules for menu/HUD chrome
