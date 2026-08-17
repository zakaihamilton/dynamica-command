import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { SimState } from "@/lib/types";
import styles from "./MissionResult.module.css";

export function MissionResult({
  result,
  missionIndex,
  onNextBriefing,
  onCampaignVictory,
  onRetry,
  onMenu,
}: {
  result: SimState["result"];
  missionIndex: number;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onRetry: () => void;
  onMenu: () => void;
}) {
  if (result === "playing") return null;
  return (
    <div className={styles.overlay} data-testid="mission-result">
      <MetalPanel className={styles.panel}>
        <ConsoleLabel>Theater status</ConsoleLabel>
        <h2 className={styles.title}>
          {result === "won" ? "Mission complete" : "Mission failed"}
        </h2>
        <div className={styles.actions}>
          {result === "won" && missionIndex < 7 ? (
            <ConsoleButton tooltip="Advance to the next briefing" shortcut={SHORTCUT.resultPrimary} onClick={onNextBriefing}>
              Next briefing
            </ConsoleButton>
          ) : null}
          {result === "won" && missionIndex >= 7 ? (
            <ConsoleButton tooltip="Return to the main menu" shortcut={SHORTCUT.resultPrimary} onClick={onCampaignVictory}>
              Campaign victory
            </ConsoleButton>
          ) : null}
          {result === "lost" ? (
            <ConsoleButton tooltip="Retry this mission" shortcut={SHORTCUT.resultPrimary} onClick={onRetry}>
              Retry
            </ConsoleButton>
          ) : null}
          <ConsoleButton muted tooltip="Return to the main menu" shortcut={SHORTCUT.resultMenu} onClick={onMenu}>
            Menu
          </ConsoleButton>
        </div>
      </MetalPanel>
    </div>
  );
}
