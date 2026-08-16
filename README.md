# Genesis Protocol

A browser **Command & Conquer–like** isometric RTS. One **4-digit seed** (`0000`–`9999`) writes the whole theater: factions, characters, campaign plot, mission maps, win conditions, and every sprite. Enter the same number later to resume.

**[Play from source](#run)** · [github.com/zakaihamilton/genesis-protocol](https://github.com/zakaihamilton/genesis-protocol)

## Run

Requires Node.js and [Yarn 1](https://classic.yarnpkg.com/) (`packageManager`: `yarn@1.22.22`).

```bash
yarn
yarn dev
```

Open the app, then **New Game** or type a seed such as `0421` and **Deploy**. Progress autosaves in the browser under that seed.

| Script | What it does |
| --- | --- |
| `yarn dev` | Next.js dev server |
| `yarn build` / `yarn start` | Production build and serve |
| `yarn test` | Vitest (headless, no browser) |
| `yarn inspect 0421` | Dump generated campaign JSON |
| `yarn sim --seed 0421 --mission 0 --ticks 200` | Tick a mission without the UI |

## How a seed works

The four digits are hashed into forked RNGs (`world`, `faction:0`, `mission:3`, …). Campaign content is **never stored** — it is regenerated. Only mutable sim state (units, credits, fog, queues) is saved in `localStorage` as `genesis-protocol:save:0421`.

```
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

Eight missions, about **5–20 minutes** each (later missions run longer). Each mission rolls a different **win category**:

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

Lose if your construction yard falls (or the timer expires on a hold). Briefings use generated talking-head portraits and name the objective.

### Loop

Harvest resource fields → spend credits and power → place buildings → produce units → fight. Enemy AI expands and sends waves. Maps grow from ~48×48 early to ~96×96 late, with **valleys, plains, hills, and mountains**. Units can climb one elevation step; a two-level drop is a cliff. Buildings need a flat footprint (no water, no overlap, one height).

Yards, power plants, and barracks are **2×2**; refineries and factories **3×2**; turrets **2×1**. Hover a unit or building for a tooltip (kind, faction, HP, and extras such as harvester cargo or a marked target).

### Controls

| Input | Action |
| --- | --- |
| Left click / drag | Select |
| Right click | Move, attack, or harvest |
| Wheel | Zoom |
| WASD | Pan |
| Hover | Tooltip on the unit or building under the cursor |
| Sidebar | Place buildings; produce from a selected barracks or factory |

## Architecture

Next.js (App Router) + TypeScript + Canvas 2D. The browser is a renderer and input adapter. **`lib/gen` and `lib/sim` import nothing from the DOM** so tests and CLIs use the same functions as the UI.

```
app/           menu, briefing, play routes
components/    HUD, canvas, talking heads
lib/seed       4-digit seed → mulberry32 forks
lib/gen        world, factions, maps, story, sprite specs
lib/sim        tick, pathfinding, economy, combat, AI, objectives
lib/render     isometric camera, sprites, minimap
lib/persist    save/load (localStorage or in-memory)
scripts/       inspect + headless sim
tests/         Vitest
```

Sprites, tiles, portraits, and SFX are **generated** (shape specs + faction palettes + Web Audio). There is no stock unit art.

### Headless API

```ts
createCampaign(seed)
createMission({ seed, missionIndex })
tick(state, commands?)
issue(state, command)   // move | attack | harvest | build | produce
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
- Tailwind for menu/HUD chrome
