import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { RefObject } from "react";
import { SeedEntry } from "./SeedEntry";
import styles from "./NewGameSetup.module.css";

export function NewGameSetup({
  code,
  error,
  previewLine,
  inputRef,
  onChange,
  onRandomize,
  onLaunch,
  onBack,
}: {
  code: string;
  error: string;
  previewLine: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
  onBack: () => void;
}) {
  return (
    <MetalPanel className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-game-title">
      <ConsoleLabel>Genesis Command</ConsoleLabel>
      <h2 id="new-game-title" className={styles.title}>New campaign</h2>
      <p className={styles.copy}>
        Roll a random theater or enter a four-digit code to replay a war you already know.
      </p>
      <ConsoleLabel className={styles.seedLabel}>Theater seed</ConsoleLabel>
      <SeedEntry
        code={code}
        error={error}
        previewLine={previewLine}
        inputRef={inputRef}
        onChange={onChange}
        onRandomize={onRandomize}
        onLaunch={onLaunch}
      />
      <ConsoleButton
        className={styles.launch}
        tooltip="Begin the first briefing"
        shortcut={SHORTCUT.deploy}
        onClick={onLaunch}
      >
        Launch
      </ConsoleButton>
      <ConsoleButton
        muted
        className={styles.back}
        tooltip="Return to the main menu"
        shortcut={SHORTCUT.back}
        onClick={onBack}
      >
        Back
      </ConsoleButton>
      <p className={styles.hint}>R rolls a new theater · Enter launches · Escape returns</p>
    </MetalPanel>
  );
}
