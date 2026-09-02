import type { ElementType, HTMLAttributes, Ref } from "react";
import { cx } from "@/lib/ui/cx";
import styles from "./MetalPanel.module.css";

type Props = HTMLAttributes<HTMLElement> & { as?: ElementType; ref?: Ref<HTMLElement> };

export function MetalPanel({ as: Tag = "div", className, ...props }: Props) {
  return <Tag className={cx(styles.panel, className)} {...props} />;
}
