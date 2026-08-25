import { useCallback, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { cachedLocalStorage, writeSave } from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import type { SimState } from "@/lib/types";
import { briefingPath, campaignCompletePath, campaignPath, menuPath, resultPrimaryPath } from "./missionRoutes";

export function useMissionRoutes({
  seed,
  stateRef,
}: {
  seed: number;
  stateRef: MutableRefObject<SimState>;
}) {
  const router = useRouter();

  const viewMissionBriefing = useCallback(() => {
    writeSave(cachedLocalStorage(), stateRef.current);
    router.push(briefingPath(stateRef.current.seed, stateRef.current.missionIndex, true));
  }, [router, stateRef]);

  const exitTutorial = useCallback(() => {
    const progress = readCampaignProgress(cachedLocalStorage(), seed);
    progress.tutorialComplete = true;
    writeCampaignProgress(cachedLocalStorage(), progress);
    router.push(briefingPath(seed, 0));
  }, [router, seed]);

  const resultPrimary = useCallback(() => {
    router.push(resultPrimaryPath(stateRef.current));
  }, [router, stateRef]);

  const goHomeNow = useCallback(() => router.push(menuPath()), [router]);
  const goNextBriefing = useCallback(() => {
    const world = stateRef.current;
    router.push(briefingPath(world.seed, world.missionIndex + 1));
  }, [router, stateRef]);
  const goCampaignVictory = useCallback(() => {
    router.push(campaignCompletePath(stateRef.current.seed));
  }, [router, stateRef]);
  const goCampaignMap = useCallback(() => {
    router.push(campaignPath(stateRef.current.seed));
  }, [router, stateRef]);
  const goRetry = useCallback(() => {
    const world = stateRef.current;
    router.push(briefingPath(world.seed, world.missionIndex));
  }, [router, stateRef]);

  return {
    router,
    viewMissionBriefing,
    exitTutorial,
    resultPrimary,
    goHomeNow,
    goNextBriefing,
    goCampaignVictory,
    goCampaignMap,
    goRetry,
  };
}
