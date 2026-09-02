import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { beep } from "@/lib/audio/synth";
import {
  cachedLocalStorage,
  defaultSlotName,
  hasLoadableSaves,
  listPauseLoadEntries,
  listSlots,
  readSave,
  readSlot,
  writeSave,
  writeSlot,
  type ArchiveEntry,
} from "@/lib/persist/save";
import type { SaveSession } from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission, enterTutorialStage } from "@/lib/sim/tutorial";
import { formatSeed } from "@/lib/seed/rng";
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
  const router = useRouter();

  const applyLoadedState = useCallback((loaded: SimState, notice: string) => {
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
    setPauseView("main");
    setPauseNotice(notice);
  }, [
    campaignRecordedRef,
    clearTools,
    cmdQRef,
    commitSelection,
    fxRef,
    resetCamera,
    resetInput,
    saveSession,
    setPauseNotice,
    setPauseView,
    setState,
    stateRef,
    terminalSaveRef,
  ]);

  const openSaveSlots = useCallback(() => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    setPauseNotice("");
    setPauseView("save");
  }, [setPauseNotice, setPauseView, tutorial]);

  const openLoadSlots = useCallback(() => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    if (!hasLoadableSaves(cachedLocalStorage(), seed)) {
      setPauseNotice("No save slots.");
      return;
    }
    setPauseNotice("");
    setPauseView("load");
  }, [seed, setPauseNotice, setPauseView, tutorial]);

  const saveNamedSlot = useCallback((name: string, overwriteId: string | null) => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return false;
    }
    const current = stateRef.current;
    const storage = cachedLocalStorage();
    const written = writeSlot(storage, {
      id: overwriteId ?? undefined,
      name,
      state: current,
      campaign: readCampaignProgress(storage, current.seed),
    });
    if (!written.ok) {
      setPauseNotice("Couldn't save. Check that this browser allows site data.");
      return false;
    }
    const status = saveSession.write(current, "explicit");
    if (status !== "saved") {
      setPauseNotice("Couldn't save. Check that this browser allows site data.");
      return false;
    }
    const slot = readSlot(storage, written.id);
    setPauseView("main");
    setPauseNotice(`Saved “${slot?.name ?? name}”.`);
    return true;
  }, [saveSession, setPauseNotice, setPauseView, stateRef, tutorial]);

  const loadArchiveEntry = useCallback((entry: ArchiveEntry) => {
    if (tutorial) {
      setPauseNotice("Training isn't saved to a campaign.");
      return;
    }
    const storage = cachedLocalStorage();
    if (entry.kind === "autosave") {
      const loaded = readSave(storage, Number(entry.seed));
      if (!loaded) {
        setPauseNotice("No save found for this campaign.");
        return;
      }
      if (loaded.seed === seed && loaded.missionIndex === stateRef.current.missionIndex) {
        applyLoadedState(loaded, "Loaded the autosave.");
        return;
      }
      router.push(`/play?seed=${formatSeed(loaded.seed)}&mission=${loaded.missionIndex}&resume=1`);
      return;
    }

    const slot = readSlot(storage, entry.id);
    if (!slot) {
      setPauseNotice("Couldn't load that save slot.");
      return;
    }
    writeCampaignProgress(storage, slot.campaign);
    if (slot.state.seed === seed && slot.state.missionIndex === stateRef.current.missionIndex) {
      const autosave = saveSession.write(slot.state, "explicit");
      if (autosave !== "saved") writeSave(storage, slot.state);
      applyLoadedState(slot.state, `Loaded “${slot.name}”.`);
      return;
    }
    writeSave(storage, slot.state);
    router.push(`/play?seed=${formatSeed(slot.state.seed)}&mission=${slot.state.missionIndex}&slot=${slot.id}`);
  }, [applyLoadedState, router, saveSession, seed, setPauseNotice, stateRef, tutorial]);

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

  return {
    openSaveSlots,
    openLoadSlots,
    saveNamedSlot,
    loadArchiveEntry,
    defaultSlotName: () => defaultSlotName(stateRef.current),
    listSaveSlots: () => listSlots(cachedLocalStorage()),
    listLoadEntries: () => listPauseLoadEntries(cachedLocalStorage(), seed),
    restartMissionNow,
    advanceTutorial,
  };
}
