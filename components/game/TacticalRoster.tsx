import { useMemo, useState } from "react";
import { missionLossMessage } from "@/lib/sim/debrief";
import { fogAt } from "@/lib/sim/fog";
import { terrainAccess } from "@/lib/sim/world";
import type { Entity, SimState } from "@/lib/types";
import { FORMATION_IDS, STANCE_IDS } from "@/lib/ui/orders";
import { tileCoords } from "@/lib/ui/tileCoords";
import { useAnnouncement } from "@/components/ui/useAnnouncement";
import type { GameActions } from "./hooks/useGameActions";
import type { GameCamera } from "./hooks/useGameCamera";
import styles from "./TacticalRoster.module.css";

function entityStatus(entity: Entity): string {
  if (entity.constructing > 0) return "constructing";
  if (entity.producing) return `producing ${entity.producing.kind}`;
  if (entity.attackTarget !== undefined) return "engaging";
  if (entity.orderMode) return entity.orderMode === "attackMove" ? "attack-moving" : entity.orderMode;
  return entity.idle ? "idle" : "active";
}

function visibleEntity(state: SimState, entity: Entity): boolean {
  const { x, y } = tileCoords(entity);
  return fogAt(state, x, y) === 2;
}

export function rosterEntities(state: SimState): Entity[] {
  return state.entities
    .filter((entity) => entity.hp > 0)
    .filter((entity) => {
      if (entity.owner === 0 && !entity.neutral) return true;
      return visibleEntity(state, entity) && (
        entity.owner === 1 || entity.neutral === true || entity.kind === "objective" || entity.marked
      );
    })
    .sort((a, b) => a.owner - b.owner || a.class.localeCompare(b.class) || a.id - b.id);
}

