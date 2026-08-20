import { MetalPanel } from "@/components/ui/MetalPanel";
import { PauseOptions } from "@/components/game/PauseOptions";
import pauseStyles from "@/components/game/PauseMenu.module.css";

export function MenuOptions({
  sfxEnabled,
  musicEnabled,
  onToggleSound,
  onToggleMusic,
  onBack,
}: {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onBack: () => void;
}) {
  return (
    <MetalPanel
      className={pauseStyles.dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-options-title"
    >
      <PauseOptions
        titleId="menu-options-title"
        sfxEnabled={sfxEnabled}
        musicEnabled={musicEnabled}
        onToggleSound={onToggleSound}
        onToggleMusic={onToggleMusic}
        onBack={onBack}
        backTooltip="Return to the main menu"
      />
      <p className={pauseStyles.hint}>U toggles music · M toggles sound · Escape returns</p>
    </MetalPanel>
  );
}
