import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

const ROWS: { label: string; keys: string }[] = [
  { label: "Pause / resume", keys: SHORTCUT.pause },
  { label: "Controls", keys: SHORTCUT.controls },
  { label: "Pan camera", keys: "WASD / arrows" },
  { label: "Jump to Command HQ", keys: SHORTCUT.home },
  { label: "Center selection", keys: SHORTCUT.center },
  { label: "Construction / production / selected", keys: `${SHORTCUT.construction} / ${SHORTCUT.production} / ${SHORTCUT.selected}` },
  { label: "Cameos", keys: SHORTCUT.cameo.join("–") },
  { label: "Repair / sell / stop", keys: `${SHORTCUT.repair} / ${SHORTCUT.sell} / ${SHORTCUT.stop}` },
  { label: "Select", keys: "Left click / drag" },
  { label: "Select all of type", keys: "Double-click" },
  { label: "Move / attack / harvest", keys: "Right click" },
  { label: "Attack-move", keys: "Ctrl + right click" },
];

export function PauseControls({ onBack }: { onBack: () => void }) {
  return (
    <>
      <ConsoleLabel>Field manual</ConsoleLabel>
      <h2 id="pause-title" className={styles.title}>Controls</h2>
      <dl className={styles.controlList} data-testid="pause-controls">
        {ROWS.map((row) => (
          <div className={styles.controlRow} key={row.label}>
            <dt>{row.label}</dt>
            <dd><kbd>{row.keys}</kbd></dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <ConsoleButton muted className={styles.action} tooltip="Return to the pause menu" shortcut={SHORTCUT.back} onClick={onBack}>
          Back
        </ConsoleButton>
      </div>
    </>
  );
}
