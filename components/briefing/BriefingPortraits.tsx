import type { Campaign, CharacterRole } from "@/lib/types";
import { Portrait } from "./Portrait";
import styles from "./BriefingScreen.module.css";

export function BriefingAllyPortraits({
  campaign,
  liveRole,
}: {
  campaign: Campaign;
  liveRole: CharacterRole | undefined;
}) {
  return (
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
  );
}

export function BriefingEnemyPortrait({
  campaign,
  liveRole,
}: {
  campaign: Campaign;
  liveRole: CharacterRole | undefined;
}) {
  return (
    <div className={styles.enemy}>
      <Portrait
        who={campaign.characters.enemyLeader}
        talking={liveRole === "enemyLeader"}
        tone="enemy"
        faction={campaign.factions[1].name}
      />
    </div>
  );
}
