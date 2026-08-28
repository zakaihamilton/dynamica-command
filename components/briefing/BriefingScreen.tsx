"use client";

import { useMemo, type CSSProperties } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { biomeArt } from "@/lib/gen/visualAssets";
import type { BriefingLine } from "@/lib/types";
import { BriefingActions } from "./BriefingActions";
import { BriefingMast } from "./BriefingMast";
import { BriefingObjectives } from "./BriefingObjectives";
import { BriefingAllyPortraits, BriefingEnemyPortrait } from "./BriefingPortraits";
import { BriefingStory } from "./BriefingStory";
import styles from "./BriefingScreen.module.css";
import { useCampaignProgress } from "../campaign/useCampaignProgress";
import { useBriefingController } from "./useBriefingController";
import { useBriefingTypewriter } from "./useBriefingTypewriter";
import type { NavigationOrigin } from "../game/hooks/missionRoutes";

export function BriefingScreen({ seed, mission, returnToGame = false, origin = "menu" }: { seed: number; mission: number; returnToGame?: boolean; origin?: NavigationOrigin }) {
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
  const def = campaign.missions[mission];
  const lines: BriefingLine[] = useMemo(() => def?.briefing ?? [], [def]);
  const typewriter = useBriefingTypewriter(lines);
  const controller = useBriefingController({
    seed,
    mission,
    returnToGame,
    origin,
    isComplete: typewriter.isComplete,
    replayTransmission: typewriter.replayTransmission,
    skipToEnd: typewriter.skipToEnd,
  });
  const objectives = useMemo(
    () => (def ? missionObjectives(def, campaign) : []),
    [def, campaign],
  );
  const backLabel = returnToGame ? "Back to mission" : origin === "campaign" ? "Back to operations" : origin === "result" ? "Back to result" : "Back to menu";

  if (!def) {
    return (
      <div className={styles.missing}>
        <p>Mission missing.</p>
        <ConsoleButton muted onClick={controller.back}>{backLabel}</ConsoleButton>
      </div>
    );
  }
  if (!returnToGame && mission > progress.unlockedMission) {
    return (
      <div className={styles.missing}>
        <p>Mission locked. Complete the previous operation first.</p>
        <ConsoleButton muted onClick={controller.back}>{backLabel}</ConsoleButton>
      </div>
    );
  }

  const liveRole = typewriter.isTalking ? typewriter.revealedLines.find((line) => line.started && !line.complete)?.speaker : undefined;

  return (
    <div
      className={styles.screen}
      data-testid="briefing-screen"
      style={{ "--scene-art": `url("${biomeArt(def.biome)}")` } as CSSProperties}
    >
      <div className={styles.inner}>
        <div className={styles.mast}>
          <BriefingMast seed={seed} mission={mission} campaign={campaign} def={def} />
        </div>

        <BriefingAllyPortraits campaign={campaign} liveRole={liveRole} />

        <MetalPanel className={styles.panel}>
          <section className={styles.comms}>
            <ConsoleLabel>Incoming transmission</ConsoleLabel>
            <BriefingStory
              storyRef={typewriter.storyRef}
              campaign={campaign}
              lines={typewriter.visibleLines}
              talking={typewriter.isTalking}
              speakerRole={liveRole}
            />
          </section>
          <BriefingObjectives objectives={objectives} />
          <BriefingActions
            campaign={campaign}
            returnToGame={returnToGame}
            onReplay={typewriter.replayTransmission}
            onLaunch={controller.launch}
            onBack={controller.back}
            backLabel={backLabel}
          />
        </MetalPanel>

        <BriefingEnemyPortrait campaign={campaign} liveRole={liveRole} />
      </div>
    </div>
  );
}
