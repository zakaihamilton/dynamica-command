"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { objectiveHeadline } from "@/lib/gen/story";
import { biomeLabel } from "@/lib/gen/names";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import styles from "./CampaignCompleteScreen.module.css";
import { campaignSummary, missionMedalDisplay } from "./campaignSummary";
import { useCampaignProgress } from "./useCampaignProgress";

export function CampaignCompleteScreen({ seed, mode = "record" }: { seed: number; mode?: "record" | "operations" }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
  const summary = campaignSummary(campaign, progress);
  const operations = mode === "operations";

  const openMission = (missionIndex: number) => {
    const path = missionIndex === 0 && !progress.tutorialComplete
      ? `/tutorial?seed=${formatSeed(seed)}`
      : `/briefing?seed=${formatSeed(seed)}&mission=${missionIndex}`;
    router.push(path);
  };

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
            <h1 className={styles.title}>{operations ? "Operations map" : summary.isComplete ? "Campaign complete" : "Campaign record"}</h1>
            <p className={styles.subtitle}>{operations ? "SELECT DEPLOYMENT" : summary.isComplete ? "THEATER SECURED" : "PROGRESS ARCHIVED"}</p>
            <p className={styles.meta}>Seed {formatSeed(seed)} · {campaign.world.name} · {campaign.factions[0].name}</p>
          </header>

          <section className={styles.summary} aria-label="Campaign summary">
            <div><span>Missions</span><strong>{summary.completed} / {campaign.missions.length}</strong></div>
            <div><span>Medals</span><strong>{summary.totalMedals} / {summary.possibleMedals}</strong></div>
          </section>

          <section className={styles.section} aria-labelledby="mission-record-title">
            <ConsoleLabel as="h2">{operations ? "Deployment queue" : "Mission record"}</ConsoleLabel>
            <h2 id="mission-record-title" className={styles.sectionTitle}>{operations ? "Choose an operation" : "Eight operations"}</h2>
            <div className={styles.missions}>
              {campaign.missions.map((mission, index) => {
                const medals = progress.medals[String(mission.index)] ?? 0;
                const missionComplete = progress.completedMissions.includes(mission.index);
                const available = mission.index <= progress.unlockedMission;
                const status = missionComplete ? "Completed" : available ? "Available" : "Locked";
                const action = missionComplete ? "Replay" : available ? "Deploy" : "Locked";
                const record = missionComplete
                  ? `Best score ${progress.bestScores[String(mission.index)] ?? 0}`
                  : available
                    ? "Ready for deployment"
                    : `Complete mission ${index} first`;
                const card = (
                  <>
                    <span className={styles.missionTopline}>
                      <span>Mission {index + 1} · {status}</span>
                      <span className={styles.medals} aria-label={`${medals} of 3 medals`}>{missionMedalDisplay(medals)}</span>
                    </span>
                    <span className={styles.missionTitle}>{mission.name}</span>
                    <span className={styles.missionMeta}>{biomeLabel(mission.biome)} · {mission.mapSize}×{mission.mapSize}</span>
                    <span className={styles.missionObjective}>{objectiveHeadline(mission.win)}</span>
                    <span className={styles.missionRecord}>{record}</span>
                    <span className={styles.missionAction}>{action}</span>
                  </>
                );

                if (available) {
                  return (
                    <button
                      key={mission.index}
                      type="button"
                      className={`${styles.mission} ${styles.missionButton} ${missionComplete ? styles.complete : styles.available}`}
                      aria-label={`${action} mission ${index + 1}: ${mission.name}`}
                      data-testid={`mission-card-${mission.index}`}
                      data-tooltip={`${action} mission ${index + 1}`}
                      onClick={() => openMission(mission.index)}
                    >
                      {card}
                    </button>
                  );
                }

                return (
                  <article key={mission.index} className={`${styles.mission} ${styles.locked}`} aria-label={`Mission ${index + 1} locked`}>
                    {card}
                  </article>
                );
              })}
            </div>
          </section>

          <div className={styles.actions}>
            {!operations ? (
              <ConsoleButton onClick={() => router.push(`/campaign?seed=${formatSeed(seed)}`)} tooltip="Open the campaign operations map">
                Operations map
              </ConsoleButton>
            ) : null}
            <ConsoleButton muted onClick={() => router.push("/")} tooltip="Return to the main menu">Return to menu</ConsoleButton>
          </div>
        </MetalPanel>
      </div>
    </main>
  );
}
