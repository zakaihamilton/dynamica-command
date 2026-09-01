import type { Ref } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import styles from "./MobileCommandLauncher.module.css";

export function MobileCommandLauncher({
  open,
  onToggle,
  buttonRef,
}: {
  open: boolean;
  onToggle: () => void;
  buttonRef: Ref<HTMLButtonElement>;
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
          ref={buttonRef}
          className={styles.button}
          aria-expanded={open}
          aria-controls="command-sidebar"
          aria-label={open ? "Close commands" : "Open commands"}
          data-testid="mobile-command-toggle"
          onClick={onToggle}
        >
          <svg
            className={styles.icon}
            data-testid="mobile-command-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        </ConsoleButton>
      </div>
    </>
  );
}
