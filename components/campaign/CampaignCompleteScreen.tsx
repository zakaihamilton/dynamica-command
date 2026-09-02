"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { missionDurationMinutesFor, missionTimeLimitLabel, secondaryObjectivesForMissionSeed } from "@/lib/gen/objectives";
import { missionObjectives, objectiveHeadline } from "@/lib/gen/story";
import { biomeLabel } from "@/lib/gen/names";
import { biomeArt, RASTER_ART } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import { briefingPath } from "../game/hooks/missionRoutes";
import styles from "./CampaignCompleteScreen.module.css";
import { campaignSummary, missionMedalDisplay, missionUnlocks } from "./campaignSummary";
import { useCampaignProgress } from "./useCampaignProgress";

export function CampaignCompleteScreen({ seed, mode = "record" }: { seed: number; mode?: "record" | "operations" }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const progress = useCampaignProgress(seed);
  const summary = campaignSummary(campaign, progress);
  const operations = mode === "operations";
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(() => Math.min(progress.unlockedMission, campaign.missions.length - 1));

  useEffect(() => {
    if (!operations) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      router.push("/");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [operations, router]);

  const launchMission = (missionIndex: number) => {
    router.push(briefingPath(seed, missionIndex, false, "campaign"));
  };
  const selectedMission = campaign.missions[selectedMissionIndex];
  const selectedMissionComplete = selectedMission
    ? progress.completedMissions.includes(selectedMission.index)
    : false;
  const selectedMissionAvailable = selectedMission
    ? selectedMission.index <= progress.unlockedMission
    : false;
  const selectedObjectives = selectedMission ? missionObjectives(selectedMission, campaign) : [];
  const selectedSecondaryObjectives = selectedMission ? secondaryObjectivesForMissionSeed(seed, selectedMission) : [];
  const selectedUnlocks = selectedMission ? missionUnlocks(selectedMission.index, campaign.missions.length) : [];
  const selectedTimeLimit = selectedMission ? missionTimeLimitLabel(selectedMission.win) : undefined;
  const selectedLaunchLabel = selectedMissionComplete
    ? `Replay mission ${selectedMissionIndex + 1}`
    : `Deploy mission ${selectedMissionIndex + 1}`;

  const missionQueue = (
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
              {!operations ? <span className={styles.missionObjective}>{objectiveHeadline(mission.win)}</span> : null}
              <span className={styles.missionRecord}>{record}</span>
              <span className={styles.missionAction}>{action}</span>
            </>
          );

          return (
            <button
              key={mission.index}
              type="button"
              className={`${styles.mission} ${styles.missionButton} ${missionComplete ? styles.complete : available ? styles.available : styles.locked} ${selectedMissionIndex === mission.index ? styles.selected : ""}`}
              aria-label={`${action} mission ${index + 1}: ${mission.name}`}
              aria-pressed={selectedMissionIndex === mission.index}
              data-testid={`mission-card-${mission.index}`}
              data-tooltip={`${action} mission ${index + 1}`}
              onClick={() => setSelectedMissionIndex(mission.index)}
            >
              {card}
            </button>
          );
        })}
      </div>
    </section>
  );

  const missionDetail = selectedMission ? (
    <section
      className={styles.detail}
      aria-labelledby="mission-detail-title"
      data-testid="mission-detail"
      style={{ "--mission-art": `url("${biomeArt(selectedMission.biome)}")` } as React.CSSProperties}
    >
      <div className={styles.detailArt} aria-hidden="true" />
      <div className={styles.detailHeader}>
        <div>
          <ConsoleLabel>Mission detail</ConsoleLabel>
          <h2 id="mission-detail-title" className={styles.detailTitle}>Mission {selectedMission.index + 1}{" // "}{selectedMission.name}</h2>
        </div>
        <span className={styles.detailStatus}>{selectedMissionComplete ? "Completed" : selectedMissionAvailable ? "Available" : "Locked"}</span>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailBlock}>
          <span>Primary objective</span>
          <strong>{selectedObjectives[0]?.text}</strong>
        </div>
        <div className={styles.detailBlock}>
          <span>Secondary objectives</span>
          <ul>
            {selectedSecondaryObjectives.map((objective) => <li key={objective.id}>{objective.label}</li>)}
          </ul>
        </div>
        <div className={styles.detailBlock}>
          <span>{selectedTimeLimit ? "Time limit" : "Expected duration"}</span>
          <strong>{selectedTimeLimit ?? `~${Math.max(1, missionDurationMinutesFor(seed, selectedMission.index, selectedMission.win.kind))} min`}</strong>
        </div>
        <div className={styles.detailBlock}>
          <span>Theater</span>
          <strong>{biomeLabel(selectedMission.biome)} · {selectedMission.mapSize}×{selectedMission.mapSize}</strong>
        </div>
        <div className={styles.detailBlock}>
          <span>Unlocks after completion</span>
          <ul>
            {selectedUnlocks.map((unlock) => <li key={unlock}>{unlock}</li>)}
          </ul>
        </div>
      </div>

      <div className={styles.detailActions}>
        {selectedMissionAvailable ? (
          <ConsoleButton onClick={() => launchMission(selectedMission.index)} data-testid="launch-selected-mission" tooltip={`${selectedLaunchLabel} from the mission detail panel`}>
            {selectedLaunchLabel}
          </ConsoleButton>
        ) : (
          <span className={styles.lockedMessage}>Complete mission {selectedMission.index} to unlock this operation.</span>
        )}
      </div>
    </section>
  ) : null;

  return (
    <main
      className={`${styles.screen} ${operations ? styles.operationsScreen : ""}`}
      style={{ "--scene-art": `url("${RASTER_ART.victory}")` } as React.CSSProperties}
    >
      <div className={styles.vignette} />
      <div className={styles.content}>
        <MetalPanel className={`${styles.panel} ${operations ? styles.operationsPanel : ""}`} data-testid={operations ? "operations-panel" : undefined}>
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

          {operations ? (
            <div className={styles.operationsBody} data-testid="operations-body">
              {missionQueue}
              {missionDetail}
            </div>
          ) : (
            <>
              {missionQueue}
              {missionDetail}
            </>
          )}

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
