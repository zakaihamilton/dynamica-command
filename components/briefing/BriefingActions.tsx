import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { Campaign } from "@/lib/types";
import styles from "./BriefingScreen.module.css";

export function BriefingActions({
  campaign,
  returnToGame,
  onReplay,
  onLaunch,
  onBack,
  backLabel,
}: {
  campaign: Campaign;
  returnToGame: boolean;
  onReplay: () => void;
  onLaunch: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className={styles.actions} data-testid="briefing-actions">
      {!returnToGame ? (
        <ConsoleButton
          muted
          tooltip={backLabel}
          onClick={onBack}
        >
          {backLabel}
        </ConsoleButton>
      ) : null}
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
      <p className={styles.tone}>
        {campaign.world.tone} · {campaign.world.conflict}
      </p>
    </div>
  );
}
