import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT, type CommandTab } from "@/lib/ui/shortcuts";
import { CommandTabIcon } from "./CommandTabIcon";
import styles from "./CommandTabs.module.css";

function CommandBarButton({
  icon,
  label,
  shortcut,
  keyshortcuts,
  testId,
  tooltip,
  selected,
  pressed,
  onClick,
}: {
  icon: CommandTab | "repair" | "sell";
  label: string;
  shortcut: string;
  keyshortcuts: string;
  testId?: string;
  tooltip: string;
  selected?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  const on = selected ?? pressed ?? false;
  return (
    <ConsoleButton
      role={selected === undefined ? undefined : "tab"}
      aria-selected={selected}
      aria-pressed={pressed}
      aria-label={label}
      data-testid={testId}
      tooltip={tooltip}
      shortcut={shortcut}
      aria-keyshortcuts={keyshortcuts}
      muted={!on}
      className={styles.tab}
      onClick={onClick}
    >
      <CommandTabIcon type={icon} />
    </ConsoleButton>
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
      <CommandBarButton
        icon="construction"
        label="Construction"
        shortcut={SHORTCUT.construction}
        keyshortcuts="q"
        tooltip="Build structures"
        selected={activeTab === "construction"}
        onClick={onConstruction}
      />
      <CommandBarButton
        icon="production"
        label="Production"
        shortcut={SHORTCUT.production}
        keyshortcuts="e"
        tooltip="Train units"
        selected={activeTab === "production"}
        onClick={onProduction}
      />
      <CommandBarButton
        icon="selected"
        label="Selected"
        shortcut={SHORTCUT.selected}
        keyshortcuts="t"
        testId="tab-selected"
        tooltip="Selected units"
        selected={activeTab === "selected"}
        onClick={onSelected}
      />
      <CommandBarButton
        icon="repair"
        label="Repair structures"
        shortcut={SHORTCUT.repair}
        keyshortcuts="r"
        testId="repair-mode"
        tooltip="Repair structures. Click a damaged building to start or stop."
        pressed={repairMode}
        onClick={onRepair}
      />
      <CommandBarButton
        icon="sell"
        label="Sell structures"
        shortcut={SHORTCUT.sell}
        keyshortcuts="f"
        testId="sell-mode"
        tooltip="Sell structures. Click a finished building to scrap it for credits."
        pressed={sellMode}
        onClick={onSell}
      />
    </div>
  );
}
