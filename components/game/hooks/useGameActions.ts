import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { MAX_PRODUCTION_QUEUE, buildingCameoStatus, producerFor, productionQueueSize, unitCameoStatus } from "@/lib/catalog";
import { beep } from "@/lib/audio/synth";
import type { BuildingKind, Command, Formation, SimState, Stance, UnitKind } from "@/lib/types";
import type { MobileCommand } from "../MobileCommandTray";

export const PLACEABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];
export const PRODUCIBLE: UnitKind[] = ["infantry", "antiArmor", "harvester", "tank"];

export function useGameActions({
  stateRef,
  cmdQ,
  selected,
}: {
  stateRef: MutableRefObject<SimState>;
  cmdQ: MutableRefObject<Command[]>;
  selected: MutableRefObject<Set<number>>;
}) {
  const place = useRef<BuildingKind | null>(null);
  const [placeKind, setPlaceKind] = useState<BuildingKind | null>(null);
  const repair = useRef(false);
  const [repairMode, setRepairMode] = useState(false);
  const sell = useRef(false);
  const [sellMode, setSellMode] = useState(false);
  const mobileCommand = useRef<MobileCommand | null>(null);
  const [mobileCommandState, setMobileCommandState] = useState<MobileCommand | null>(null);

  const clearTools = useCallback(() => {
    place.current = null;
    setPlaceKind(null);
    repair.current = false;
    setRepairMode(false);
    sell.current = false;
    setSellMode(false);
  }, []);

  const chooseMobileCommand = useCallback((command: MobileCommand) => {
    clearTools();
    mobileCommand.current = command;
    setMobileCommandState(command);
    beep("select");
  }, [clearTools]);

  const cancelMobileCommand = useCallback(() => {
    mobileCommand.current = null;
    setMobileCommandState(null);
    clearTools();
    beep("select");
  }, [clearTools]);

  const issueSelectedCommand = useCallback((command: "stop" | "stance" | "formation", value?: Stance | Formation) => {
    const unitIds = [...selected.current];
    if (unitIds.length === 0) return;
    if (command === "stop") cmdQ.current.push({ type: "stop", unitIds });
    else if (command === "stance" && value) cmdQ.current.push({ type: "stance", unitIds, stance: value as Stance });
    else if (command === "formation" && value) cmdQ.current.push({ type: "formation", unitIds, formation: value as Formation });
    mobileCommand.current = null;
    setMobileCommandState(null);
    beep("ack");
  }, [cmdQ, selected]);

  const togglePlace = useCallback((kind: BuildingKind) => {
    const next = place.current === kind ? null : kind;
    place.current = next;
    setPlaceKind(next);
    if (next) {
      repair.current = false;
      setRepairMode(false);
      sell.current = false;
      setSellMode(false);
    }
  }, []);

  const toggleRepair = useCallback(() => {
    const next = !repair.current;
    repair.current = next;
    setRepairMode(next);
    if (next) {
      place.current = null;
      setPlaceKind(null);
      sell.current = false;
      setSellMode(false);
    }
  }, []);

  const toggleSell = useCallback(() => {
    const next = !sell.current;
    sell.current = next;
    setSellMode(next);
    if (next) {
      place.current = null;
      setPlaceKind(null);
      repair.current = false;
      setRepairMode(false);
    }
  }, []);

  const cancelBuilding = useCallback((kind: BuildingKind) => {
    if (place.current === kind) {
      place.current = null;
      setPlaceKind(null);
      beep("select");
      return;
    }
    if (buildingCameoStatus(stateRef.current.entities, 0, kind).phase === "idle") return;
    cmdQ.current.push({ type: "cancelBuild", building: kind });
    beep("select");
  }, [cmdQ, stateRef]);

  const availableProducer = useCallback((unit: UnitKind) => {
    const world = stateRef.current;
    const kind = producerFor(unit);
    let best: typeof world.entities[number] | undefined;
    let bestN = Infinity;
    for (const e of world.entities) {
      if (e.hp <= 0 || e.owner !== 0 || e.class !== "building" || e.kind !== kind || e.constructing > 0) continue;
      const n = productionQueueSize(e);
      if (n >= MAX_PRODUCTION_QUEUE) continue;
      if (n < bestN) {
        best = e;
        bestN = n;
      }
    }
    return best;
  }, [stateRef]);

  const queueUnit = useCallback((unit: UnitKind) => {
    const next = availableProducer(unit);
    if (!next) return;
    cmdQ.current.push({ type: "produce", fromId: next.id, unit });
    beep("build");
  }, [availableProducer, cmdQ]);

  const cancelUnit = useCallback((unit: UnitKind) => {
    if (unitCameoStatus(stateRef.current.entities, 0, unit).phase === "idle") return;
    cmdQ.current.push({ type: "cancelProduce", unit });
    beep("select");
  }, [cmdQ, stateRef]);

  const activateCameo = useCallback((tab: "construction" | "production", index: number, cancel: boolean) => {
    if (tab === "construction") {
      const kind = PLACEABLE[index];
      if (!kind) return;
      if (cancel) cancelBuilding(kind);
      else togglePlace(kind);
      return;
    }
    const unit = PRODUCIBLE[index];
    if (!unit) return;
    if (cancel) cancelUnit(unit);
    else queueUnit(unit);
  }, [cancelBuilding, cancelUnit, queueUnit, togglePlace]);

  return {
    place,
    placeRef: place,
    placeKind,
    setPlaceKind,
    repair,
    repairRef: repair,
    repairMode,
    setRepairMode,
    sell,
    sellRef: sell,
    sellMode,
    setSellMode,
    mobileCommand,
    mobileCommandRef: mobileCommand,
    mobileCommandState,
    setMobileCommandState,
    clearTools,
    chooseMobileCommand,
    cancelMobileCommand,
    issueSelectedCommand,
    togglePlace,
    toggleRepair,
    toggleSell,
    cancelBuilding,
    availableProducer,
    queueUnit,
    cancelUnit,
    activateCameo,
  };
}

export type GameActions = ReturnType<typeof useGameActions>;
