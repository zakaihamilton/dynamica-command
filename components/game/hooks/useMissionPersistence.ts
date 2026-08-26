import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { beep } from "@/lib/audio/synth";
import {
  cachedLocalStorage,
  readSave,
  writeSave,
} from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { createMission } from "@/lib/sim/api";
import type { Command, SimState } from "@/lib/types";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { FxBurst } from "@/lib/render/fx";

export type MissionPersistenceParams = {
  seed: number;
  stateRef: MutableRefObject<SimState>;
  setState: Dispatch<SetStateAction<SimState>>;
  commitSelection: (ids: number[]) => void;
  cmdQRef: MutableRefObject<Command[]>;
  fxRef: MutableRefObject<FxBurst[]>;
  clearTools: () => void;
  resetInput: () => void;
  resetCamera: (state: SimState) => void;
  pausedRef: MutableRefObject<boolean>;
  setPaused: Dispatch<SetStateAction<boolean>>;
  setPauseView: Dispatch<SetStateAction<PauseView>>;
  setPauseNotice: Dispatch<SetStateAction<string>>;
  campaignRecordedRef: MutableRefObject<boolean>;
  terminalSaveRef: MutableRefObject<boolean>;
};

export function useMissionPersistence({
  seed,
  stateRef,
  setState,
  commitSelection,
  cmdQRef,
  fxRef,
  clearTools,
  resetInput,
  resetCamera,
  pausedRef,
  setPaused,
  setPauseView,
  setPauseNotice,
  campaignRecordedRef,
  terminalSaveRef,
}: MissionPersistenceParams) {
  const saveMissionNow = useCallback(() => {
    const saved = writeSave(cachedLocalStorage(), stateRef.current);
    setPauseNotice(saved ? "Mission saved." : "Unable to save: browser storage is unavailable.");
  }, [setPauseNotice, stateRef]);

  const loadMissionNow = useCallback(() => {
    const loaded = readSave(cachedLocalStorage(), seed);
    if (!loaded) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    stateRef.current = loaded;
    campaignRecordedRef.current = loaded.result === "won";
    terminalSaveRef.current = loaded.result !== "playing";
    setState({ ...loaded, entities: [...loaded.entities] });
    commitSelection([]);
    cmdQRef.current = [];
    fxRef.current = [];
    clearTools();
    resetInput();
    resetCamera(loaded);
    setPauseNotice(`Loaded mission at tick ${loaded.tick}.`);
  }, [
    campaignRecordedRef,
    clearTools,
    cmdQRef,
    commitSelection,
    fxRef,
    resetCamera,
    resetInput,
    seed,
    setPauseNotice,
    setState,
    stateRef,
    terminalSaveRef,
  ]);

  const restartMissionNow = useCallback(() => {
    const world = stateRef.current;
    const fresh = createMission({ seed: world.seed, missionIndex: world.missionIndex });
    stateRef.current = fresh;
    terminalSaveRef.current = false;
    campaignRecordedRef.current = false;
    setState({ ...fresh, entities: [...fresh.entities] });
    commitSelection([]);
    cmdQRef.current = [];
    fxRef.current = [];
    clearTools();
    resetInput();
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
    resetCamera(fresh);
    beep("select");
  }, [
    campaignRecordedRef,
    clearTools,
    cmdQRef,
    commitSelection,
    fxRef,
    pausedRef,
    resetCamera,
    resetInput,
    setPauseNotice,
    setPauseView,
    setPaused,
    setState,
    stateRef,
    terminalSaveRef,
  ]);

  const advanceTutorial = useCallback(() => {
    const stages: NonNullable<SimState["tutorialStage"]>[] = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"];
    const current = stateRef.current.tutorialStage ?? "select";
    const next = stages[Math.min(stages.length - 1, stages.indexOf(current) + 1)]!;
    stateRef.current.tutorialStage = next;
    setState({ ...stateRef.current, entities: [...stateRef.current.entities] });
    if (next === "complete") {
      const progress = readCampaignProgress(cachedLocalStorage(), seed);
      progress.tutorialComplete = true;
      writeCampaignProgress(cachedLocalStorage(), progress);
    }
  }, [seed, setState, stateRef]);

  return { saveMissionNow, loadMissionNow, restartMissionNow, advanceTutorial };
}
