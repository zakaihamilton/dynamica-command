"use client";

import type { CSSProperties } from "react";
import { campaignScaleLabel, theaterArchiveLabel } from "@/components/campaign/campaignSummary";
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
  const archive = theaterArchiveLabel(campaign, progress);
  const scale = campaignScaleLabel(campaign);

  return (
    <aside className={styles.dossier} data-testid="theater-dossier">
      <header
        className={styles.hero}
        style={{ "--theater-art": `url("${biomeArt(campaign.world.biome)}")` } as CSSProperties}
      >
        <ConsoleLabel>Theater {formatSeed(campaign.seedNumber)}</ConsoleLabel>
        <h3 className={styles.worldName}>{campaign.world.name}</h3>
        <p className={styles.meta}>
          {campaign.world.tone} · {campaign.world.conflict} · {campaign.world.era} · {biomeLabel(campaign.world.biome)}
        </p>
      </header>

      <section className={styles.section} aria-labelledby="theater-factions">
        <ConsoleLabel as="h4" id="theater-factions">Belligerents</ConsoleLabel>
        <div className={styles.factions}>
          <FactionCard faction={campaign.factions[0]} side="Allied" />
          <span className={styles.versus}>vs</span>
          <FactionCard faction={campaign.factions[1]} side="Hostile" />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="theater-staff">
        <ConsoleLabel as="h4" id="theater-staff">Command staff</ConsoleLabel>
        <ul className={styles.staff}>
          <StaffRow channel="Command" who={campaign.characters.commander} />
          <StaffRow channel="Advisor" who={campaign.characters.advisor} />
          <StaffRow channel="Enemy" who={campaign.characters.enemyLeader} />
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="theater-ops">
        <ConsoleLabel as="h4" id="theater-ops">Operation slate</ConsoleLabel>
        <ol className={styles.slate} aria-label={`${campaign.missions.length} operations`}>
          {campaign.missions.map((mission) => (
            <li
              key={mission.index}
              className={cx(styles.op, mission.index === 0 && styles.opLead)}
            >
              <span className={styles.opIndex}>{String(mission.index + 1).padStart(2, "0")}</span>
              <span className={styles.opBody}>
                <span className={styles.opName}>{mission.name}</span>
                <span className={styles.opMeta}>
                  {biomeLabel(mission.biome)} · {mission.mapSize}×{mission.mapSize}
                </span>
                {mission.index === 0 ? (
                  <span className={styles.opObjective}>{objectiveHeadline(mission.win)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.readout}>
        <div>
          <span>Campaign scale</span>
          <strong>{scale}</strong>
        </div>
        <div>
          <span>Local archive</span>
          <strong>{archive}</strong>
        </div>
      </footer>
    </aside>
  );
}

function FactionCard({ faction, side }: { faction: Faction; side: "Allied" | "Hostile" }) {
  return (
    <div className={styles.faction} data-side={side.toLowerCase()}>
      <span className={styles.factionSide}>{side}</span>
      <strong className={styles.factionName}>{faction.name}</strong>
      <span className={styles.swatches} aria-hidden="true">
        <span style={{ background: faction.palette.primary }} />
        <span style={{ background: faction.palette.accent }} />
        <span style={{ background: faction.palette.dark }} />
      </span>
    </div>
  );
}

function StaffRow({ channel, who }: { channel: string; who: Character }) {
  return (
    <li className={styles.staffRow}>
      <span>{channel}</span>
      <strong>{characterLabel(who)}</strong>
    </li>
  );
}
