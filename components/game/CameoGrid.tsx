import type { ReactNode } from "react";
import styles from "./CameoGrid.module.css";

export function CameoGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
