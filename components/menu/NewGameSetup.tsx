import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { biomeLabel } from "@/lib/gen/names";
import { biomeArt } from "@/lib/gen/visualAssets";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { Campaign } from "@/lib/types";
import type { CSSProperties, RefObject } from "react";
import { SeedEntry } from "./SeedEntry";
import styles from "./NewGameSetup.module.css";

export function NewGameSetup({
  code,
  error,
  previewLine,
  preview,
  copied,
  inputRef,
  onChange,
  onRandomize,
  onCopyLink,
  onLaunch,
  onBack,
}: {
  code: string;
  error: string;
  previewLine: string;
  preview: Campaign | null;
  copied: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onCopyLink: () => void;
  onLaunch: () => void;
  onBack: () => void;
}) {
  return (
    <MetalPanel as="section" className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-game-title" data-testid="deploy-screen">
      <div className={styles.intro}>
        <ConsoleLabel>Dynamica command // Daily Challenge</ConsoleLabel>
        <h2 id="new-game-title" className={styles.title}>New campaign</h2>
        <p className={styles.copy}>
          Today&apos;s daily seed is pre-rolled for all commanders. Launch to share the same battlefield, or enter any code to play a different campaign.
        </p>
        {preview && (
          <>
            <div
              className={styles.backdrop}
              style={{ "--campaign-art": `url("${biomeArt(preview.world.biome)}")` } as CSSProperties}
              role="img"
              aria-label={`${biomeLabel(preview.world.biome)} campaign backdrop`}
              data-testid="campaign-backdrop"
            />
            <div className={styles.campaignDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>WORLD</span>
                <span className={styles.detailValue}>{preview.world.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>ERA</span>
                <span className={styles.detailValue}>{preview.world.era}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>BIOME</span>
                <span className={styles.detailValue}>{biomeLabel(preview.world.biome)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>CONFLICT</span>
                <span className={styles.detailValue}>{preview.world.conflict}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>FACTIONS</span>
                <span className={styles.detailValue}>{preview.factions[0].name} vs {preview.factions[1].name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>COMMANDER</span>
                <span className={styles.detailValue}>{preview.characters.commander.name}</span>
              </div>
            </div>
          </>
        )}
        <div className={styles.introReadout}>
          <span>CAMPAIGN FORMAT</span>
          <strong>8 OPERATIONS</strong>
          <span>SAME CODE, SAME CAMPAIGN · SAVED ON THIS DEVICE</span>
        </div>
      </div>

      <div className={styles.form}>
        <ConsoleLabel className={styles.seedLabel}>Campaign seed</ConsoleLabel>
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
          <ConsoleButton
            muted
            className={styles.copyLink}
            tooltip={copied ? "Link copied!" : "Copy campaign link to clipboard"}
            onClick={onCopyLink}
            disabled={!preview}
            aria-live="polite"
          >
            {copied ? "Link copied!" : "Copy link"}
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
        <p className={styles.hint}>R rolls a new campaign · Enter launches · Escape returns</p>
      </div>
    </MetalPanel>
  );
}
