"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MenuBackdrop } from "@/components/MenuBackdrop";
import { AssetsBrowser } from "@/components/AssetsBrowser";
import { createCampaign } from "@/lib/gen/campaign";
import { generateFactions } from "@/lib/gen/factions";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { listSaves, localStorageAdapter } from "@/lib/persist/save";
import { isEditableTarget, menuCommandFromKey, SHORTCUT } from "@/lib/ui/shortcuts";

export function MenuScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [saves, setSaves] = useState(() => [] as ReturnType<typeof listSaves>);
  const [error, setError] = useState("");
  const [showAssets, setShowAssets] = useState(false);
  const seedInput = useRef<HTMLInputElement>(null);
  const menuPalette = useMemo(() => generateFactions(1847)[0].palette, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSaves(listSaves(localStorageAdapter())));
    return () => cancelAnimationFrame(frame);
  }, []);

  const preview = useMemo(() => {
    const n = parseSeed(code);
    if (n === null || code.length < 4) return null;
    return createCampaign(n);
  }, [code]);

  function newGame() {
    const n = Math.floor(Math.random() * 10000);
    router.push(`/briefing?seed=${formatSeed(n)}&mission=0`);
  }

  function enterSeed() {
    const n = parseSeed(code);
    if (n === null || code.length < 4) {
      setError("Enter a 4-digit seed (0000–9999).");
      return;
    }
    setError("");
    router.push(`/briefing?seed=${formatSeed(n)}&mission=0`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = menuCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        assetsOpen: showAssets,
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "newGame") newGame();
      else if (command.type === "assets") setShowAssets(true);
      else enterSeed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAssets, code]);

  const previewLine = preview
    ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
    : "Enter four digits to preview this theater";

  return (
    <div className="relative min-h-screen overflow-hidden text-[var(--chrome-body)]">
      <MenuBackdrop />
      <div className="menu-vignette pointer-events-none absolute inset-0" />
      <div className="menu-scanlines pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-6 py-10">
        <p className="console-label text-[0.7rem] tracking-[0.55em] text-[var(--chrome-cyan)]">PROCEDURAL THEATER NETWORK</p>
        <h1
          className="menu-title mt-3 text-center text-6xl font-black leading-[0.9] tracking-[0.12em] text-[var(--chrome-text)] sm:text-8xl"
        >
          GENESIS
        </h1>
        <h1
          className="menu-title mt-1 text-center text-4xl font-black tracking-[0.28em] text-[var(--chrome-cyan)] sm:text-6xl"
        >
          PROTOCOL
        </h1>
        <div className="mt-4 h-px w-48 bg-gradient-to-r from-transparent via-[var(--chrome-cyan)] to-transparent" />
        <p className="mt-4 max-w-md text-center text-sm leading-6 text-[var(--chrome-body)]">
          One four-digit seed writes the war — maps, factions, faces, and every mission objective.
        </p>

        <div className="metal-panel mt-10 w-full max-w-lg p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={newGame}
            className="console-button has-tooltip w-full text-left"
            data-tooltip="Begin a random campaign"
            data-shortcut={SHORTCUT.newGame}
          >
            NEW GAME
          </button>

          <button
            type="button"
            onClick={() => setShowAssets(true)}
            className="console-button has-tooltip mt-3 w-full text-left"
            data-tooltip="Inspect generated sprites and animations"
            data-shortcut={SHORTCUT.assets}
          >
            Assets
          </button>

          <div className="mt-5">
            <p className="console-label">ENTER SEED</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative">
                <div className="pointer-events-none flex gap-2" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-16 w-14 items-center justify-center border border-[var(--chrome-inset)] bg-[var(--chrome-steel-lo)] font-mono text-3xl text-[var(--chrome-cyan)] shadow-[inset_1px_1px_var(--chrome-void),inset_-1px_-1px_var(--chrome-bevel)]"
                    >
                      {code[i] ?? "·"}
                    </div>
                  ))}
                </div>
                <input
                  ref={seedInput}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enterSeed();
                  }}
                  maxLength={4}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Four digit seed"
                  className="absolute inset-0 cursor-text opacity-0"
                />
              </div>
              <button
                type="button"
                onClick={enterSeed}
                className="console-button has-tooltip h-16 shrink-0 px-4"
                data-tooltip="Deploy this seed"
                data-shortcut={SHORTCUT.deploy}
              >
                Deploy
              </button>
            </div>
            <div className="mt-3 h-12">
              <p className="truncate font-mono text-xs uppercase tracking-wide text-[var(--chrome-muted)]">{previewLine}</p>
              <p className={`mt-1 text-sm ${error ? "text-red-400" : "invisible"}`}>
                {error || "placeholder"}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <h2 className="console-label">RESUME OPERATIONS</h2>
            <div className="mt-2 h-28 overflow-y-auto">
              {saves.length === 0 ? (
                <p className="text-sm text-[var(--chrome-muted)]">No saved theaters.</p>
              ) : (
                <ul className="space-y-1">
                  {saves.map((s) => (
                    <li key={s.seed}>
                      <button
                        type="button"
                        className="console-button console-button-muted has-tooltip w-full px-3 py-2 text-left text-xs"
                        data-tooltip={`Resume seed ${s.seed}`}
                        onClick={() => router.push(`/play?seed=${s.seed}&resume=1`)}
                      >
                        Seed {s.seed} · Mission {s.missionIndex + 1} · tick {s.tick}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssets ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <AssetsBrowser palette={menuPalette} onClose={() => setShowAssets(false)} />
        </div>
      ) : null}
    </div>
  );
}
