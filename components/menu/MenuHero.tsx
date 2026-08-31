import styles from "./MenuScreen.module.css";

export function MenuHero() {
  return (
    <div className={styles.hero}>
      <h1 className={styles.title}>GENESIS</h1>
      <p className={styles.subtitle}>PROTOCOL</p>
      <p className={styles.tagline}>Harvest. Build. Conquer.</p>
      <p className={styles.meta}>SEED YOUR OWN THEATER · 8 OPERATIONS · NO TWO WARS ALIKE</p>
    </div>
  );
}
