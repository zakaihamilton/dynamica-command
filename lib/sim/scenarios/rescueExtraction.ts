import type { GeneratedMap } from "../../gen/map";
import { inObjectiveZone, RESCUE_CONTACT_RADIUS } from "../../types";
import type { SimState, Vec2 } from "../../types";

export function rescuePoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart">,
  index: number,
  count: number,
): Vec2 {
  // Rescue missions already place the stranded units on a visible route band.
  // Keep the contested profile's extra risk in the approach lanes and alerts,
  // rather than pushing the rescue targets deeper and starving the base guard.
  const t = 0.55 + (index / Math.max(1, count - 1)) * 0.25;
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

export function centerPoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart">,
  index: number,
  count: number,
  contested: boolean,
): Vec2 {
  const base = (index + 1) / (count + 1);
  const t = contested ? Math.min(0.78, base + 0.12) : base;
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

export function tickRescueExtraction(state: SimState): void {
  const runtime = state.runtime;
  if (!runtime || (runtime.kind !== "rescue" && runtime.kind !== "extraction")) return;

  const yard = state.entities.find((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0);
  if (runtime.kind === "extraction" && yard) {
    runtime.zone = { x: yard.x, y: yard.y };
  }

  // Capture this list before contacting targets. A newly rescued target may
  // not rescue another target until the next simulation tick.
  const rescuers = state.entities.filter(
    (e) => e.owner === 0 && e.class === "unit" && e.hp > 0 && !e.neutral,
  );
  for (const id of runtime.targetIds) {
    const e = state.entities.find((item) => item.id === id && item.hp > 0);
    if (!e?.neutral) continue;
    e.path = [];
    e.routePending = false;
    e.idle = true;
    if (rescuers.some((rescuer) => Math.hypot(rescuer.x - e.x, rescuer.y - e.y) <= RESCUE_CONTACT_RADIUS)) {
      e.neutral = false;
      if (runtime.kind === "rescue") runtime.rescued += 1;
      if (runtime.kind === "extraction") runtime.phase = "extraction";
    }
  }

  if (runtime.kind === "extraction" && runtime.zone) {
    const extracted = runtime.extractedIds ?? [];
    for (const id of runtime.targetIds) {
      if (extracted.includes(id)) continue;
      const e = state.entities.find((item) => item.id === id && item.hp > 0);
      if (!e || e.neutral || !inObjectiveZone(e.x, e.y, runtime.zone)) continue;
      extracted.push(id);
      e.marked = false;
    }
    runtime.extractedIds = extracted;
    runtime.rescued = extracted.length;
  }
}
