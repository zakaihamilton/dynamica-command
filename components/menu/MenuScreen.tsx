"use client";

import type { CSSProperties } from "react";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { MenuHero } from "./MenuHero";
import { MenuMainPanel } from "./MenuMainPanel";
import { MenuOverlay } from "./MenuOverlay";
import { MenuSignalOverlay } from "./MenuSignalOverlay";
import { useMenuController } from "./useMenuController";
import styles from "./MenuScreen.module.css";

export function MenuScreen() {
  const controller = useMenuController();

  return (
    <div
      className={styles.screen}
      style={{ "--scene-art": `url("${RASTER_ART.menu}")` } as CSSProperties}
    >
      <div className={styles.scene} />
      <MenuSignalOverlay />
      <div className={styles.vignette} />

      <div className={styles.uiLayer}>
        <header className={styles.topbar} aria-label="Dynamica command status">
          <div className={styles.topbarBrand}>
            <span className={styles.brandMark}>DC</span>
            <span className={styles.topbarMuted}>COMMAND DESK</span>
          </div>
          <div className={styles.topbarStatus}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>LOCAL THEATER LINK</span>
            <span className={styles.topbarCode}>DC-01</span>
          </div>
        </header>

        <main className={styles.content}>
          <div className={styles.commandColumn}>
            <MenuHero />
            <MenuMainPanel
              onNewGame={controller.openNewGame}
              onTutorial={controller.openTutorial}
              onLoadMission={controller.openLoadMission}
              onOptions={controller.openOptions}
            />
          </div>
        </main>

        <footer className={styles.footer}>
          <span>SEED YOUR OWN THEATER</span>
          <span className={styles.footerRule} aria-hidden="true" />
          <span>8 OPERATIONS / NO TWO WARS ALIKE</span>
          <span className={styles.footerVersion}>BUILD 01.04 // LOCAL ONLY</span>
        </footer>
      </div>

      <MenuOverlay
        view={controller.view}
        code={controller.code}
        error={controller.error}
        previewLine={controller.previewLine}
        inputRef={controller.inputRef}
        settings={controller.settings}
        onChange={controller.setCode}
        onRandomize={controller.randomize}
        onLaunch={controller.launch}
        onOperations={controller.openOperations}
        onToggleSound={controller.toggleSound}
        onToggleMusic={controller.toggleMusic}
        onToggleTacticalRoster={controller.toggleTacticalRoster}
        onVolumeChange={controller.updateVolume}
        onBack={controller.goBack}
      />
    </div>
  );
}
