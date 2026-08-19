import styles from "./MenuScreen.module.css";

export function MenuHero() {
  return (
    <>
      <h1 className={styles.title}>GENESIS</h1>
      <h1 className={styles.subtitle}>PROTOCOL</h1>
      <p className={styles.tagline}>Harvest. Build. Conquer.</p>
    </>
  );
}
