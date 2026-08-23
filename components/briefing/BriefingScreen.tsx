"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { SoundtrackPanel } from "@/components/audio/SoundtrackPanel";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { biomeArt } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import type { BriefingLine } from "@/lib/types";
import { briefingCommandFromKey, isEditableTarget } from "@/lib/ui/shortcuts";
import { BriefingActions } from "./BriefingActions";
import { BriefingMast } from "./BriefingMast";
import { BriefingObjectives } from "./BriefingObjectives";
import { BriefingAllyPortraits, BriefingEnemyPortrait } from "./BriefingPortraits";
import { BriefingStory } from "./BriefingStory";
import styles from "./BriefingScreen.module.css";
import { useCampaignProgress } from "../campaign/useCampaignProgress";
import { useBriefingTypewriter } from "./useBriefingTypewriter";

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
  const [soundtrackOpen, setSoundtrackOpen] = useState(false);
  const def = campaign.missions[mission];
  const lines: BriefingLine[] = useMemo(() => def?.briefing ?? [], [def]);

  const {
    storyRef,
    visibleLines,
    revealedLines,
    isTalking,
    isComplete,
    replayTransmission,
    skipToEnd,
  } = useBriefingTypewriter(lines);

  const objectives = useMemo(
    () => (def ? missionObjectives(def, campaign) : []),
    [def, campaign],
  );

  const launch = useCallback(() => {
    router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`);
  }, [mission, returnToGame, router, seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = briefingCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        revealed: isComplete,
        returnToGame,
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "skip") {
        skipToEnd();
        return;
      }
      if (command.type === "replay") {
        replayTransmission();
        return;
      }
      launch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isComplete, launch, replayTransmission, returnToGame, skipToEnd]);

  if (!def) {
    return <div className={styles.missing}>Mission missing.</div>;
  }
  if (!returnToGame && mission > progress.unlockedMission) {
    return <div className={styles.missing}>Mission locked. Complete the previous operation first.</div>;
  }

  const liveRole = isTalking ? revealedLines.find((line) => line.started && !line.complete)?.speaker : undefined;

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
              storyRef={storyRef}
              campaign={campaign}
              lines={visibleLines}
              talking={isTalking}
              speakerRole={liveRole}
            />
          </section>
          <BriefingObjectives objectives={objectives} />
          <BriefingActions
            campaign={campaign}
            returnToGame={returnToGame}
            onReplay={replayTransmission}
            onLaunch={launch}
            onSoundtrack={() => setSoundtrackOpen(true)}
          />
        </MetalPanel>

        <BriefingEnemyPortrait campaign={campaign} liveRole={liveRole} />
      </div>
      {soundtrackOpen ? <SoundtrackPanel seed={seed} missionIndex={mission} onClose={() => setSoundtrackOpen(false)} /> : null}
    </div>
  );
}
