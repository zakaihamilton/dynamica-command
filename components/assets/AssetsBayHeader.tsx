import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./AssetsBrowser.module.css";

export function AssetsBayHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.header}>
      <div>
        <ConsoleLabel>Dynamica Command</ConsoleLabel>
        <h2 id="assets-title" className={styles.title}>
          Asset bay
        </h2>
      </div>
      <ConsoleButton muted tooltip="Close" shortcut={SHORTCUT.close} onClick={onClose}>
        Close
      </ConsoleButton>
    </div>
  );
}
