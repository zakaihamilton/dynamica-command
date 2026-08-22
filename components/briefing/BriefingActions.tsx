import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { Campaign } from "@/lib/types";
import styles from "./BriefingScreen.module.css";

export function BriefingActions({
  campaign,
  returnToGame,
  onReplay,
  onLaunch,
  onSoundtrack,
}: {
  campaign: Campaign;
  returnToGame: boolean;
  onReplay: () => void;
  onLaunch: () => void;
  onSoundtrack: () => void;
}) {
  return (
    <div className={styles.actions}>
      <ConsoleButton
        tooltip="Replay the incoming transmission"
        shortcut={SHORTCUT.replay}
        onClick={onReplay}
      >
        Replay
      </ConsoleButton>
      <ConsoleButton
        tooltip={returnToGame ? "Return to the battlefield" : "Launch this mission"}
        shortcut={returnToGame ? SHORTCUT.resume : SHORTCUT.launch}
        onClick={onLaunch}
      >
        {returnToGame ? "Return to mission" : "Launch"}
      </ConsoleButton>
      <ConsoleButton tooltip="Render and download the mission soundtrack as an M4A" onClick={onSoundtrack}>
        Soundtrack
      </ConsoleButton>
      <p className={styles.tone}>
        {campaign.world.tone} · {campaign.world.conflict}
      </p>
    </div>
  );
}
