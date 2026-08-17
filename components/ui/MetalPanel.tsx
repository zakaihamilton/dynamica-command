import type { ElementType, HTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";
import styles from "./MetalPanel.module.css";

type Props = HTMLAttributes<HTMLElement> & { as?: ElementType };

export function MetalPanel({ as: Tag = "div", className, ...props }: Props) {
  return <Tag className={cx(styles.panel, className)} {...props} />;
}
