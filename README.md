# Genesis Protocol

Browser Command & Conquer–like isometric RTS. A **4-digit seed** (`0000`–`9999`) generates the campaign, maps, story, characters, win categories, and all art. The same number resumes a saved run.

```bash
yarn
yarn dev
```

Open the menu, start a new game or enter a seed such as `0421`.

## Testing (for agents)

Sim and generators are headless. No browser required.

```bash
yarn test
yarn inspect 0421
yarn sim --seed 0421 --mission 0 --ticks 200
```

`inspect` dumps campaign JSON. `sim` ticks a mission and prints `inspect()` output.

Exit codes for `yarn sim`: `0` still playing, `10` win, `11` lose.

Optional `--orders orders.json` is an array of `{ "tick": number, "command": Command }`.

Public API (`lib/sim/api.ts`, `lib/gen/campaign.ts`):

- `createCampaign(seed)`
- `createMission({ seed, missionIndex })`
- `tick(state, commands?)`
- `issue(state, command)`
- `inspect(state)`

HUD test ids: `seed`, `credits`, `objective`, `mission-result`.

## Controls

- Left click / drag: select
- Right click: move, attack, or harvest
- Wheel: zoom
- WASD: pan
- Sidebar: place buildings, produce from a selected barracks/factory
