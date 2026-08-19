"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { TITLE_MUSIC_SEED, setMusicCue } from "@/lib/audio/music";
import { listSaves, localStorageAdapter, removeSave } from "@/lib/persist/save";
import { readCampaignProgress } from "@/lib/persist/campaign";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { isEditableTarget, menuCommandFromKey, SHORTCUT } from "@/lib/ui/shortcuts";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuHero } from "./MenuHero";
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
  const [error, setError] = useState("");
  const [view, setView] = useState<"main" | "newGame">("main");
  const seedInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSaves(listSaves(localStorageAdapter())));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const n = parseSeed(code);
    setMusicCue("menu", n !== null && code.length === 4 ? n : TITLE_MUSIC_SEED);
  }, [code]);

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
    removeSave(localStorageAdapter(), Number(saveSeed));
    setSaves(listSaves(localStorageAdapter()));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = menuCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        setupOpen: view === "newGame",
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "newGame") openNewGame();
      else if (command.type === "deploy") launch();
      else if (command.type === "randomize") randomize();
      else if (command.type === "back") setView("main");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openNewGame, launch, randomize]);

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
          <ConsoleButton
            className={styles.full}
            tooltip="Open campaign setup"
            shortcut={SHORTCUT.newGame}
            onClick={openNewGame}
          >
            NEW GAME
          </ConsoleButton>

        <ResumeList
          saves={saves}
          onResume={(seed) => router.push(`/play?seed=${seed}&resume=1`)}
          onDelete={deleteSave}
        />
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
      ) : null}
    </div>
  );
}
