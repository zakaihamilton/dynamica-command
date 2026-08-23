import type { GameSettings } from "@/lib/persist/settings";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { Palette } from "@/lib/types";
import { PauseMenu } from "./PauseMenu";
import type { GameSession } from "./hooks/useGameSession";

export function GamePauseSurface({
  view,
  notice,
  settings,
  palette,
  seed,
  missionIndex,
  setView,
  setNotice,
  session,
}: {
  view: PauseView;
  notice: string;
  settings: GameSettings;
  palette: Palette;
  seed: number;
  missionIndex: number;
  setView: (view: PauseView) => void;
  setNotice: (notice: string) => void;
  session: GameSession;
}) {
  return (
    <PauseMenu
      view={view}
      notice={notice}
      settings={settings}
      palette={palette}
      seed={seed}
      missionIndex={missionIndex}
      onResume={session.resumeMission}
      onSave={session.saveMission}
      onLoad={session.loadMission}
      onBriefing={session.viewMissionBriefing}
      onRestart={session.restartMission}
      onAssets={() => {
        setView("assets");
        setNotice("");
      }}
      onSoundtrack={() => {
        setView("soundtrack");
        setNotice("");
      }}
      onOptions={() => {
        setView("options");
        setNotice("");
      }}
      onMenu={session.goMenu}
      onToggleSound={session.toggleSound}
      onToggleMusic={session.toggleMusic}
      onVolumeChange={session.updateVolume}
      onBack={() => setView("main")}
      onCloseAssets={() => setView("main")}
    />
  );
}
