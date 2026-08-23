import { finalizeMultiSelect, pickEntity } from "@/lib/render/pick";
import { pickTile, visibleBuildingAt } from "@/lib/render/renderer";
import { screenToTile, tileToScreen, type Camera } from "@/lib/render/iso";
import { groundOrders } from "@/lib/sim/orders";
import { canSupportEntity } from "@/lib/sim/support";
import { heightAt } from "@/lib/sim/world";
import type { Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";

export function isContactTarget(s: SimState, entity: SimState["entities"][number]): boolean {
  return (
    entity.neutral === true &&
    (s.runtime?.kind === "escort" || s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction") &&
    Boolean(s.runtime.targetIds?.includes(entity.id))
  );
}

export function entityAt(s: SimState, tx: number, ty: number) {
  const unit = s.entities.find(
    (en) =>
      en.hp > 0 &&
      en.class === "unit" &&
      (isContactTarget(s, en) || !en.neutral) &&
      Math.round(en.x) === tx &&
      Math.round(en.y) === ty,
  );
  if (unit) return unit;
  return visibleBuildingAt(s, tx, ty);
}

export function pickSelectableEntity(s: SimState, x: number, y: number, tx: number, ty: number, cam: Camera) {
  return (
    pickEntity(s, x, y, cam, s.runtime?.kind === "escort" || s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction") ??
    entityAt(s, tx, ty)
  );
}

export function friendlySupportOrders(s: SimState, ids: number[], target: SimState["entities"][number], x: number, y: number): Command[] {
  if (target.owner !== 0 || target.class !== "unit" || target.neutral) return [];
  const supportIds = ids.filter((id) => {
    const provider = s.entities.find((entity) => entity.id === id && entity.hp > 0);
    return provider ? canSupportEntity(provider, target) : false;
  });
  if (!supportIds.length) return [];
  const commands: Command[] = [{ type: "support", unitIds: supportIds, targetId: target.id }];
  const otherIds = ids.filter((id) => !supportIds.includes(id));
  if (otherIds.length) commands.push(...groundOrders(s, otherIds, x, y));
  return commands;
}

export function contextOrders(s: SimState, ids: number[], target: SimState["entities"][number] | undefined, x: number, y: number, attackMove = false): Command[] {
  const supportOrders = target ? friendlySupportOrders(s, ids, target, x, y) : [];
  if (supportOrders.length) return supportOrders;
  if (target && target.owner === 1) return [{ type: "attack", unitIds: ids, targetId: target.id }];
  return groundOrders(s, ids, x, y, attackMove);
}

export function mobileCommandOrders(
  s: SimState,
  command: MobileCommand,
  ids: number[],
  target: SimState["entities"][number] | undefined,
  x: number,
  y: number,
): Command[] {
  const supportOrders = target ? friendlySupportOrders(s, ids, target, x, y) : [];
  if (supportOrders.length) return supportOrders;
  if (command === "move") return [{ type: "move", unitIds: ids, x, y }];
  if (command === "attackMove") return [{ type: "attackMove", unitIds: ids, x, y }];
  if (command === "attack" && target?.owner === 1) return [{ type: "attack", unitIds: ids, targetId: target.id }];
  if (command === "harvest" && s.tiles[y * s.width + x] === 2) return [{ type: "harvest", unitIds: ids, x, y }];
  return [];
}

export function selectionIdsInBox(s: SimState, cam: Camera, box: { x0: number; y0: number; x1: number; y1: number }, finalize: boolean) {
  const ids: number[] = [];
  const x0 = Math.min(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1);
  const x1 = Math.max(box.x0, box.x1);
  const y1 = Math.max(box.y0, box.y1);
  for (const en of s.entities) {
    if (en.hp <= 0 || en.owner !== 0 || en.class !== "unit" || (en.neutral && !isContactTarget(s, en))) continue;
    const elev = heightAt(s, Math.round(en.x), Math.round(en.y));
    const sp = tileToScreen(en.x, en.y, cam, elev);
    if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) ids.push(en.id);
  }
  return finalize ? finalizeMultiSelect(s.entities, ids) : ids;
}

export function pointerTile(s: SimState, p: { x: number; y: number }, cam: Camera) {
  const picked = pickTile(s, p.x, p.y, cam);
  const t = picked ?? screenToTile(p.x, p.y, cam);
  return { x: Math.round(t.x), y: Math.round(t.y) };
}
