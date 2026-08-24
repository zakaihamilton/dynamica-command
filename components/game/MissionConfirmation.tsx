import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { MissionConfirmation as MissionConfirmationState } from "./hooks/useGameSession";
import styles from "./MissionConfirmation.module.css";

export function MissionConfirmation({
  confirmation,
  onConfirm,
  onCancel,
}: {
  confirmation: MissionConfirmationState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.overlay} data-testid="mission-confirmation">
      <MetalPanel
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-confirmation-title"
      >
        <ConsoleLabel as="h2" id="mission-confirmation-title">{confirmation.title}</ConsoleLabel>
        <p className={styles.copy}>{confirmation.message}</p>
        <div className={styles.actions}>
          <ConsoleButton muted onClick={onCancel}>Cancel</ConsoleButton>
          <ConsoleButton autoFocus onClick={onConfirm}>{confirmation.confirmLabel}</ConsoleButton>
        </div>
      </MetalPanel>
    </div>
  );
}
