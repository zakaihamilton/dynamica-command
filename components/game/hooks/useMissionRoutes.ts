import { useCallback, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { cachedLocalStorage, type SaveSession } from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import type { SimState } from "@/lib/types";
import {
  briefingPath,
  campaignCompletePath,
  campaignPath,
  menuPath,
  resultPrimaryPath,
  type NavigationOrigin,
} from "./missionRoutes";

export function useMissionRoutes({
  seed,
  stateRef,
  saveSession,
  tutorialOrigin = "menu",
}: {
  seed: number;
  stateRef: MutableRefObject<SimState>;
  saveSession: SaveSession;
  tutorialOrigin?: NavigationOrigin;
}) {
  const router = useRouter();

  const viewMissionBriefing = useCallback(() => {
    saveSession.write(stateRef.current, "implicit");
    router.push(briefingPath(stateRef.current.seed, stateRef.current.missionIndex, true, "result"));
  }, [router, saveSession, stateRef]);

  const exitTutorial = useCallback(() => {
    const progress = readCampaignProgress(cachedLocalStorage(), seed);
    progress.tutorialComplete = true;
    writeCampaignProgress(cachedLocalStorage(), progress);
    router.push(briefingPath(seed, 0, false, tutorialOrigin));
  }, [router, seed, tutorialOrigin]);

  const backTutorial = useCallback(() => {
    if (tutorialOrigin === "campaign") {
      router.push(campaignPath(seed));
      return;
    }
    router.push(menuPath());
  }, [router, seed, tutorialOrigin]);

  const resultPrimary = useCallback(() => {
    router.push(resultPrimaryPath(stateRef.current));
  }, [router, stateRef]);

  const goHomeNow = useCallback(() => router.push(menuPath()), [router]);
  const goNextBriefing = useCallback(() => {
    const world = stateRef.current;
    router.push(briefingPath(world.seed, world.missionIndex + 1, false, "result"));
  }, [router, stateRef]);
  const goCampaignVictory = useCallback(() => {
    router.push(campaignCompletePath(stateRef.current.seed));
  }, [router, stateRef]);
  const goCampaignMap = useCallback(() => {
    router.push(campaignPath(stateRef.current.seed));
  }, [router, stateRef]);
  const goRetry = useCallback(() => {
    const world = stateRef.current;
    router.push(briefingPath(world.seed, world.missionIndex, false, "result"));
  }, [router, stateRef]);

  return {
    router,
    viewMissionBriefing,
    exitTutorial,
    backTutorial,
    resultPrimary,
    goHomeNow,
    goNextBriefing,
    goCampaignVictory,
    goCampaignMap,
    goRetry,
  };
}
