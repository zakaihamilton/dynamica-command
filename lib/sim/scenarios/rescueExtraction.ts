import type { GeneratedMap } from "../../gen/map";
import { clampPoint } from "../../gen/map/generator/placement";
import { rescueFlankCenter } from "../../gen/map/generator/rescuePlacement";
import { inObjectiveZone, RESCUE_CONTACT_RADIUS } from "../../types";
import type { SimState, Vec2 } from "../../types";

export function rescuePoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart" | "width" | "height">,
  index: number,
  count: number,
): Vec2 {
  const center = rescueFlankCenter(map);
  const spread = (index - (count - 1) / 2) * 4;
  return clampPoint({
    x: center.x + spread,
    y: center.y + (index % 2 === 0 ? -2 : 2),
  }, map.width, map.height);
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
  if (yard) {
    runtime.zone = { x: yard.x, y: yard.y };
  }

  if (runtime.kind === "rescue" && (runtime.contactedIds !== undefined || runtime.rescuedIds !== undefined)) {
    const contacted = runtime.contactedIds ?? [];
    const rescued = runtime.rescuedIds ?? [];
    const contactedSet = new Set(contacted);
    const rescuedSet = new Set(rescued);

    // Capture this list before contacting targets. A newly contacted target
    // may not contact another stranded unit until the next simulation tick.
    const rescuers = state.entities.filter(
      (e) => e.owner === 0 && e.class === "unit" && e.hp > 0 && !e.neutral && !runtime.targetIds.includes(e.id),
    );
    for (const id of runtime.targetIds) {
      if (contactedSet.has(id)) continue;
      const target = state.entities.find((item) => item.id === id && item.hp > 0);
      if (!target?.neutral) continue;
      target.path = [];
      target.routePending = false;
      target.idle = true;
      if (rescuers.some((rescuer) => Math.hypot(rescuer.x - target.x, rescuer.y - target.y) <= RESCUE_CONTACT_RADIUS)) {
        target.neutral = false;
        contacted.push(id);
        contactedSet.add(id);
        runtime.phase = "extraction";
      }
    }

    if (runtime.zone) {
      for (const id of contacted) {
        if (rescuedSet.has(id)) continue;
        const target = state.entities.find((item) => item.id === id && item.hp > 0);
        if (target && !target.neutral && inObjectiveZone(target.x, target.y, runtime.zone)) {
          rescued.push(id);
          rescuedSet.add(id);
        }
      }
    }
    runtime.contactedIds = contacted;
    runtime.rescuedIds = rescued;
    runtime.rescued = rescued.length;
    return;
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
