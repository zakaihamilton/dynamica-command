import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { biomeLabel } from "@/lib/gen/names";
import { objectiveHeadline } from "@/lib/gen/story";
import { formatSeed } from "@/lib/seed/rng";
import type { Campaign, MissionDef } from "@/lib/types";
import styles from "./BriefingMast.module.css";

export function BriefingMast({
  seed,
  mission,
  campaign,
  def,
}: {
  seed: number;
  mission: number;
  campaign: Campaign;
  def: MissionDef;
}) {
  return (
    <MetalPanel as="header" className={styles.mast}>
      <div>
        <ConsoleLabel data-testid="seed">
          Genesis Protocol · Seed {formatSeed(seed)} · Mission {mission + 1}/8
        </ConsoleLabel>
        <h1 className={styles.title}>{def.name}</h1>
        <p className={styles.world}>
          {campaign.world.name} · {biomeLabel(campaign.world.biome)} · {campaign.world.era}
        </p>
      </div>
      <p className={styles.aside}>
        {campaign.factions[0].name} theater brief
        <span className={styles.objective} data-testid="objective">
          {objectiveHeadline(def.win)}
        </span>
      </p>
    </MetalPanel>
  );
}
