import { readFileSync } from "node:fs";
import { parseSeed } from "../lib/seed/rng";
import { createMission, inspect, tick } from "../lib/sim/api";
import type { Command } from "../lib/types";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

const seedRaw = arg("seed", "0000")!;
const seed = parseSeed(seedRaw);
if (seed === null) {
  console.error("Usage: yarn sim --seed 0421 --mission 0 --ticks 200");
  process.exit(1);
}

const missionIndex = Number(arg("mission", "0"));
const ticks = Number(arg("ticks", "200"));
const ordersPath = arg("orders");

type TimedOrder = { tick: number; command: Command };
let orders: TimedOrder[] = [];
if (ordersPath) {
  orders = JSON.parse(readFileSync(ordersPath, "utf8")) as TimedOrder[];
}

const state = createMission({ seed, missionIndex });
for (let i = 0; i < ticks; i++) {
  if (state.result !== "playing") break;
  const cmds = orders.filter((o) => o.tick === state.tick).map((o) => o.command);
  tick(state, cmds.length ? cmds : undefined);
}

const report = inspect(state);
console.log(JSON.stringify(report, null, 2));
if (report.result === "won") process.exit(10);
if (report.result === "lost") process.exit(11);
process.exit(0);
