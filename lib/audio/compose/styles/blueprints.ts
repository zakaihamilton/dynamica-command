import type { StyleBlueprint } from "./types";
import { ELECTRONIC_BLUEPRINTS } from "./blueprints/electronic";
import { INDUSTRIAL_BLUEPRINTS } from "./blueprints/industrial";
import { CINEMATIC_BLUEPRINTS } from "./blueprints/cinematic";
import { GROOVE_BLUEPRINTS } from "./blueprints/groove";

const ALL_BLUEPRINTS_MAP: Record<string, StyleBlueprint> = {};
for (const bp of [
  ...ELECTRONIC_BLUEPRINTS,
  ...INDUSTRIAL_BLUEPRINTS,
  ...CINEMATIC_BLUEPRINTS,
  ...GROOVE_BLUEPRINTS,
]) {
  ALL_BLUEPRINTS_MAP[bp.name] = bp;
}

const BLUEPRINT_ORDER: readonly string[] = [
  "neon-arpeggio",
  "industrial-march",
  "acid-grid",
  "orbital-drift",
  "cinematic-tension",
  "signal-chase",
  "chrome-fanfare",
  "low-orbit",
  "glass-chime",
  "foundry-stomp",
  "night-raid",
  "ice-protocol",
  "bit-garrison",
  "resonant-coil",
  "break-wire",
  "dune-cipher",
  "relay-dub",
  "disco-command",
  "choir-vector",
  "tape-static"
] as const;

export const STYLE_BLUEPRINTS: readonly StyleBlueprint[] = BLUEPRINT_ORDER.map(
  (name) => ALL_BLUEPRINTS_MAP[name]!,
);

export * from "./blueprints/electronic";
export * from "./blueprints/industrial";
export * from "./blueprints/cinematic";
export * from "./blueprints/groove";
