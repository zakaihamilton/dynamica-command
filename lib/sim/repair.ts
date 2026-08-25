import { repairCostFor, repairHpPerTick } from "../catalog";
import { isBuildingEntity, type SimEvent, type SimState } from "../types";

export function canRepair(e: { class: string; hp: number; maxHp: number; constructing: number }): boolean {
  return e.class === "building" && e.hp > 0 && e.constructing === 0 && e.hp < e.maxHp;
}

export function tickRepair(state: SimState): SimEvent[] {
  for (const e of state.entities) {
    if (!e.repairing) continue;
    if (!isBuildingEntity(e) || e.hp <= 0 || e.constructing > 0) {
      e.repairing = false;
      continue;
    }
    if (e.hp >= e.maxHp) {
      e.hp = e.maxHp;
      e.repairing = false;
      continue;
    }
    const kind = e.kind;
    const restored = Math.min(repairHpPerTick(kind), e.maxHp - e.hp);
    const cost = Math.max(1, Math.round(repairCostFor(kind, restored)));
    if (state.credits[e.owner] < cost) continue;
    state.credits[e.owner] -= cost;
    e.hp = Math.min(e.maxHp, e.hp + restored);
    if (e.hp >= e.maxHp) {
      e.hp = e.maxHp;
      e.repairing = false;
    }
  }
  return [];
}
