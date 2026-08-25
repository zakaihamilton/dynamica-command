import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { cachedLocalStorage, readSave } from "@/lib/persist/save";
import {
  missionConfirmationFor,
  type MissionConfirmation,
  type MissionConfirmationAction,
} from "./missionConfirmation";

export function useMissionConfirmation({
  seed,
  setPauseNotice,
  saveNow,
  loadNow,
  restartNow,
  goHomeNow,
}: {
  seed: number;
  setPauseNotice: Dispatch<SetStateAction<string>>;
  saveNow: () => void;
  loadNow: () => void;
  restartNow: () => void;
  goHomeNow: () => void;
}) {
  const [confirmation, setConfirmation] = useState<MissionConfirmation | null>(null);

  const requestConfirmation = useCallback((action: MissionConfirmationAction) => {
    setConfirmation(missionConfirmationFor(action));
  }, []);

  const saveMission = useCallback(() => {
    requestConfirmation("save");
  }, [requestConfirmation]);

  const loadMission = useCallback(() => {
    if (!readSave(cachedLocalStorage(), seed)) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    requestConfirmation("load");
  }, [requestConfirmation, seed, setPauseNotice]);

  const restartMission = useCallback(() => {
    requestConfirmation("restart");
  }, [requestConfirmation]);

  const goHome = useCallback(() => {
    requestConfirmation("menu");
  }, [requestConfirmation]);

  const confirmAction = useCallback(() => {
    const action = confirmation?.action;
    setConfirmation(null);
    if (action === "save") saveNow();
    else if (action === "load") loadNow();
    else if (action === "restart") restartNow();
    else if (action === "menu") goHomeNow();
  }, [confirmation, goHomeNow, loadNow, restartNow, saveNow]);

  const cancelConfirmation = useCallback(() => {
    setConfirmation(null);
  }, []);

  return {
    confirmation,
    confirmAction,
    cancelConfirmation,
    saveMission,
    loadMission,
    restartMission,
    goHome,
  };
}
