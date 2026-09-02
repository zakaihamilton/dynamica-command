import type { CSSProperties } from "react";
import { labelFor, type CameoStatus } from "@/lib/catalog";
import { cx } from "@/lib/ui/cx";
import type { BuildingKind, FactionVisualProfile, Palette, UnitKind } from "@/lib/types";
import { SpritePreview } from "./SpritePreview";
import styles from "./CommandCameo.module.css";

export function CommandCameo({
  kind,
  palette,
  profile,
  cost,
  disabled,
  disabledReason,
  active,
  cameo,
  shortcut,
  onClick,
  onContextMenu,
}: {
  kind: BuildingKind | UnitKind;
  palette: Palette;
  profile: FactionVisualProfile;
  cost: number;
  disabled?: boolean;
  disabledReason?: string;
  active?: boolean;
  cameo: CameoStatus;
  shortcut?: string;
  onClick: () => void;
  onContextMenu?: () => void;
}) {
  const busy = cameo.phase !== "idle";
  const showCount = cameo.queued > 1 || cameo.phase === "waiting";
  const tooltip = `${labelFor(kind)} · ${cost} credits${busy ? (cameo.phase === "waiting" ? ` · ${cameo.queued} in queue` : ` · ${Math.round(cameo.ratio * 100)}% complete`) : ""}${busy || active ? " · Right-click to cancel" : ""}${disabledReason ? ` · ${disabledReason}` : ""}`;
  const ariaStatus = disabledReason ? `, ${disabledReason}` : "";
  return (
    <span
      className={styles.wrap}
      data-tooltip={tooltip}
      data-shortcut={shortcut}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.();
      }}
    >
      <button
        type="button"
        disabled={disabled}
        className={cx(styles.card, active && styles.active, busy && styles.busy)}
        onClick={onClick}
        aria-label={`${labelFor(kind)}, ${cost} credits${busy ? `, ${cameo.phase === "waiting" ? `${cameo.queued} in queue` : `${Math.round(cameo.ratio * 100)} percent complete`}` : ""}${busy || active ? ", right-click to cancel" : ""}${ariaStatus}`}
        aria-keyshortcuts={shortcut}
      >
        <span className={styles.art}>
          <SpritePreview kind={kind} palette={palette} profile={profile} className={styles.sprite} />
          {busy ? (
            <span
              className={cx(styles.progress, cameo.phase === "waiting" && styles.waiting)}
              style={{ "--cameo-remain": `${Math.max(0, (1 - cameo.ratio) * 100)}%` } as CSSProperties}
              data-testid={`cameo-progress-${kind}`}
              data-phase={cameo.phase}
              data-queued={cameo.queued}
            />
          ) : null}
          {showCount ? <span className={styles.count}>{cameo.queued}</span> : null}
        </span>
        <span className={styles.caption}>
          <span>{labelFor(kind)}</span>
          <b>{cost}</b>
        </span>
      </button>
    </span>
  );
}
