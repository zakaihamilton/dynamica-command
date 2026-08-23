"use client";

import type { CSSProperties } from "react";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuHero } from "./MenuHero";
import { MenuMainPanel } from "./MenuMainPanel";
import { MenuOverlay } from "./MenuOverlay";
import { useMenuController } from "./useMenuController";
import styles from "./MenuScreen.module.css";

export function MenuScreen() {
  const controller = useMenuController();

  return (
    <div
      className={styles.screen}
      style={{ "--scene-art": `url("${RASTER_ART.menu}")` } as CSSProperties}
    >
      <MenuBackdrop />
      <div className={styles.vignette} />
      <div className={styles.scanlines} />

      <div className={styles.content}>
        <MenuHero />
        <MenuMainPanel
          saves={controller.saves}
          unreadableSaves={controller.unreadableSaves}
          onNewGame={controller.openNewGame}
          onOptions={controller.openOptions}
          onResume={controller.resume}
          onDelete={controller.deleteSave}
          onResetUnreadable={controller.resetUnreadableSave}
        />
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
        onToggleSound={controller.toggleSound}
        onToggleMusic={controller.toggleMusic}
        onVolumeChange={controller.updateVolume}
        onBack={controller.goBack}
      />
    </div>
  );
}
