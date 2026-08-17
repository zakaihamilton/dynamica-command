"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { createCampaign } from "@/lib/gen/campaign";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { listSaves, localStorageAdapter } from "@/lib/persist/save";
import { isEditableTarget, menuCommandFromKey, SHORTCUT } from "@/lib/ui/shortcuts";
import { MenuBackdrop } from "./MenuBackdrop";
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

  const preview = useMemo(() => {
    const n = parseSeed(code);
    if (n === null || code.length < 4) return null;
    return createCampaign(n);
  }, [code]);

  function openNewGame() {
    setCode((current) => current.length === 4 ? current : rollSeed());
    setError("");
    setView("newGame");
  }

  function randomize() {
    setCode(rollSeed());
    setError("");
  }

  function launch() {
    const n = parseSeed(code);
    if (n === null || code.length < 4) {
      setError("Enter a 4-digit seed (0000–9999), or roll a random theater.");
      return;
    }
    setError("");
    router.push(`/briefing?seed=${formatSeed(n)}&mission=0`);
  }

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
  }, [view, code]);

  const previewLine = preview
    ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
    : "Four digits lock a theater — or roll a random war";

  return (
    <div className={styles.screen}>
      <MenuBackdrop />
      <div className={styles.vignette} />
      <div className={styles.scanlines} />

      <div className={styles.content}>
        <h1 className={styles.title}>GENESIS</h1>
        <h1 className={styles.subtitle}>PROTOCOL</h1>
        <p className={styles.tagline}>Harvest. Build. Conquer.</p>
        <MetalPanel className={styles.panel}>
          <ConsoleButton
            className={styles.full}
            tooltip="Open campaign setup"
            shortcut={SHORTCUT.newGame}
            onClick={openNewGame}
          >
            NEW GAME
          </ConsoleButton>

          <ResumeList saves={saves} onResume={(seed) => router.push(`/play?seed=${seed}&resume=1`)} />
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
