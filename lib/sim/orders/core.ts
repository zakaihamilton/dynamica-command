import { isSupportUnit } from "../../catalog";
import { TILE_RESOURCE, type Command, type Entity, type SimEvent, type SimState, type TutorialStage, type UnitKind } from "../../types";
import { findPath } from "../pathfinding";
import { byId, inBounds, tileAt } from "../world";
import { holdSupport } from "../support";
import { moveUnits, attackMoveUnits } from "./movement";
import { attackUnits, supportUnits, setStance, setFormation } from "./combat";
import { startBuild, cancelBuild, sellBuilding, toggleRepair } from "./building";
import { startProduce, cancelProduce } from "./production";

export function issue(state: SimState, command: Command): SimEvent[] {
  if (state.result !== "playing") return [];
  if (state.tutorialStage && state.tutorialStage !== "complete") {
    const stages = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"] as const;
    const required = command.type === "move" || command.type === "stop" || command.type === "formation" || command.type === "stance" ? "move"
      : command.type === "harvest" ? "harvest"
        : command.type === "build" || command.type === "cancelBuild" ? "build"
            : command.type === "produce" || command.type === "cancelProduce" ? "produce"
              : command.type === "attack" || command.type === "attackMove" ? "attack"
                : command.type === "repair" ? "repair" : undefined;
    if (required && stages.indexOf(state.tutorialStage) < stages.indexOf(required)) {
      return [{ type: "commandRejected", reason: `training step: ${required}` }];
    }
  }
  let events: SimEvent[];
  switch (command.type) {
    case "move":
      events = moveUnits(state, command.unitIds, command.x, command.y, command.formation);
      break;
    case "attackMove":
      events = attackMoveUnits(state, command.unitIds, command.x, command.y, command.formation);
      break;
    case "attack":
      events = attackUnits(state, command.unitIds, command.targetId);
      break;
    case "support":
      events = supportUnits(state, command.unitIds, command.targetId);
      break;
    case "harvest":
      events = harvestUnits(state, command.unitIds, command.x, command.y);
      break;
    case "build":
      events = startBuild(state, command.building, command.x, command.y);
      break;
    case "produce":
      events = startProduce(state, command.fromId, command.unit);
      break;
    case "cancelBuild":
      events = cancelBuild(state, command.building);
      break;
    case "cancelProduce":
      events = cancelProduce(state, command.unit);
      break;
    case "repair":
      events = toggleRepair(state, command.buildingId);
      break;
    case "sell":
      events = sellBuilding(state, command.buildingId);
      break;
    case "stop":
      events = stopUnits(state, command.unitIds);
      break;
    case "stance":
      events = setStance(state, command.unitIds, command.stance);
      break;
    case "formation":
      events = setFormation(state, command.unitIds, command.formation);
      break;
    default:
      events = [];
  }
  if (!events.some((event) => event.type === "commandRejected")) advanceTutorialAfterCommand(state, command.type);
  return events;
}

function advanceTutorialAfterCommand(state: SimState, type: Command["type"]): void {
  if (!state.tutorialStage || state.tutorialStage === "complete") return;
  const next: Partial<Record<TutorialStage, TutorialStage>> = {
    move: "harvest",
    harvest: "build",
    build: "produce",
    produce: "attack",
    attack: "repair",
    repair: "complete",
  };
  const expected: Record<string, Command["type"][]> = {
    move: ["move", "attackMove"],
    harvest: ["harvest"],
    build: ["build"],
    produce: ["produce"],
    attack: ["attack", "attackMove"],
    repair: ["repair"],
  };
  const stage = state.tutorialStage;
  const nextStage = next[stage];
  if (expected[stage]?.includes(type) && nextStage) state.tutorialStage = nextStage;
}

function stopUnits(state: SimState, ids: number[]): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.owner !== 0 || e.class !== "unit") continue;
    e.path = [];
    e.attackTarget = undefined;
    e.orderMode = undefined;
    e.orderDestination = undefined;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = true;
    if (isSupportUnit(e.kind as UnitKind)) holdSupport(e);
  }
  return [];
}

function travelOrder(ids: number[], x: number, y: number, attackMove: boolean): Command {
  return attackMove
    ? { type: "attackMove", unitIds: ids, x, y }
    : { type: "move", unitIds: ids, x, y };
}

/** Right-click / tap ground: harvest ore with harvesters, move everyone else onto the tile. */
export function groundOrders(state: SimState, ids: number[], x: number, y: number, attackMove = false): Command[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (!inBounds(state, tx, ty) || tileAt(state, tx, ty) !== TILE_RESOURCE) {
    return [travelOrder(ids, tx, ty, attackMove)];
  }
  const harvesters: number[] = [];
  const movers: number[] = [];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
    if (e.kind === "harvester") harvesters.push(id);
    else movers.push(id);
  }
  const commands: Command[] = [];
  if (harvesters.length) commands.push({ type: "harvest", unitIds: harvesters, x: tx, y: ty });
  if (movers.length) commands.push(travelOrder(movers, tx, ty, attackMove));
  return commands;
}

function harvestUnits(state: SimState, ids: number[], x: number, y: number): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.kind !== "harvester" || e.owner !== 0 || e.neutral) continue;
    e.attackTarget = undefined;
    e.orderMode = "move";
    e.orderDestination = { x: Math.round(x), y: Math.round(y) };
    e.gatherX = Math.round(x);
    e.gatherY = Math.round(y);
    e.idle = false;
    e.path = findPath(state, e, { x: e.gatherX, y: e.gatherY });
  }
  return [];
}

export function applyCommands(state: SimState, commands: Command[]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const c of commands) events.push(...issue(state, c));
  return events;
}

export function setPathTo(state: SimState, e: Entity, dest: { x: number; y: number }): void {
  e.path = findPath(state, e, dest);
}
