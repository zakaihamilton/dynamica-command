import styles from "./MenuScreen.module.css";

export function MenuHero() {
  return (
    <div className={styles.hero}>
      <h1 className={styles.title}>DYNAMICA</h1>
      <p className={styles.subtitle}>COMMAND</p>
      <div className={styles.heroRule} aria-hidden="true"><span /></div>
      <p className={styles.tagline}>Harvest. Build. Conquer.</p>
      <p className={styles.meta}>A seeded isometric RTS where every four-digit code writes a different war.</p>
      <div className={styles.heroReadout}>
        <span>THEATER ENGINE</span>
        <span className={styles.readoutValue}>ONLINE</span>
      </div>
    </div>
  );
}
