"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import type { UpgradeId } from "@/lib/types";
import styles from "./CampaignCompleteScreen.module.css";
import { useCampaignProgress } from "./useCampaignProgress";

const UPGRADE_LABELS: Record<UpgradeId, string> = {
  "logistics-cargo": "Expanded Cargo",
  "logistics-drills": "Deep Drills",
  "logistics-unload": "Rapid Unload",
  "logistics-cache": "Forward Cache",
  "arsenal-barrels": "Improved Barrels",
  "arsenal-plating": "Combat Plating",
  "arsenal-targeting": "Targeting Optics",
  "arsenal-shock": "Shock Discipline",
  "engineering-frames": "Rapid Frames",
  "engineering-grid": "Stable Grid",
  "engineering-repair": "Efficient Repair",
  "engineering-fabrication": "Lean Fabrication",
};

export function CampaignCompleteScreen({ seed }: { seed: number }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
  const completed = progress.completedMissions.length;
  const totalMedals = campaign.missions.reduce((sum, mission) => sum + (progress.medals[String(mission.index)] ?? 0), 0);
  const possibleMedals = campaign.missions.length * 3;
  const isComplete = completed >= campaign.missions.length;

  return (
    <main
      className={styles.screen}
      style={{ "--scene-art": `url("${RASTER_ART.victory}")` } as React.CSSProperties}
    >
      <div className={styles.vignette} />
      <div className={styles.content}>
        <MetalPanel className={styles.panel}>
          <header className={styles.header}>
            <ConsoleLabel>Strategic command record</ConsoleLabel>
            <h1 className={styles.title}>{isComplete ? "Campaign complete" : "Campaign record"}</h1>
            <p className={styles.subtitle}>{isComplete ? "THEATER SECURED" : "PROGRESS ARCHIVED"}</p>
            <p className={styles.meta}>Seed {formatSeed(seed)} · {campaign.world.name} · {campaign.factions[0].name}</p>
          </header>

          <section className={styles.summary} aria-label="Campaign summary">
            <div><span>Missions</span><strong>{completed} / {campaign.missions.length}</strong></div>
            <div><span>Medals</span><strong>{totalMedals} / {possibleMedals}</strong></div>
            <div><span>Research points</span><strong>{progress.researchPoints}</strong></div>
            <div><span>Upgrades</span><strong>{progress.upgrades.length} / 12</strong></div>
          </section>

          <section className={styles.section} aria-labelledby="mission-record-title">
            <ConsoleLabel as="h2">Mission record</ConsoleLabel>
            <h2 id="mission-record-title" className={styles.sectionTitle}>Eight operations</h2>
            <div className={styles.missions}>
              {campaign.missions.map((mission, index) => {
                const medals = progress.medals[String(mission.index)] ?? 0;
                const missionComplete = progress.completedMissions.includes(mission.index);
                return (
                  <article key={mission.index} className={`${styles.mission} ${missionComplete ? styles.complete : styles.locked}`}>
                    <div className={styles.missionTopline}>
                      <span>Mission {index + 1}</span>
                      <span className={styles.medals} aria-label={`${medals} of 3 medals`}>{"★".repeat(medals)}{"☆".repeat(3 - medals)}</span>
                    </div>
                    <h3>{mission.name}</h3>
                    <p>{missionComplete ? `Best score ${progress.bestScores[String(mission.index)] ?? 0}` : "Not completed"}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="upgrade-record-title">
            <ConsoleLabel as="h2">Research division</ConsoleLabel>
            <h2 id="upgrade-record-title" className={styles.sectionTitle}>Installed upgrades</h2>
            {progress.upgrades.length > 0 ? (
              <ul className={styles.upgrades}>
                {progress.upgrades.map((id) => <li key={id}>{UPGRADE_LABELS[id]}</li>)}
              </ul>
            ) : <p className={styles.empty}>No upgrades installed.</p>}
          </section>

          <div className={styles.actions}>
            <ConsoleButton onClick={() => router.push("/")} tooltip="Return to the main menu">Return to menu</ConsoleButton>
          </div>
        </MetalPanel>
      </div>
    </main>
  );
}
