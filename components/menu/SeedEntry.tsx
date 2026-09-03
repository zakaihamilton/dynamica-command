import type { RefObject } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./SeedEntry.module.css";

export function SeedEntry({
  code,
  error,
  previewLine,
  inputRef,
  onChange,
  onRandomize,
  onLaunch,
}: {
  code: string;
  error: string;
  previewLine: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
}) {
  return (
    <div className={styles.block}>
      <div className={styles.row}>
        <div className={styles.digitsWrap}>
          <div className={styles.digits} aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.cell}>
                {code[i] ?? "·"}
              </div>
            ))}
          </div>
          <input
            ref={inputRef}
            value={code}
            onFocus={(e) => {
              if (code.length === 4) e.currentTarget.select();
            }}
            onMouseUp={(e) => {
              if (code.length !== 4) return;
              e.preventDefault();
              e.currentTarget.select();
            }}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onLaunch();
              }
            }}
            maxLength={4}
            inputMode="numeric"
            autoComplete="off"
            aria-label="Four digit campaign seed"
            className={styles.input}
          />
        </div>
        <ConsoleButton
          className={styles.roll}
          tooltip="Roll a random campaign"
          shortcut={SHORTCUT.randomize}
          onClick={onRandomize}
        >
          Roll
        </ConsoleButton>
      </div>
      <div className={styles.status}>
        <p className={styles.preview}>{previewLine}</p>
        <p className={styles.error} aria-live="polite">{error || "\u00a0"}</p>
      </div>
    </div>
  );
}
