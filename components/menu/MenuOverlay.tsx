import type { RefObject } from "react";
import type { AudioVolumeKey } from "@/lib/audio/mixer";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign } from "@/lib/types";
import { MenuOptions } from "./MenuOptions";
import { NewGameSetup } from "./NewGameSetup";
import styles from "./MenuOverlay.module.css";

export type MenuView = "main" | "newGame" | "options";

export function MenuOverlay({
  view,
  code,
  error,
  campaign,
  inputRef,
  settings,
  onChange,
  onRandomize,
  onLaunch,
  onToggleSound,
  onToggleMusic,
  onToggleTacticalRoster,
  onVolumeChange,
  onBack,
}: {
  view: MenuView;
  code: string;
  error: string;
  campaign: Campaign | null;
  inputRef: RefObject<HTMLInputElement | null>;
  settings: GameSettings;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleTacticalRoster?: () => void;
  onVolumeChange: (key: AudioVolumeKey, value: number) => void;
  onBack: () => void;
}) {
  if (view === "main") return null;

  return (
    <div className={styles.overlay} data-testid="menu-overlay" data-view={view}>
      {view === "newGame" ? (
        <div className={styles.deployStage}>
          <NewGameSetup
            code={code}
            error={error}
            campaign={campaign}
            inputRef={inputRef}
            onChange={onChange}
            onRandomize={onRandomize}
            onLaunch={onLaunch}
            onBack={onBack}
          />
        </div>
      ) : (
        <MenuOptions
          settings={settings}
          onToggleSound={onToggleSound}
          onToggleMusic={onToggleMusic}
          onToggleTacticalRoster={onToggleTacticalRoster}
          onVolumeChange={onVolumeChange}
          onBack={onBack}
        />
      )}
    </div>
  );
}
