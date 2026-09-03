import { beepForCommands } from "@/lib/audio/uiOrders";
import type { BeepKind } from "@/lib/audio/synth";
import type { Camera } from "@/lib/iso";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import {
  contextOrders,
  friendlySupportOrders,
  isContactTarget,
  mobileCommandOrders,
  pickSelectableEntity,
  pointerTile,
  selectionIdsInBox,
  selectVisibleUnitsOfKind,
} from "./gameInputOrders";
import { selectionBoxDistance, type SelectionBox } from "./selectionBox";

export const DOUBLE_CLICK_MS = 400;
export const DOUBLE_CLICK_PX = 24;

export type LastUnitClick = {
  atMs: number;
  kind: string;
  x: number;
  y: number;
};

export function isSameKindDoubleClick(last: LastUnitClick | null | undefined, next: LastUnitClick): boolean {
  if (!last) return false;
  if (next.kind !== last.kind) return false;
  if (next.atMs - last.atMs > DOUBLE_CLICK_MS) return false;
  return Math.hypot(next.x - last.x, next.y - last.y) <= DOUBLE_CLICK_PX;
}

export type PointerUpInput = {
  pointerType: string;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  p: { x: number; y: number };
  state: SimState;
  cam: Camera;
  selectedIds: number[];
  box: SelectionBox | null;
  selectionMode: boolean;
  mobileCommand: MobileCommand | null;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  doubleClick?: boolean;
  viewport?: { width: number; height: number };
};

export type PointerUpEffect = {
  preventDefault?: boolean;
  clearBox?: boolean;
  commands?: Command[];
  select?: number[];
  endSelectionMode?: boolean;
  clearMobileCommand?: boolean;
  clearPlace?: boolean;
  clearRepairAndSell?: boolean;
  contextOrder?: boolean;
  attackMove?: boolean;
  beep?: BeepKind;
};

const DRAG_THRESHOLD = 8;

function selectableIds(state: SimState, hit: SimState["entities"][number] | undefined): number[] {
  return hit && hit.owner === 0 && (!hit.neutral || isContactTarget(state, hit)) ? [hit.id] : [];
}

function selectionForHit(
  state: SimState,
  cam: Camera,
  hit: SimState["entities"][number] | undefined,
  doubleClick: boolean | undefined,
  viewport: { width: number; height: number } | undefined,
): number[] {
  const ids = selectableIds(state, hit);
  if (!doubleClick || !viewport || !hit || hit.class !== "unit" || !ids.length) return ids;
  const expanded = selectVisibleUnitsOfKind(state, cam, viewport, hit);
  return expanded.length ? expanded : ids;
}

function selectEffect(ids: number[], extra: Omit<PointerUpEffect, "select" | "clearBox" | "beep"> = {}): PointerUpEffect {
  return {
    clearBox: true,
    select: ids,
    ...(ids.length ? { beep: "select" as const } : {}),
    ...extra,
  };
}

export function resolvePointerUp(input: PointerUpInput): PointerUpEffect {
  const {
    pointerType,
    button,
    ctrlKey,
    metaKey,
    p,
    state,
    cam,
    selectedIds,
    box,
    selectionMode,
    mobileCommand,
    placeKind,
    repairMode,
    sellMode,
    doubleClick,
    viewport,
  } = input;
  const { x: tx, y: ty } = pointerTile(state, p, cam);

  if (pointerType === "touch" && selectionMode) {
    const drag = box && selectionBoxDistance(box, cam) > DRAG_THRESHOLD;
    if (drag && box) {
      return selectEffect(selectionIdsInBox(state, cam, box, false), {
        // Explicit mobile marquee selection includes every friendly unit in the box,
        // including harvesters; desktop drag-selection keeps its existing filtering.
        endSelectionMode: true,
      });
    }
    return selectEffect(selectionForHit(state, cam, pickSelectableEntity(state, p.x, p.y, tx, ty, cam), doubleClick, viewport), {
      endSelectionMode: true,
    });
  }

  if (pointerType === "touch" && mobileCommand) {
    const target = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    const commands = selectedIds.length > 0 ? mobileCommandOrders(state, mobileCommand, selectedIds, target, tx, ty) : [];
    return {
      commands,
      clearMobileCommand: true,
      beep: beepForCommands(commands),
    };
  }

  if (button === 2) {
    if (repairMode || sellMode) {
      return { preventDefault: true, clearRepairAndSell: true, beep: "cancel" };
    }
    return {
      preventDefault: true,
      contextOrder: true,
      attackMove: ctrlKey || metaKey,
    };
  }

  if (placeKind) {
    return {
      clearBox: true,
      commands: [{ type: "build", building: placeKind, x: tx, y: ty }],
      clearPlace: true,
      beep: "build",
    };
  }

  if (repairMode) {
    const hit = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    if (hit && hit.owner === 0 && hit.class === "building") {
      return { clearBox: true, commands: [{ type: "repair", buildingId: hit.id }] };
    }
    return { clearBox: true };
  }

  if (sellMode) {
    const hit = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    if (hit && hit.owner === 0 && hit.class === "building") {
      return { clearBox: true, commands: [{ type: "sell", buildingId: hit.id }] };
    }
    return { clearBox: true };
  }

  const drag = box && selectionBoxDistance(box, cam) > DRAG_THRESHOLD;
  if (drag && box) {
    return selectEffect(selectionIdsInBox(state, cam, box, true));
  }

  const hit = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
  if (pointerType === "touch" && selectedIds.length > 0 && !hit) {
    const commands = contextOrders(state, selectedIds, undefined, tx, ty);
    return {
      clearBox: true,
      commands,
      beep: beepForCommands(commands),
    };
  }
  if (pointerType === "touch" && selectedIds.length > 0 && hit?.owner === 0) {
    const supportOrders = friendlySupportOrders(state, selectedIds, hit, tx, ty);
    if (supportOrders.length) {
      return { clearBox: true, commands: supportOrders, beep: beepForCommands(supportOrders) };
    }
    return selectEffect(selectionForHit(state, cam, hit, doubleClick, viewport));
  }
  if (pointerType === "touch" && selectedIds.length > 0 && hit?.owner === 1 && !hit.neutral) {
    const commands: Command[] = [{ type: "attack", unitIds: selectedIds, targetId: hit.id }];
    return {
      clearBox: true,
      commands,
      beep: beepForCommands(commands),
    };
  }
  return selectEffect(selectionForHit(state, cam, hit, doubleClick, viewport));
}
