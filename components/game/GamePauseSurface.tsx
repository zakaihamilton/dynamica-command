import type { GameSettings } from "@/lib/persist/settings";
import type { PauseView } from "@/lib/ui/shortcuts";
import { PauseMenu } from "./PauseMenu";
import type { GameSession } from "./hooks/useGameSession";

export function GamePauseSurface({
  view,
  notice,
  settings,
  seed,
  missionIndex,
  setView,
  setNotice,
  session,
}: {
  view: PauseView;
  notice: string;
  settings: GameSettings;
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
      seed={seed}
      missionIndex={missionIndex}
      saveSlots={session.listSaveSlots()}
      loadEntries={session.listLoadEntries()}
      defaultSlotName={session.defaultSlotName()}
      onResume={session.resumeMission}
      onSave={session.saveMission}
      onLoad={session.loadMission}
      onCommitSave={session.saveNamedSlot}
      onLoadEntry={session.loadArchiveEntry}
      onDeleteEntry={session.deleteArchiveEntry}
      onBriefing={session.viewMissionBriefing}
      onRestart={session.restartMission}
      onControls={() => {
        setView("controls");
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
      onToggleTacticalRoster={session.toggleTacticalRoster}
      onVolumeChange={session.updateVolume}
      onBack={() => setView("main")}
    />
  );
}
