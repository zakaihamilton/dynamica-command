"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { formatSeed } from "@/lib/seed/rng";
import type { BriefingLine, CharacterRole } from "@/lib/types";
import { briefingCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import { BriefingMast } from "./BriefingMast";
import { BriefingObjectives } from "./BriefingObjectives";
import { BriefingStory, characterFor } from "./BriefingStory";
import { Portrait } from "./Portrait";
import styles from "./BriefingScreen.module.css";

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const def = campaign.missions[mission];
  const [shown, setShown] = useState(0);
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
  }, [totalChars]);

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
      router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, totalChars, router, seed, mission, returnToGame]);

  if (!def) {
    return <div className={styles.missing}>Mission missing.</div>;
  }

  const talking = shown < totalChars;
  let remaining = shown;
  const revealedLines = lines.map((line) => {
    const chars = Math.max(0, Math.min(line.text.length, remaining));
    remaining -= chars;
    return {
      ...line,
      visible: line.text.slice(0, chars),
      started: chars > 0,
      complete: chars >= line.text.length,
    };
  });
  const visibleLines = revealedLines.filter((line) => line.started);
  const active = revealedLines.find((line) => line.started && !line.complete) ?? revealedLines.at(-1);
  const speaker = active ? characterFor(campaign, active.speaker) : campaign.characters.advisor;
  const revealed = shown >= totalChars;

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <BriefingMast seed={seed} mission={mission} campaign={campaign} def={def} />

        <div className={styles.layout}>
          <div className={styles.portraits}>
            <Portrait
              who={campaign.characters.advisor}
              talking={speaker.role === "advisor" && talking}
              tone="ally"
              faction={campaign.factions[0].name}
            />
            <Portrait
              who={campaign.characters.commander}
              talking={speaker.role === "commander" && talking}
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
                speakerRole={speaker.role as CharacterRole}
              />
            </section>
            <BriefingObjectives objectives={objectives} revealed={revealed} />
            <div className={styles.actions}>
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
              talking={speaker.role === "enemyLeader" && talking}
              tone="enemy"
              faction={campaign.factions[1].name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
