import { AssetsBrowser } from "@/components/assets/AssetsBrowser";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { Palette } from "@/lib/types";
import { PauseMainMenu } from "./PauseMainMenu";
import { PauseOptions } from "./PauseOptions";
import styles from "./PauseMenu.module.css";

export function PauseMenu({
  view,
  notice,
  soundEnabled,
  palette,
  onResume,
  onSave,
  onLoad,
  onBriefing,
  onRestart,
  onAssets,
  onOptions,
  onMenu,
  onToggleSound,
  onBack,
  onCloseAssets,
}: {
  view: PauseView;
  notice: string;
  soundEnabled: boolean;
  palette: Palette;
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onBriefing: () => void;
  onRestart: () => void;
  onAssets: () => void;
  onOptions: () => void;
  onMenu: () => void;
  onToggleSound: () => void;
  onBack: () => void;
  onCloseAssets: () => void;
}) {
  return (
    <div className={styles.overlay} data-testid="pause-menu">
      {view === "assets" ? (
        <AssetsBrowser palette={palette} onClose={onCloseAssets} />
      ) : (
        <MetalPanel className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pause-title">
          {view === "main" ? (
            <PauseMainMenu
              onResume={onResume}
              onSave={onSave}
              onLoad={onLoad}
              onBriefing={onBriefing}
              onRestart={onRestart}
              onAssets={onAssets}
              onOptions={onOptions}
              onMenu={onMenu}
            />
          ) : (
            <PauseOptions soundEnabled={soundEnabled} onToggleSound={onToggleSound} onBack={onBack} />
          )}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          <p className={styles.hint}>{view === "main" ? "Escape resumes the mission" : "Escape returns to the pause menu"}</p>
        </MetalPanel>
      )}
    </div>
  );
}
