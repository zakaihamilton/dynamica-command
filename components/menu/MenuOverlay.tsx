import type { RefObject } from "react";
import type { AudioVolumeKey } from "@/lib/audio/mixer";
import type { GameSettings } from "@/lib/persist/settings";
import { MenuOptions } from "./MenuOptions";
import { NewGameSetup } from "./NewGameSetup";
import styles from "./MenuOverlay.module.css";

export type MenuView = "main" | "newGame" | "options";

export function MenuOverlay({
  view,
  code,
  error,
  previewLine,
  inputRef,
  settings,
  onChange,
  onRandomize,
  onLaunch,
  onOperations,
  onToggleSound,
  onToggleMusic,
  onVolumeChange,
  onBack,
}: {
  view: MenuView;
  code: string;
  error: string;
  previewLine: string;
  inputRef: RefObject<HTMLInputElement | null>;
  settings: GameSettings;
  onChange: (value: string) => void;
  onRandomize: () => void;
  onLaunch: () => void;
  onOperations?: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onVolumeChange: (key: AudioVolumeKey, value: number) => void;
  onBack: () => void;
}) {
  if (view === "main") return null;

  return (
    <div className={styles.overlay}>
      {view === "newGame" ? (
        <NewGameSetup
          code={code}
          error={error}
          previewLine={previewLine}
          inputRef={inputRef}
          onChange={onChange}
          onRandomize={onRandomize}
          onLaunch={onLaunch}
          onOperations={onOperations}
          onBack={onBack}
        />
      ) : (
        <MenuOptions
          settings={settings}
          onToggleSound={onToggleSound}
          onToggleMusic={onToggleMusic}
          onVolumeChange={onVolumeChange}
          onBack={onBack}
        />
      )}
    </div>
  );
}
