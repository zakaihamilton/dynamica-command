"use client";

import type { CSSProperties } from "react";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuHero } from "./MenuHero";
import { MenuMainPanel } from "./MenuMainPanel";
import { MenuOverlay } from "./MenuOverlay";
import { SaveImportDialog } from "./SaveImportDialog";
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
          onCampaignMap={controller.openCampaign}
          onDelete={controller.deleteSave}
          onResetUnreadable={controller.resetUnreadableSave}
          onImportFile={controller.handleImportFile}
          importError={controller.importError}
          importNotice={controller.importNotice}
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
        onOperations={controller.openOperations}
        onToggleSound={controller.toggleSound}
        onToggleMusic={controller.toggleMusic}
        onToggleTacticalRoster={controller.toggleTacticalRoster}
        onVolumeChange={controller.updateVolume}
        onBack={controller.goBack}
      />
      {controller.importPreview ? (
        <SaveImportDialog
          fileName={controller.importPreview.fileName}
          save={controller.importPreview.save}
          collision={controller.importPreview.collision}
          error={controller.importError}
          onConfirm={controller.confirmImport}
          onCancel={controller.cancelImport}
        />
      ) : null}
    </div>
  );
}
