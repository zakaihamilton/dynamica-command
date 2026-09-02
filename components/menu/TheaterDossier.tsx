"use client";

import type { CSSProperties } from "react";
import { campaignScaleLabel, campaignSummary, theaterArchiveLabel } from "@/components/campaign/campaignSummary";
import { useCampaignProgress } from "@/components/campaign/useCampaignProgress";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { biomeLabel, characterLabel } from "@/lib/gen/names";
import { objectiveHeadline } from "@/lib/gen/story";
import { biomeArt } from "@/lib/gen/visualAssets";
import { formatSeed } from "@/lib/seed/rng";
import type { Campaign, Character, Faction } from "@/lib/types";
import { cx } from "@/lib/ui/cx";
import styles from "./TheaterDossier.module.css";

export function TheaterDossier({ campaign }: { campaign: Campaign | null }) {
  if (!campaign) {
    return (
      <aside className={cx(styles.dossier, styles.empty)} data-testid="theater-dossier">
        <ConsoleLabel>Theater dossier</ConsoleLabel>
        <p className={styles.awaiting}>Awaiting a 4-digit theater code</p>
        <p className={styles.awaitingHint}>Enter all four digits to preview this theater.</p>
      </aside>
    );
  }

  return <TheaterDossierLive campaign={campaign} />;
}

function TheaterDossierLive({ campaign }: { campaign: Campaign }) {
  const progress = useCampaignProgress(campaign.seedNumber);
  const summary = campaignSummary(campaign, progress);
  const archive = theaterArchiveLabel(campaign, progress);
  const scale = campaignScaleLabel(campaign);
  const mapSizes = [...new Set(campaign.missions.map((mission) => mission.mapSize))];
  const setting = `${campaign.world.tone} · ${campaign.world.conflict} · ${campaign.world.era} · ${biomeLabel(campaign.world.biome)}`;
  const archiveMark = `${summary.completed}/${campaign.missions.length}`;
  const archiveHint = summary.isComplete ? "Complete" : summary.completed > 0 ? "Launch → Op 1" : null;

  return (
    <aside
      className={styles.dossier}
      data-testid="theater-dossier"
      style={{ "--theater-art": `url("${biomeArt(campaign.world.biome)}")` } as CSSProperties}
    >
      <header className={cx(styles.glass, styles.titlePlate)} aria-label={setting} title={setting}>
        <ConsoleLabel>Theater {formatSeed(campaign.seedNumber)}</ConsoleLabel>
        <h3 className={styles.worldName}>{campaign.world.name}</h3>
        <ul className={styles.chips}>
          <li className={styles.chip}>{campaign.world.era}</li>
          <li className={styles.chip}>{biomeLabel(campaign.world.biome)}</li>
        </ul>
      </header>

      <section className={cx(styles.glass, styles.plate)} aria-labelledby="theater-factions">
        <ConsoleLabel as="h4" id="theater-factions">
          Belligerents
        </ConsoleLabel>
        <div className={styles.factions}>
          <FactionCard faction={campaign.factions[0]} side="Allied" />
          <FactionCard faction={campaign.factions[1]} side="Hostile" />
        </div>
      </section>

      <section className={cx(styles.glass, styles.plate)} aria-labelledby="theater-staff">
        <ConsoleLabel as="h4" id="theater-staff">
          Command staff
        </ConsoleLabel>
        <ul className={styles.staff}>
          <StaffChip channel="Command" who={campaign.characters.commander} />
          <StaffChip channel="Advisor" who={campaign.characters.advisor} />
          <StaffChip channel="Enemy" who={campaign.characters.enemyLeader} />
        </ul>
      </section>

      <section className={cx(styles.glass, styles.plate)} aria-labelledby="theater-ops">
        <ConsoleLabel as="h4" id="theater-ops">
          Operation slate
        </ConsoleLabel>
        <ol className={styles.opsGrid} aria-label={`${campaign.missions.length} operations`}>
          {campaign.missions.map((mission) => (
            <li
              key={mission.index}
              className={cx(styles.op, mission.index === 0 && styles.opLead)}
              style={{ "--op-art": `url("${biomeArt(mission.biome)}")` } as CSSProperties}
            >
              <span className={styles.opStrip} aria-hidden="true" />
              <span className={styles.opBody}>
                <span className={styles.opIndex}>{String(mission.index + 1).padStart(2, "0")}</span>
                <span className={styles.opName}>{mission.name}</span>
              </span>
              {mission.index === 0 ? <span className={styles.objective}>{objectiveHeadline(mission.win)}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <footer className={cx(styles.glass, styles.footer)}>
        <div className={styles.scale} role="group" aria-label={scale}>
          {mapSizes.map((size) => (
            <span key={size} className={styles.pip}>
              {size}
            </span>
          ))}
        </div>
        <div className={styles.archive} role="group" aria-label={archive}>
          <div className={styles.archiveTrack} aria-hidden="true">
            <div
              className={styles.archiveFill}
              style={{ width: `${(summary.completed / campaign.missions.length) * 100}%` }}
            />
          </div>
          <p className={styles.archiveLine}>{archiveHint ? `${archiveMark} · ${archiveHint}` : archiveMark}</p>
        </div>
      </footer>
    </aside>
  );
}

function FactionCard({ faction, side }: { faction: Faction; side: "Allied" | "Hostile" }) {
  return (
    <div className={styles.faction} data-side={side.toLowerCase()}>
      <strong className={styles.factionName}>{faction.name}</strong>
      <span className={styles.stance}>{side}</span>
      <span
        className={styles.paletteBar}
        aria-hidden="true"
        style={{
          background: `linear-gradient(90deg, ${faction.palette.primary} 0 33.34%, ${faction.palette.accent} 33.34% 66.67%, ${faction.palette.dark} 66.67% 100%)`,
        }}
      />
    </div>
  );
}

function StaffChip({ channel, who }: { channel: string; who: Character }) {
  const name = characterLabel(who);
  return (
    <li className={styles.staffChip} title={name}>
      <span className={styles.staffPip}>{channel}</span>
      <strong className={styles.staffName}>{name}</strong>
    </li>
  );
}
