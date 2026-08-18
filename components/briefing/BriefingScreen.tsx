"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { biomeArt } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import { localStorageAdapter } from "@/lib/persist/save";
import { freshCampaignProgress, readCampaignProgress } from "@/lib/persist/campaign";
import type { BriefingLine } from "@/lib/types";
import { briefingCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import { BriefingMast } from "./BriefingMast";
import { BriefingObjectives } from "./BriefingObjectives";
import { BriefingStory } from "./BriefingStory";
import { Portrait } from "./Portrait";
import styles from "./BriefingScreen.module.css";

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useMemo(() => typeof window === "undefined" ? freshCampaignProgress(seed) : readCampaignProgress(localStorageAdapter(), seed), [seed]);
  const def = campaign.missions[mission];
  const [shown, setShown] = useState(0);
  const [playId, setPlayId] = useState(0);
  const storyRef = useRef<HTMLDivElement>(null);
  const lines: BriefingLine[] = def?.briefing ?? [];
  const totalChars = lines.reduce((n, line) => n + line.text.length, 0);
  const objectives = useMemo(
    () => (def ? missionObjectives(def, campaign) : []),
    [def, campaign],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= totalChars) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 40);
    return () => clearInterval(id);
  }, [totalChars, playId]);

  useLayoutEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = briefingCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        revealed: shown >= totalChars,
        returnToGame,
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "skip") {
        setShown(totalChars);
        return;
      }
      if (command.type === "replay") {
        setShown(0);
        setPlayId((n) => n + 1);
        return;
      }
      router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, totalChars, router, seed, mission, returnToGame]);

  if (!def) {
    return <div className={styles.missing}>Mission missing.</div>;
  }
  if (!returnToGame && mission > progress.unlockedMission) {
    return <div className={styles.missing}>Mission locked. Complete the previous operation first.</div>;
  }

  const talking = shown > 0 && shown < totalChars;
  const revealedLines = lines.map((line, index) => {
    const consumed = lines.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
    const chars = Math.max(0, Math.min(line.text.length, shown - consumed));
    return {
      ...line,
      visible: line.text.slice(0, chars),
      started: chars > 0,
      complete: chars >= line.text.length,
    };
  });
  const visibleLines = revealedLines.filter((line) => line.started);
  // Only the line currently being typed is "live" — never fall back to another
  // speaker, or the wrong portrait can flash for a frame between lines.
  const liveRole = talking ? revealedLines.find((line) => line.started && !line.complete)?.speaker : undefined;

  return (
    <div
      className={styles.screen}
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
              talking={talking}
              speakerRole={liveRole}
            />
          </section>
          <BriefingObjectives objectives={objectives} />
          <div className={styles.actions}>
            <ConsoleButton
              tooltip="Replay the incoming transmission"
              shortcut={SHORTCUT.replay}
              onClick={() => setPlayId((n) => n + 1)}
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
