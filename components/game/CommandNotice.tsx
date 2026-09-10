import type { CommandNoticeState } from "./hooks/useGameChrome";
import styles from "./CommandNotice.module.css";

export function CommandNotice({ notice }: { notice: CommandNoticeState }) {
  if (!notice) return null;
  const urgent = notice.kind === "warning" || notice.kind === "error";
  return (
    <p className={styles.notice} data-kind={notice.kind} role={urgent ? "alert" : "status"} aria-live={urgent ? "assertive" : "polite"} data-testid="command-notice">
      <span className={styles.icon} aria-hidden="true">{notice.kind === "success" ? "✓" : notice.kind === "error" ? "×" : notice.kind === "warning" ? "!" : "·"}</span>
      <span>{notice.text}</span>
    </p>
  );
}
