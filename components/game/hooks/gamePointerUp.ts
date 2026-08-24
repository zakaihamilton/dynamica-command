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
} from "./gameInputOrders";

export type PointerUpInput = {
  pointerType: string;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  p: { x: number; y: number };
  state: SimState;
  cam: Camera;
  selectedIds: number[];
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  selectionMode: boolean;
  mobileCommand: MobileCommand | null;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
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
  beep?: "select" | "ack" | "build";
};

const DRAG_THRESHOLD = 8;

function selectableIds(state: SimState, hit: SimState["entities"][number] | undefined): number[] {
  return hit && hit.owner === 0 && (!hit.neutral || isContactTarget(state, hit)) ? [hit.id] : [];
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
  } = input;
  const { x: tx, y: ty } = pointerTile(state, p, cam);

  if (pointerType === "touch" && selectionMode) {
    const drag = box && Math.hypot(box.x1 - box.x0, box.y1 - box.y0) > DRAG_THRESHOLD;
    if (drag && box) {
      return {
        clearBox: true,
        select: selectionIdsInBox(state, cam, box, false),
        endSelectionMode: true,
        beep: "select",
      };
    }
    return {
      clearBox: true,
      select: selectableIds(state, pickSelectableEntity(state, p.x, p.y, tx, ty, cam)),
      endSelectionMode: true,
      beep: "select",
    };
  }

  if (pointerType === "touch" && mobileCommand) {
    const target = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    return {
      commands: selectedIds.length > 0 ? mobileCommandOrders(state, mobileCommand, selectedIds, target, tx, ty) : [],
      clearMobileCommand: true,
      beep: "ack",
    };
  }

  if (button === 2) {
    if (repairMode || sellMode) {
      return { preventDefault: true, clearRepairAndSell: true, beep: "select" };
    }
    const target = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    return {
      preventDefault: true,
      commands: contextOrders(state, selectedIds, target, tx, ty, ctrlKey || metaKey),
      clearMobileCommand: true,
      beep: "ack",
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
      return { clearBox: true, commands: [{ type: "repair", buildingId: hit.id }], beep: "build" };
    }
    return { clearBox: true };
  }

  if (sellMode) {
    const hit = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
    if (hit && hit.owner === 0 && hit.class === "building") {
      return { clearBox: true, commands: [{ type: "sell", buildingId: hit.id }], beep: "build" };
    }
    return { clearBox: true };
  }

  const drag = box && Math.hypot(box.x1 - box.x0, box.y1 - box.y0) > DRAG_THRESHOLD;
  if (drag && box) {
    return { clearBox: true, select: selectionIdsInBox(state, cam, box, true) };
  }

  const hit = pickSelectableEntity(state, p.x, p.y, tx, ty, cam);
  if (pointerType === "touch" && selectedIds.length > 0 && !hit) {
    return {
      clearBox: true,
      commands: contextOrders(state, selectedIds, undefined, tx, ty),
      beep: "ack",
    };
  }
  if (pointerType === "touch" && selectedIds.length > 0 && hit?.owner === 0) {
    const supportOrders = friendlySupportOrders(state, selectedIds, hit, tx, ty);
    if (supportOrders.length) {
      return { clearBox: true, commands: supportOrders, beep: "ack" };
    }
    return { clearBox: true, select: [hit.id], beep: "select" };
  }
  if (pointerType === "touch" && selectedIds.length > 0 && hit?.owner === 1 && !hit.neutral) {
    return {
      clearBox: true,
      commands: [{ type: "attack", unitIds: selectedIds, targetId: hit.id }],
      beep: "ack",
    };
  }
  return { clearBox: true, select: selectableIds(state, hit), beep: "select" };
}
