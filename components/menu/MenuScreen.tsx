"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { setMusicEnabled as applyMusicEnabled } from "@/lib/audio/music";
import { setSfxEnabled as applySfxEnabled } from "@/lib/audio/synth";
import { listSaves, listUnreadableSaves, localStorageAdapter, removeSave } from "@/lib/persist/save";
import { readCampaignProgress } from "@/lib/persist/campaign";
import { defaultSettings, readSettings, writeSettings } from "@/lib/persist/settings";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { isEditableTarget, menuCommandFromKey, SHORTCUT } from "@/lib/ui/shortcuts";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuHero } from "./MenuHero";
import { MenuOptions } from "./MenuOptions";
import { NewGameSetup } from "./NewGameSetup";
import { ResumeList } from "./ResumeList";
import styles from "./MenuScreen.module.css";

function rollSeed(): string {
  return formatSeed(Math.floor(Math.random() * 10000));
}

export function MenuScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [saves, setSaves] = useState(() => [] as ReturnType<typeof listSaves>);
  const [unreadableSaves, setUnreadableSaves] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState<"main" | "newGame" | "options">("main");
  const [settings, setSettings] = useState(() => defaultSettings());
  const seedInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storage = localStorageAdapter();
      setSaves(listSaves(storage));
      setUnreadableSaves(listUnreadableSaves(storage));
      setSettings(readSettings(localStorageAdapter()));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const preview = useMemo(() => {
    const n = parseSeed(code);
    if (n === null || code.length < 4) return null;
    return createCampaign(n);
  }, [code]);

  const openNewGame = useCallback(function openNewGame() {
    setCode((current) => current.length === 4 ? current : rollSeed());
    setError("");
    setView("newGame");
  }, []);

  const openOptions = useCallback(function openOptions() {
    setView("options");
  }, []);

  const toggleSound = useCallback(function toggleSound() {
    setSettings((current) => {
      const next = { ...current, sfxEnabled: !current.sfxEnabled };
      applySfxEnabled(next.sfxEnabled);
      writeSettings(localStorageAdapter(), next);
      return next;
    });
  }, []);

  const toggleMusic = useCallback(function toggleMusic() {
    setSettings((current) => {
      const next = { ...current, musicEnabled: !current.musicEnabled };
      applyMusicEnabled(next.musicEnabled);
      writeSettings(localStorageAdapter(), next);
      return next;
    });
  }, []);

  const randomize = useCallback(function randomize() {
    setCode(rollSeed());
    setError("");
  }, []);

  const launch = useCallback(function launch() {
    const n = parseSeed(code);
    if (n === null || code.length < 4) {
      setError("Enter a 4-digit seed (0000–9999), or roll a random theater.");
      return;
    }
    setError("");
    const progress = readCampaignProgress(localStorageAdapter(), n);
    router.push(progress.tutorialComplete ? `/briefing?seed=${formatSeed(n)}&mission=0` : `/tutorial?seed=${formatSeed(n)}`);
  }, [code, router]);

  const deleteSave = useCallback((saveSeed: string) => {
    const storage = localStorageAdapter();
    removeSave(storage, Number(saveSeed));
    setSaves(listSaves(storage));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  const resetUnreadableSave = useCallback((saveSeed: string) => {
    const storage = localStorageAdapter();
    removeSave(storage, Number(saveSeed));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = menuCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        setupOpen: view === "newGame",
        optionsOpen: view === "options",
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "newGame") openNewGame();
      else if (command.type === "options") openOptions();
      else if (command.type === "toggleSound") toggleSound();
      else if (command.type === "toggleMusic") toggleMusic();
      else if (command.type === "deploy") launch();
      else if (command.type === "randomize") randomize();
      else if (command.type === "back") setView("main");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openNewGame, openOptions, toggleSound, toggleMusic, launch, randomize]);

  const previewLine = preview
    ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
    : "Four digits lock a theater — or roll a random war";

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
        <MetalPanel className={styles.panel}>
          <div className={styles.actions}>
            <ConsoleButton
              className={styles.full}
              tooltip="Open campaign setup"
              shortcut={SHORTCUT.newGame}
              onClick={openNewGame}
            >
              NEW GAME
            </ConsoleButton>
            <ConsoleButton
              className={styles.full}
              tooltip="Audio and game options"
              shortcut={SHORTCUT.options}
              onClick={openOptions}
            >
              OPTIONS
            </ConsoleButton>
          </div>

          <ResumeList
            saves={saves}
            onResume={(seed) => router.push(`/play?seed=${seed}&resume=1`)}
            onDelete={deleteSave}
          />
          {unreadableSaves.length ? (
            <div className={styles.recovery} role="alert">
              <span>Unreadable save{unreadableSaves.length === 1 ? "" : "s"}: {unreadableSaves.join(", ")}</span>
              {unreadableSaves.map((seed) => (
                <ConsoleButton key={seed} tooltip={`Remove unreadable save ${seed}`} onClick={() => resetUnreadableSave(seed)}>
                  Reset {seed}
                </ConsoleButton>
              ))}
            </div>
          ) : null}
        </MetalPanel>
      </div>

      {view === "newGame" ? (
        <div className={styles.overlay}>
          <NewGameSetup
            code={code}
            error={error}
            previewLine={previewLine}
            inputRef={seedInput}
            onChange={(value) => {
              setCode(value);
              setError("");
            }}
            onRandomize={randomize}
            onLaunch={launch}
            onBack={() => setView("main")}
          />
        </div>
      ) : view === "options" ? (
        <div className={styles.overlay}>
          <MenuOptions
            sfxEnabled={settings.sfxEnabled}
            musicEnabled={settings.musicEnabled}
            onToggleSound={toggleSound}
            onToggleMusic={toggleMusic}
            onBack={() => setView("main")}
          />
        </div>
      ) : null}
    </div>
  );
}
