import type { RefObject } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { Campaign } from "@/lib/types";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { SeedEntry } from "./SeedEntry";
import { TheaterDossier } from "./TheaterDossier";
import styles from "./NewGameSetup.module.css";

export function NewGameSetup({
  code,
  error,
  campaign,
  inputRef,
  onChange,
  onRandomize,
  onLaunch,
  onBack,
}: {
  code: string;
  error: string;
  campaign: Campaign | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
  onBack: () => void;
}) {
  return (
    <MetalPanel as="section" className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-game-title" data-testid="deploy-screen">
      <div className={styles.control}>
        <ConsoleLabel>Dynamica command // Theater authorization</ConsoleLabel>
        <h2 id="new-game-title" className={styles.title}>New theater</h2>
        <p className={styles.copy}>
          Roll a fresh theater or enter a known code. The same seed always writes the same war, and progress stays on this device.
        </p>
        <ConsoleLabel className={styles.seedLabel}>Theater seed</ConsoleLabel>
        <SeedEntry
          code={code}
          error={error}
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

      <TheaterDossier campaign={campaign} />
    </MetalPanel>
  );
}
