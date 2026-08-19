import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT, type CommandTab } from "@/lib/ui/shortcuts";
import styles from "./CommandTabs.module.css";

function CommandTabIcon({ type }: { type: CommandTab | "repair" | "sell" }) {
  if (type === "construction") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M5 20h14M7 17h10M9 17V8l3-3 3 3v9M6 8h12M12 5V2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }
  if (type === "selected") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M8 5H5v3M16 5h3v3M19 16v3h-3M8 19H5v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        <path d="M9 8h6v8H9z" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
  if (type === "sell") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <g transform="translate(24 0) scale(-1 1)">
          <path d="M12 3v18M9 8c0-1.6 1.4-2.6 3-2.6s3 1 3 2.6-1.3 2.3-3 2.3-3 1-3 2.6 1.4 2.6 3 2.6 3-1 3-2.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </g>
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
  sellMode,
  onConstruction,
  onProduction,
  onSelected,
  onRepair,
  onSell,
}: {
  activeTab: CommandTab;
  repairMode: boolean;
  sellMode: boolean;
  onConstruction: () => void;
  onProduction: () => void;
  onSelected: () => void;
  onRepair: () => void;
  onSell: () => void;
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
        role="tab"
        aria-selected={activeTab === "selected"}
        aria-label="Selected"
        data-testid="tab-selected"
        tooltip="Selected"
        shortcut={SHORTCUT.selected}
        aria-keyshortcuts="t"
        muted={activeTab !== "selected"}
        className={styles.tab}
        onClick={onSelected}
      >
        <CommandTabIcon type="selected" />
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
      <ConsoleButton
        aria-pressed={sellMode}
        aria-label="Sell structures"
        data-testid="sell-mode"
        tooltip="Sell structures. Click a finished building to scrap it for credits."
        shortcut={SHORTCUT.sell}
        aria-keyshortcuts="f"
        muted={!sellMode}
        className={styles.tab}
        onClick={onSell}
      >
        <CommandTabIcon type="sell" />
      </ConsoleButton>
    </div>
  );
}
