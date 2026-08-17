import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";
import styles from "./ConsoleButton.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  muted?: boolean;
  tooltip?: string;
  shortcut?: string;
  tooltipPos?: string;
};

export function ConsoleButton({
  muted,
  tooltip,
  shortcut,
  tooltipPos,
  className,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cx(styles.button, muted && styles.muted, className)}
      data-tooltip={tooltip}
      data-shortcut={shortcut}
      data-tooltip-pos={tooltipPos}
      {...props}
    />
  );
}
