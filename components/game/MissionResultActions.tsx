import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { SimState } from "@/lib/types";
import styles from "./MissionResult.module.css";

export function MissionResultActions({
  state,
  onNextBriefing,
  onCampaignVictory,
  onCampaignMap,
  onRetry,
  onMenu,
  onSoundtrack,
}: {
  state: SimState;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onCampaignMap: () => void;
  onRetry: () => void;
  onMenu: () => void;
  onSoundtrack: () => void;
}) {
  return (
    <div className={styles.actions}>
      {state.result === "won" && state.missionIndex < 7 ? (
        <ConsoleButton tooltip="Advance to the next briefing" shortcut={SHORTCUT.resultPrimary} onClick={onNextBriefing}>
          Next briefing
        </ConsoleButton>
      ) : null}
      {state.result === "won" && state.missionIndex >= 7 ? (
        <ConsoleButton tooltip="Return to the main menu" shortcut={SHORTCUT.resultPrimary} onClick={onCampaignVictory}>
          Campaign victory
        </ConsoleButton>
      ) : null}
      {state.result === "won" ? (
        <ConsoleButton muted tooltip="Replay this mission" onClick={onRetry}>
          Replay mission
        </ConsoleButton>
      ) : null}
      {state.result === "lost" ? (
        <ConsoleButton tooltip="Retry this mission" shortcut={SHORTCUT.resultPrimary} onClick={onRetry}>
          Retry
        </ConsoleButton>
      ) : null}
      <ConsoleButton muted tooltip="Open the campaign operations map" onClick={onCampaignMap}>
        Campaign map
      </ConsoleButton>
        <ConsoleButton tooltip="Download this mission's music" onClick={onSoundtrack}>
        Soundtrack
      </ConsoleButton>
      <ConsoleButton muted tooltip="Return to the main menu" shortcut={SHORTCUT.resultMenu} onClick={onMenu}>
        Menu
      </ConsoleButton>
    </div>
  );
}
