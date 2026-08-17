import { cx } from "@/lib/ui/cx";
import styles from "./AssetChip.module.css";

export function AssetChip({
  active,
  tooltip,
  onClick,
  children,
}: {
  active: boolean;
  tooltip: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={cx(styles.chip, active && styles.active)}
      data-tooltip={tooltip}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
