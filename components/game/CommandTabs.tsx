import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./CommandTabs.module.css";

function CommandTabIcon({ type }: { type: "construction" | "production" | "repair" }) {
  if (type === "construction") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M5 20h14M7 17h10M9 17V8l3-3 3 3v9M6 8h12M12 5V2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }
  if (type === "repair") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M8 4.5l3 3-6.5 6.5-3-3L8 4.5zM14.5 13.5l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M7 7.5l2 2M16.5 15.5l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M3 20h18M5 20v-8h5v8M14 20V8h5v12M5 12l3-4 3 3 4-6 4 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M16 4h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

export function CommandTabs({
  activeTab,
  repairMode,
  onConstruction,
  onProduction,
  onRepair,
}: {
  activeTab: "construction" | "production";
  repairMode: boolean;
  onConstruction: () => void;
  onProduction: () => void;
  onRepair: () => void;
}) {
  return (
    <div className={styles.tabs} role="toolbar" aria-label="Command options">
      <ConsoleButton
        role="tab"
        aria-selected={activeTab === "construction"}
        aria-label="Construction"
        tooltip="Construction"
        shortcut={SHORTCUT.construction}
        aria-keyshortcuts="q"
        muted={activeTab !== "construction"}
        className={styles.tab}
        onClick={onConstruction}
      >
        <CommandTabIcon type="construction" />
      </ConsoleButton>
      <ConsoleButton
        role="tab"
        aria-selected={activeTab === "production"}
        aria-label="Production"
        tooltip="Production"
        shortcut={SHORTCUT.production}
        aria-keyshortcuts="e"
        muted={activeTab !== "production"}
        className={styles.tab}
        onClick={onProduction}
      >
        <CommandTabIcon type="production" />
      </ConsoleButton>
      <ConsoleButton
        aria-pressed={repairMode}
        aria-label="Repair structures"
        data-testid="repair-mode"
        tooltip="Repair structures. Click a damaged building to start or stop."
        shortcut={SHORTCUT.repair}
        aria-keyshortcuts="r"
        muted={!repairMode}
        className={styles.tab}
        onClick={onRepair}
      >
        <CommandTabIcon type="repair" />
      </ConsoleButton>
    </div>
  );
}
