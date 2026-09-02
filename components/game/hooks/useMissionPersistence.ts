import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { beep } from "@/lib/audio/synth";
import {
  cachedLocalStorage,
  readSave,
  saveExportFilename,
  serializeSaveExport,
} from "@/lib/persist/save";
import type { SaveSession } from "@/lib/persist/save";
import { readCampaignProgress } from "@/lib/persist/campaign";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission, enterTutorialStage } from "@/lib/sim/tutorial";
import type { Command, SimState } from "@/lib/types";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { FxBurst } from "@/lib/render/fx";
import { downloadSaveExport } from "@/lib/persist/saveDownload";

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
  saveSession: SaveSession;
  tutorial?: boolean;
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
  saveSession,
  tutorial = false,
}: MissionPersistenceParams) {
  const saveMissionNow = useCallback(() => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    const status = saveSession.write(stateRef.current, "explicit");
    setPauseNotice(status === "saved" ? "Mission saved." : "Couldn't save. Check that this browser allows site data.");
  }, [saveSession, setPauseNotice, stateRef, tutorial]);

  const exportMissionNow = useCallback(() => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    try {
      const current = stateRef.current;
      const campaign = readCampaignProgress(cachedLocalStorage(), seed);
      const contents = serializeSaveExport(current, campaign);
      downloadSaveExport(contents, saveExportFilename(seed));
      setPauseNotice("Save downloaded.");
    } catch {
      setPauseNotice("Couldn't download a backup of this campaign.");
    }
  }, [seed, setPauseNotice, stateRef, tutorial]);

  const loadMissionNow = useCallback(() => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    const loaded = readSave(cachedLocalStorage(), seed);
    if (!loaded) {
      setPauseNotice("No save found for this campaign.");
      return;
    }
    stateRef.current = loaded;
    saveSession.adoptCurrent();
    campaignRecordedRef.current = loaded.result === "won";
    terminalSaveRef.current = loaded.result !== "playing";
    setState({ ...loaded, entities: [...loaded.entities] });
    commitSelection([]);
    cmdQRef.current = [];
    fxRef.current = [];
    clearTools();
    resetInput();
    resetCamera(loaded);
    setPauseNotice("Loaded the last save.");
  }, [
    campaignRecordedRef,
    clearTools,
    cmdQRef,
    commitSelection,
    fxRef,
    resetCamera,
    resetInput,
    seed,
    saveSession,
    setPauseNotice,
    setState,
    stateRef,
    terminalSaveRef,
    tutorial,
  ]);

  const restartMissionNow = useCallback(() => {
    const world = stateRef.current;
    const fresh = tutorial ? createTutorialMission() : createMission({ seed: world.seed, missionIndex: world.missionIndex });
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
    tutorial,
  ]);

  const advanceTutorial = useCallback(() => {
    const stages: NonNullable<SimState["tutorialStage"]>[] = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"];
    const current = stateRef.current.tutorialStage ?? "select";
    const next = stages[Math.min(stages.length - 1, stages.indexOf(current) + 1)]!;
    enterTutorialStage(stateRef.current, next);
    setState({ ...stateRef.current, entities: [...stateRef.current.entities] });
  }, [setState, stateRef]);

  return { saveMissionNow, exportMissionNow, loadMissionNow, restartMissionNow, advanceTutorial };
}
