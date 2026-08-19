"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { biomeArt } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import type { BriefingLine } from "@/lib/types";
import { briefingCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import { BriefingMast } from "./BriefingMast";
import { BriefingObjectives } from "./BriefingObjectives";
import { BriefingStory } from "./BriefingStory";
import { Portrait } from "./Portrait";
import styles from "./BriefingScreen.module.css";
import { useCampaignProgress } from "../campaign/useCampaignProgress";
import { useBriefingTypewriter } from "./useBriefingTypewriter";

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
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
      router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isComplete, router, seed, mission, replayTransmission, returnToGame, skipToEnd]);

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
      style={{ "--scene-art": `url("${biomeArt(campaign.world.biome)}")` } as CSSProperties}
    >
      <div className={styles.inner}>
        <div className={styles.mast}>
          <BriefingMast seed={seed} mission={mission} campaign={campaign} def={def} />
        </div>

        <div className={styles.portraits}>
          <Portrait
            who={campaign.characters.advisor}
            talking={liveRole === "advisor"}
            tone="ally"
            faction={campaign.factions[0].name}
          />
          <Portrait
            who={campaign.characters.commander}
            talking={liveRole === "commander"}
            tone="command"
            faction={campaign.factions[0].name}
          />
        </div>

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
          <div className={styles.actions}>
            <ConsoleButton
              tooltip="Replay the incoming transmission"
              shortcut={SHORTCUT.replay}
              onClick={replayTransmission}
            >
              Replay
            </ConsoleButton>
            <ConsoleButton
              tooltip={returnToGame ? "Return to the battlefield" : "Launch this mission"}
              shortcut={returnToGame ? SHORTCUT.resume : SHORTCUT.launch}
              onClick={() => router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`)}
            >
              {returnToGame ? "Return to mission" : "Launch"}
            </ConsoleButton>
            <p className={styles.tone}>
              {campaign.world.tone} · {campaign.world.conflict}
            </p>
          </div>
        </MetalPanel>

        <div className={styles.enemy}>
          <Portrait
            who={campaign.characters.enemyLeader}
            talking={liveRole === "enemyLeader"}
            tone="enemy"
            faction={campaign.factions[1].name}
          />
        </div>
      </div>
    </div>
  );
}
