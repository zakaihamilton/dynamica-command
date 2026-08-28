import { ConsoleButton } from "@/components/ui/ConsoleButton";
import styles from "./MobileCommandLauncher.module.css";

export function MobileCommandLauncher({
  open,
  onToggle,
  onPause,
}: {
  open: boolean;
  onToggle: () => void;
  onPause: () => void;
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close commands"
          data-testid="mobile-command-scrim"
          onClick={onToggle}
        />
      ) : null}
      <div className={styles.launcher} data-open={open ? "true" : "false"} data-testid="mobile-command-launcher">
        <ConsoleButton
          className={styles.button}
          aria-expanded={open}
          aria-controls="command-sidebar"
          data-testid="mobile-command-toggle"
          onClick={onToggle}
        >
          {open ? "Close" : "Commands"}
        </ConsoleButton>
        <ConsoleButton
          className={styles.button}
          muted
          aria-label="Pause mission"
          data-testid="mobile-pause"
          onClick={onPause}
        >
          Pause
        </ConsoleButton>
      </div>
    </>
  );
}
