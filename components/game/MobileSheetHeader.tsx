import { ConsoleButton } from "@/components/ui/ConsoleButton";
import styles from "./MobileCommandTray.module.css";

export function MobileSheetHeader({
  selectedCount,
  onClose,
}: {
  selectedCount: number;
  onClose: () => void;
}) {
  return (
    <div className={styles.sheetHeader}>
      <div>
        <span className={styles.eyebrow}>Genesis command</span>
        <strong>{selectedCount > 0 ? `${selectedCount} selected` : "Base systems"}</strong>
      </div>
      <ConsoleButton className={styles.close} muted onClick={onClose} aria-label="Close commands" data-testid="mobile-command-close">
        Close
      </ConsoleButton>
    </div>
  );
}
