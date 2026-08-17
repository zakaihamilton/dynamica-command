import type { ElementType, HTMLAttributes } from "react";
import { cx } from "@/lib/ui/cx";
import styles from "./ConsoleLabel.module.css";

type Props = HTMLAttributes<HTMLElement> & { as?: ElementType };

export function ConsoleLabel({ as: Tag = "p", className, ...props }: Props) {
  return <Tag className={cx(styles.label, className)} {...props} />;
}
