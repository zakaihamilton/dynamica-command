import { useRef } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { listSaves } from "@/lib/persist/save";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { ResumeList } from "./ResumeList";
import styles from "./MenuMainPanel.module.css";

type Save = ReturnType<typeof listSaves>[number];

export function MenuMainPanel({
  saves,
  unreadableSaves,
  onNewGame,
  onOptions,
  onResume,
  onCampaignMap,
  onDelete,
  onResetUnreadable,
  onImportFile,
  importError,
  importNotice,
}: {
  saves: Save[];
  unreadableSaves: string[];
  onNewGame: () => void;
  onOptions: () => void;
  onResume: (seed: string) => void;
  onCampaignMap: (seed: string) => void;
  onDelete: (seed: string) => void;
  onResetUnreadable: (seed: string) => void;
  onImportFile: (file: File) => void;
  importError: string;
  importNotice: string;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <MetalPanel className={styles.panel}>
      <div className={styles.actions}>
        <ConsoleButton className={styles.full} tooltip="Open campaign setup" shortcut={SHORTCUT.newGame} onClick={onNewGame}>
          NEW GAME
        </ConsoleButton>
        <ConsoleButton className={styles.full} tooltip="Audio and game options" shortcut={SHORTCUT.options} onClick={onOptions}>
          OPTIONS
        </ConsoleButton>
        <ConsoleButton className={styles.full} tooltip="Import a validated Genesis Protocol JSON save" onClick={() => importInputRef.current?.click()}>
          IMPORT SAVE
        </ConsoleButton>
        <input
          ref={importInputRef}
          className={styles.hiddenInput}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a Genesis Protocol save file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onImportFile(file);
          }}
        />
      </div>

      {importError ? <p className={styles.importError} role="alert">{importError}</p> : null}
      {importNotice ? <p className={styles.importNotice} role="status">{importNotice}</p> : null}

      <ResumeList saves={saves} onResume={onResume} onCampaignMap={onCampaignMap} onDelete={onDelete} />
      {unreadableSaves.length ? (
        <div className={styles.recovery} role="alert">
          <span>Unreadable save{unreadableSaves.length === 1 ? "" : "s"}: {unreadableSaves.join(", ")}</span>
          {unreadableSaves.map((seed) => (
            <ConsoleButton key={seed} tooltip={`Remove unreadable save ${seed}`} onClick={() => onResetUnreadable(seed)}>
              Reset {seed}
            </ConsoleButton>
          ))}
        </div>
      ) : null}
    </MetalPanel>
  );
}
