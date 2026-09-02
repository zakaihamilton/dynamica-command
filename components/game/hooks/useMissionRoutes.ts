import { useCallback, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import type { SaveSession } from "@/lib/persist/save";
import type { SimState } from "@/lib/types";
import {
  briefingPath,
  campaignCompletePath,
  campaignPath,
  menuPath,
  resultPrimaryPath,
  tutorialPath,
} from "./missionRoutes";

export function useMissionRoutes({
  stateRef,
  saveSession,
  tutorial = false,
}: {
  stateRef: MutableRefObject<SimState>;
  saveSession: SaveSession;
  tutorial?: boolean;
}) {
  const router = useRouter();

  const viewMissionBriefing = useCallback(() => {
    if (!tutorial) saveSession.write(stateRef.current, "implicit");
    router.push(briefingPath(stateRef.current.seed, stateRef.current.missionIndex, true, "result"));
  }, [router, saveSession, stateRef, tutorial]);

  const exitTutorial = useCallback(() => {
    router.push(menuPath());
  }, [router]);

  const backTutorial = useCallback(() => {
    router.push(menuPath());
  }, [router]);

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
    if (tutorial) {
      router.push(tutorialPath());
      return;
    }
    const world = stateRef.current;
    router.push(briefingPath(world.seed, world.missionIndex, false, "result"));
  }, [router, stateRef, tutorial]);

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
