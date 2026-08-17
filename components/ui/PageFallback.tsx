import styles from "./PageFallback.module.css";

export function PageFallback({ children }: { children: string }) {
  return <div className={styles.root}>{children}</div>;
}