export function TacticalRoster({
  state,
  selectedIds,
  actions,
  camera,
  announcement,
  onSelect,
  onAnnounce,
}: {
  state: SimState;
  selectedIds: number[];
  actions: GameActions;
  camera: GameCamera;
  announcement: string;
  onSelect: (ids: number[]) => void;
  onAnnounce: (message: string) => void;
}) {
  // Set/Map snapshots keep per-tick renders O(n) instead of O(n*m).
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const entityById = useMemo(() => new Map(state.entities.map((entity) => [entity.id, entity])), [state]);
  const entities = useMemo(() => rosterEntities(state), [state]);
  const selectedEntity = entities.find((entity) => selectedIdSet.has(entity.id));
  const [x, setX] = useState(() => selectedEntity ? Math.round(selectedEntity.x) : 0);
  const [y, setY] = useState(() => selectedEntity ? Math.round(selectedEntity.y) : 0);
  const [localAnnouncement, announce] = useAnnouncement(onAnnounce);

  const selectedUnits = [...selectedIdSet].filter((id) => {
    const entity = entityById.get(id);
    return entity?.owner === 0 && entity.class === "unit" && !entity.neutral && entity.hp > 0;
  });
  const coordinateAccess = terrainAccess(state, x, y);
  const coordinateValid = Number.isInteger(x) && Number.isInteger(y) && coordinateAccess.traversable;
  const harvestCoordinateValid = coordinateValid && coordinateAccess.label === "Ore field";
  const resultAnnouncement = state.result === "playing"
    ? ""
    : state.result === "won" ? "Mission complete." : `Mission lost: ${missionLossMessage(state)}`;
  const liveAnnouncement = resultAnnouncement || announcement || localAnnouncement;
  const issueCoordinate = (command: "move" | "attackMove" | "harvest") => {
    if (!coordinateValid || (command === "harvest" && !harvestCoordinateValid)) {
      announce(command === "harvest" ? "Command rejected: choose an ore-field coordinate." : "Command rejected: choose a traversable map coordinate.");
      return;
    }
    const issued = actions.issueCoordinateCommand(command, x, y);
    announce(issued ? `${command === "attackMove" ? "Attack-move" : command === "harvest" ? "Harvest" : "Move"} command accepted at ${x}, ${y}.` : "Command rejected: select a live friendly unit.");
  };

  const selectEntity = (entity: Entity) => {
    const { x: tx, y: ty } = tileCoords(entity);
    onSelect([entity.id]);
    setX(tx);
    setY(ty);
    announce(`Selected ${entity.kind} at ${tx}, ${ty}.`);
  };

  return (
    <aside className={styles.roster} aria-label="Tactical roster" data-testid="tactical-roster">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Accessibility channel</p>
          <h2>Tactical roster</h2>
        </div>
        <span className={styles.count}>{entities.length}</span>
      </div>
      <div className={styles.live} aria-live="polite" aria-atomic="true">{liveAnnouncement}</div>
      <div className={styles.entityList} role="list" aria-label="Visible battlefield entities">
        {entities.map((entity) => {
          const isSelected = selectedIdSet.has(entity.id);
          const { x: ex, y: ey } = tileCoords(entity);
          const faction = entity.neutral ? "Neutral" : state.factions[entity.owner].name;
          const role = entity.scenarioRole ?? (entity.marked ? "marked target" : entity.kind === "objective" ? "objective" : "—");
          const oreField = terrainAccess(state, ex, ey).label === "Ore field";
          return (
            <div
              key={entity.id}
              className={`${styles.entity} ${isSelected ? styles.selected : ""}`}
              role="listitem"
              data-selected={isSelected}
              data-owner={entity.neutral ? "neutral" : String(entity.owner)}
            >
              <div className={styles.entityInfo}>
                <strong>{entity.kind}</strong>
                <span>{faction} · {entity.hp}/{entity.maxHp} HP · {entityStatus(entity)}</span>
                <span>Coords {ex}, {ey} · Role {role}</span>
              </div>
              <div className={styles.rowActions}>
                <button type="button" onClick={() => selectEntity(entity)} aria-label={`Select ${entity.kind} ${entity.id}`}>
                  {isSelected ? "Selected" : "Select"}
                </button>
                <button type="button" onClick={() => { camera.centerSelection(new Set([entity.id])); announce(`Centered camera on ${entity.kind}.`); }}>
                  Center
                </button>
                {entity.owner === 1 ? (
                  <button type="button" onClick={() => {
                    const issued = actions.issueTargetCommand("attack", entity.id);
                    announce(issued ? `Attack command accepted for ${entity.kind}.` : "Command rejected: select a live friendly unit.");
                  }} disabled={!selectedUnits.length}>Attack</button>
                ) : null}
                {entity.owner === 0 && entity.class === "unit" && !entity.neutral && entity.id !== selectedEntity?.id ? (
                  <button type="button" onClick={() => {
                    const issued = actions.issueTargetCommand("support", entity.id);
                    announce(issued ? `Support command accepted for ${entity.kind}.` : "Command rejected: select a support unit.");
                  }} disabled={!selectedUnits.length}>Support</button>
                ) : null}
                {oreField ? (
                  <button type="button" onClick={() => {
                    const issued = actions.issueCoordinateCommand("harvest", ex, ey);
                    announce(issued ? `Harvest command accepted at ${ex}, ${ey}.` : "Command rejected: select a harvester.");
                  }} disabled={!selectedUnits.length}>Harvest</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <section className={styles.commands} aria-labelledby="roster-command-title">
        <h3 id="roster-command-title">Selected command</h3>
        <div className={styles.commandGrid}>
          <button type="button" onClick={() => { actions.issueSelectedCommand("stop"); announce("Stop command accepted."); }} disabled={!selectedUnits.length}>Stop</button>
          {STANCE_IDS.map((stance) => (
            <button key={stance} type="button" onClick={() => { actions.issueSelectedCommand("stance", stance); announce(`Stance set to ${stance}.`); }} disabled={!selectedUnits.length}>{stance}</button>
          ))}
          {FORMATION_IDS.map((formation) => (
            <button key={formation} type="button" onClick={() => { actions.issueSelectedCommand("formation", formation); announce(`Formation set to ${formation}.`); }} disabled={!selectedUnits.length}>{formation}</button>
          ))}
        </div>
        <div className={styles.coordinates}>
          <label>X <input type="number" min={0} max={state.width - 1} value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
          <label>Y <input type="number" min={0} max={state.height - 1} value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
        </div>
        <div className={styles.commandGrid}>
          <button type="button" onClick={() => issueCoordinate("move")} disabled={!selectedUnits.length || !coordinateValid}>Move</button>
          <button type="button" onClick={() => issueCoordinate("attackMove")} disabled={!selectedUnits.length || !coordinateValid}>Attack-move</button>
          <button type="button" onClick={() => issueCoordinate("harvest")} disabled={!selectedUnits.length || !harvestCoordinateValid}>Harvest coords</button>
        </div>
      </section>
    </aside>
  );
}
