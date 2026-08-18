import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, TICKS_PER_SECOND, UNIT_STATS, labelFor } from "@/lib/catalog";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { BuildingKind, Entity, FactionVisualProfile, Palette, UnitKind } from "@/lib/types";
import { SpritePreview } from "./SpritePreview";
import styles from "./SelectionPanel.module.css";

export function SelectionPanel({
  selected,
  palette,
  profile,
}: {
  selected: Entity | undefined;
  palette: Palette;
  profile: FactionVisualProfile;
}) {
  return (
    <section className={styles.section}>
      <ConsoleLabel className={styles.label}>Selected</ConsoleLabel>
      {selected ? (
        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.portrait}>
              <SpritePreview kind={selected.kind as BuildingKind | UnitKind} palette={palette} profile={profile} />
            </div>
            <div>
              <strong
                className={styles.name}
                data-testid="selected-kind"
                data-tooltip={labelFor(selected.kind as BuildingKind | UnitKind)}
                data-shortcut={SHORTCUT.center}
              >
                {labelFor(selected.kind as BuildingKind | UnitKind)}
              </strong>
              <span className={styles.stat}>HP {Math.ceil(selected.hp)} / {selected.maxHp}</span>
              {selected.neutral ? (
                <span className={styles.warning} data-testid="selected-status">Stranded — cannot move until freed</span>
              ) : selected.class === "unit" ? <span className={styles.stat}>Stance {selected.stance ?? "aggressive"}</span> : null}
              {(selected.suppression ?? 0) > 0 ? <span className={styles.stat}>Suppressed {Math.ceil(selected.suppression ?? 0)}%</span> : null}
              {selected.kind === "harvester" ? (
                <span className={styles.carry}>
                  Carry {selected.carry} / {UNIT_STATS.harvester.carryMax}
                </span>
              ) : null}
            </div>
          </div>
          {selected.constructing > 0 ? (
            <ProgressMeter
              label="Constructing"
              ratio={1 - selected.constructing / (BUILDING_STATS[selected.kind as BuildingKind].buildTicks || 1)}
              detail={`${Math.ceil(selected.constructing / TICKS_PER_SECOND)}s`}
            />
          ) : null}
          {selected.producing ? (
            <ProgressMeter
              label={`Produce ${labelFor(selected.producing.kind)}`}
              ratio={1 - selected.producing.remaining / (UNIT_STATS[selected.producing.kind].buildTicks || 1)}
              detail={
                (selected.queue?.length ?? 0) > 0
                  ? `Q ${(selected.queue?.length ?? 0) + 1}/${MAX_PRODUCTION_QUEUE}`
                  : `${Math.ceil(selected.producing.remaining / TICKS_PER_SECOND)}s`
              }
            />
          ) : null}
          {selected.repairing ? (
            <ProgressMeter
              label="Repairing"
              ratio={selected.maxHp > 0 ? selected.hp / selected.maxHp : 1}
            />
          ) : null}
        </div>
      ) : <p className={styles.empty}>Awaiting selection</p>}
    </section>
  );
}
