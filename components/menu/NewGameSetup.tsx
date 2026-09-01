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
  onOperations,
  onBack,
}: {
  code: string;
  error: string;
  previewLine: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
  onOperations?: () => void;
  onBack: () => void;
}) {
  return (
    <MetalPanel as="section" className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-game-title" data-testid="deploy-screen">
      <div className={styles.intro}>
        <ConsoleLabel>Genesis command // Deployment</ConsoleLabel>
        <h2 id="new-game-title" className={styles.title}>New theater</h2>
        <p className={styles.copy}>
          Every four-digit seed writes a different war. Roll a fresh theater or enter a code to return to one you already know.
        </p>
        <div className={styles.introReadout}>
          <span>CAMPAIGN FORMAT</span>
          <strong>8 OPERATIONS</strong>
          <span>DETERMINISTIC WORLD / LOCAL SAVE</span>
        </div>
      </div>

      <div className={styles.form}>
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
        <div className={styles.actions}>
          <ConsoleButton
            className={styles.launch}
            tooltip="Begin the first briefing"
            shortcut={SHORTCUT.deploy}
            onClick={onLaunch}
          >
            Launch
          </ConsoleButton>
          {onOperations ? (
            <ConsoleButton
              muted
              className={styles.operations}
              tooltip="Open the operations map for this seed"
              onClick={onOperations}
            >
              Operations map
            </ConsoleButton>
          ) : null}
          <ConsoleButton
            muted
            className={styles.back}
            tooltip="Return to the main menu"
            shortcut={SHORTCUT.back}
            onClick={onBack}
          >
            Back
          </ConsoleButton>
        </div>
        <p className={styles.hint}>R rolls a new theater · Enter launches · Escape returns</p>
      </div>
    </MetalPanel>
  );
}
