import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, TICKS_PER_SECOND, UNIT_STATS, labelFor } from "@/lib/catalog";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { cx } from "@/lib/ui/cx";
import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, Stance, UnitKind } from "@/lib/types";
import { SpritePreview } from "./SpritePreview";
import styles from "./SelectionPanel.module.css";

const STANCES: { id: Stance; label: string }[] = [
  { id: "aggressive", label: "Aggressive" },
  { id: "defensive", label: "Defend" },
  { id: "hold", label: "Hold" },
];

const FORMATIONS: { id: Formation; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "column", label: "Column" },
  { id: "wedge", label: "Wedge" },
];

export function SelectionPanel({
  selected,
  palette,
  profile,
  className,
  onStop,
  onStance,
  onFormation,
}: {
  selected: Entity | undefined;
  palette: Palette;
  profile: FactionVisualProfile;
  className?: string;
  onStop?: () => void;
  onStance?: (stance: Stance) => void;
  onFormation?: (formation: Formation) => void;
}) {
  const friendlyUnit = selected && selected.owner === 0 && selected.class === "unit" && !selected.neutral;
  const stance = selected?.stance ?? "aggressive";
  const formation = selected?.formation;
  return (
    <section className={cx(styles.section, className)}>
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
              ) : selected.marked && selected.class === "unit" ? (
                <span className={styles.warning} data-testid="selected-status">Cargo — return to extraction zone</span>
              ) : selected.class === "unit" ? <span className={styles.stat}>Stance {stance}</span> : null}
              {(selected.suppression ?? 0) > 0 ? <span className={styles.stat}>Suppressed {Math.ceil(selected.suppression ?? 0)}%</span> : null}
              {selected.kind === "harvester" ? (
                <span className={styles.carry}>
                  Carry {selected.carry} / {UNIT_STATS.harvester.carryMax}
                </span>
              ) : null}
            </div>
          </div>
          {selected.class === "unit" ? (
            <ProgressMeter
              label="Health"
              ratio={selected.maxHp > 0 ? selected.hp / selected.maxHp : 1}
              detail={`${Math.ceil(selected.hp)} / ${selected.maxHp}`}
            />
          ) : null}
          {friendlyUnit && onStop && onStance && onFormation ? (
            <div className={styles.orders} data-testid="unit-orders">
              <ConsoleButton
                className={styles.order}
                tooltip="Stop selected units"
                shortcut={SHORTCUT.stop}
                aria-keyshortcuts="x"
                onClick={onStop}
              >
                Stop
              </ConsoleButton>
              <div className={styles.orderGroup} role="group" aria-label="Stance">
                {STANCES.map((item) => (
                  <ConsoleButton
                    key={item.id}
                    className={styles.order}
                    aria-pressed={stance === item.id}
                    muted={stance !== item.id}
                    onClick={() => onStance(item.id)}
                  >
                    {item.label}
                  </ConsoleButton>
                ))}
              </div>
              <div className={styles.orderGroup} role="group" aria-label="Formation">
                {FORMATIONS.map((item) => (
                  <ConsoleButton
                    key={item.id}
                    className={styles.order}
                    aria-pressed={formation === item.id}
                    muted={formation !== item.id}
                    onClick={() => onFormation(item.id)}
                  >
                    {item.label}
                  </ConsoleButton>
                ))}
              </div>
            </div>
          ) : null}
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
