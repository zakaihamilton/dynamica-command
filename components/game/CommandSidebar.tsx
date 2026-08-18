import type { PointerEventHandler, Ref } from "react";
import { BUILDING_STATS, UNIT_STATS, buildingCameoStatus, unitCameoStatus } from "@/lib/catalog";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { BuildingKind, Entity, FactionVisualProfile, Palette, SimState, UnitKind } from "@/lib/types";
import { CameoGrid } from "./CameoGrid";
import { CommandTabs } from "./CommandTabs";
import { CommandCameo } from "./CommandCameo";
import { MinimapFrame } from "./MinimapFrame";
import { ResourceDock } from "./ResourceDock";
import { SelectionPanel } from "./SelectionPanel";
import styles from "./CommandSidebar.module.css";

const PLACEABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];
const PRODUCIBLE: UnitKind[] = ["infantry", "antiArmor", "harvester", "tank"];

export function CommandSidebar({
  factionName,
  state,
  palette,
  profile,
  selected,
  placeKind,
  repairMode,
  sellMode,
  activeTab,
  power,
  produced,
  used,
  miniRef,
  onPause,
  onMinimapPointerDown,
  onMinimapPointerMove,
  onMinimapPointerUp,
  onTab,
  onRepair,
  onSell,
  onPlace,
  onCancelBuilding,
  onQueueUnit,
  onCancelUnit,
  availableProducer,
}: {
  factionName: string;
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  selected: Entity | undefined;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  activeTab: "construction" | "production";
  power: number;
  produced: number;
  used: number;
  miniRef: Ref<HTMLCanvasElement>;
  onPause: () => void;
  onMinimapPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onTab: (tab: "construction" | "production") => void;
  onRepair: () => void;
  onSell: () => void;
  onPlace: (kind: BuildingKind) => void;
  onCancelBuilding: (kind: BuildingKind) => void;
  onQueueUnit: (unit: UnitKind) => void;
  onCancelUnit: (unit: UnitKind) => void;
  availableProducer: (unit: UnitKind) => Entity | undefined;
}) {
  return (
    <aside className={styles.sidebar} data-testid="command-sidebar">
      <span className={styles.rail} aria-hidden />
      <button
        type="button"
        className={styles.header}
        data-tooltip="Open pause menu"
        data-shortcut={SHORTCUT.pause}
        onClick={onPause}
        aria-label="Open Genesis Command pause menu"
        aria-keyshortcuts="Escape"
      >
        <p className={styles.title}>GENESIS COMMAND</p>
        <p className={styles.faction}>{factionName}</p>
      </button>

      <div className={styles.radarSlot}>
        <MinimapFrame
          canvasRef={miniRef}
          onPointerDown={onMinimapPointerDown}
          onPointerMove={onMinimapPointerMove}
          onPointerUp={onMinimapPointerUp}
        />
      </div>

      <div className={styles.resourceSlot}>
        <ResourceDock credits={state.credits[0]} produced={produced} used={used} surplus={power} />
      </div>

      <section className={styles.build} data-testid="build-progress">
        <CommandTabs
          activeTab={activeTab}
          repairMode={repairMode}
          sellMode={sellMode}
          onConstruction={() => onTab("construction")}
          onProduction={() => onTab("production")}
          onRepair={onRepair}
          onSell={onSell}
        />
        {activeTab === "construction" ? (
          <CameoGrid>
            {PLACEABLE.map((kind, index) => {
              const cameo = buildingCameoStatus(state.entities, 0, kind);
              return (
                <CommandCameo
                  key={kind}
                  kind={kind}
                  palette={palette}
                  profile={profile}
                  cost={BUILDING_STATS[kind].cost}
                  disabled={cameo.phase === "idle" && state.credits[0] < BUILDING_STATS[kind].cost}
                  active={placeKind === kind}
                  cameo={cameo}
                  shortcut={SHORTCUT.cameo[index]}
                  onClick={() => onPlace(kind)}
                  onContextMenu={() => onCancelBuilding(kind)}
                />
              );
            })}
          </CameoGrid>
        ) : (
          <CameoGrid>
            {PRODUCIBLE.map((unit, index) => {
              const cameo = unitCameoStatus(state.entities, 0, unit);
              const producer = availableProducer(unit);
              const canBuy = state.credits[0] >= UNIT_STATS[unit].cost && !!producer && power >= 0;
              return (
                <CommandCameo
                  key={unit}
                  kind={unit}
                  palette={palette}
                  profile={profile}
                  cost={UNIT_STATS[unit].cost}
                  disabled={cameo.phase === "idle" && !canBuy}
                  cameo={cameo}
                  shortcut={SHORTCUT.cameo[index]}
                  onClick={() => onQueueUnit(unit)}
                  onContextMenu={() => onCancelUnit(unit)}
                />
              );
            })}
          </CameoGrid>
        )}
      </section>

      <div className={styles.selected}>
        <SelectionPanel selected={selected} palette={palette} profile={profile} />
      </div>
    </aside>
  );
}
