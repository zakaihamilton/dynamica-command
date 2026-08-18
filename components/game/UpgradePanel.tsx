import { UPGRADE_COST, UPGRADE_PREREQUISITE } from "@/lib/catalog";
import type { CampaignProgress, UpgradeId } from "@/lib/types";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import styles from "./UpgradePanel.module.css";

const UPGRADE_INFO: Record<UpgradeId, { branch: string; name: string; detail: string }> = {
  "logistics-cargo": { branch: "Logistics", name: "Expanded Cargo", detail: "Harvesters carry 20% more." },
  "logistics-drills": { branch: "Logistics", name: "Deep Drills", detail: "Harvesting rate increases by 10%." },
  "logistics-unload": { branch: "Logistics", name: "Rapid Unload", detail: "Refineries process cargo faster." },
  "logistics-cache": { branch: "Logistics", name: "Forward Cache", detail: "Start missions with 250 extra credits." },
  "arsenal-barrels": { branch: "Arsenal", name: "Improved Barrels", detail: "Combat damage increases by 5%." },
  "arsenal-plating": { branch: "Arsenal", name: "Combat Plating", detail: "Combat-unit HP increases by 10%." },
  "arsenal-targeting": { branch: "Arsenal", name: "Targeting Optics", detail: "Combat sight increases by 1." },
  "arsenal-shock": { branch: "Arsenal", name: "Shock Discipline", detail: "Suppression resistance increases by 10%." },
  "engineering-frames": { branch: "Engineering", name: "Rapid Frames", detail: "Construction and production are 10% faster." },
  "engineering-grid": { branch: "Engineering", name: "Stable Grid", detail: "Power production increases by 15%." },
  "engineering-repair": { branch: "Engineering", name: "Efficient Repair", detail: "Repair costs decrease by 10%." },
  "engineering-fabrication": { branch: "Engineering", name: "Lean Fabrication", detail: "Building costs decrease by 10%." },
};

const IDS = Object.keys(UPGRADE_INFO) as UpgradeId[];

export function UpgradePanel({ progress, onBuy, onBack }: { progress: CampaignProgress; onBuy: (id: UpgradeId) => void; onBack: () => void }) {
  return (
    <MetalPanel className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <ConsoleLabel>Research Division</ConsoleLabel>
      <h2 id="upgrade-title" className={styles.title}>Campaign Upgrades</h2>
      <p className={styles.points}>Research points: <strong>{progress.researchPoints}</strong></p>
      <div className={styles.grid}>
        {IDS.map((id) => {
          const info = UPGRADE_INFO[id];
          const prerequisite = UPGRADE_PREREQUISITE[id];
          const purchased = progress.upgrades.includes(id);
          const locked = !!prerequisite && !progress.upgrades.includes(prerequisite);
          const affordable = progress.researchPoints >= UPGRADE_COST[id];
          return (
            <article key={id} className={`${styles.card} ${purchased ? styles.purchased : ""}`}>
              <div className={styles.branch}>{info.branch}</div>
              <h3>{info.name}</h3>
              <p>{info.detail}</p>
              <small>{locked ? `Requires ${UPGRADE_INFO[prerequisite!].name}` : `${UPGRADE_COST[id]} research point${UPGRADE_COST[id] === 1 ? "" : "s"}`}</small>
              <ConsoleButton className={styles.buy} disabled={purchased || locked || !affordable} onClick={() => onBuy(id)}>
                {purchased ? "Installed" : locked ? "Locked" : "Research"}
              </ConsoleButton>
            </article>
          );
        })}
      </div>
      <ConsoleButton muted onClick={onBack}>Back</ConsoleButton>
    </MetalPanel>
  );
}
