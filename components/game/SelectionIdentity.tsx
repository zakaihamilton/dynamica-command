import { UNIT_STATS, labelFor } from "@/lib/catalog";
import type { BuildingKind, Entity, FactionVisualProfile, Palette, Stance, UnitKind } from "@/lib/types";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { SpritePreview } from "./SpritePreview";
import styles from "./SelectionPanel.module.css";

export function SelectionIdentity({
  selected,
  palette,
  profile,
  stance,
}: {
  selected: Entity;
  palette: Palette;
  profile: FactionVisualProfile;
  stance: Stance;
}) {
  return (
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
  );
}
