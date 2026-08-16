"use client";

import { Cinzel } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MenuBackdrop } from "@/components/MenuBackdrop";
import { createCampaign } from "@/lib/gen/campaign";
import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { listSaves, localStorageAdapter } from "@/lib/persist/save";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"] });

export function MenuScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [saves, setSaves] = useState(() => [] as ReturnType<typeof listSaves>);
  const [error, setError] = useState("");
  const seedInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaves(listSaves(localStorageAdapter()));
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

  const previewLine = preview
    ? `${preview.world.name} · ${preview.factions[0].name} vs ${preview.factions[1].name}`
    : "Enter four digits to preview this theater";

  return (
    <div className="relative min-h-screen overflow-hidden text-[#e8e0d0]">
      <MenuBackdrop />
      <div className="menu-vignette pointer-events-none absolute inset-0" />
      <div className="menu-scanlines pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-6 py-10">
        <p className="font-mono text-[0.7rem] tracking-[0.55em] text-[#c4b37a]">SEEDED THEATER</p>
        <h1
          className={`${cinzel.className} menu-title mt-3 text-center text-6xl font-black leading-[0.9] tracking-[0.18em] text-[#f4e7c4] sm:text-8xl`}
        >
          GENESIS
        </h1>
        <h1
          className={`${cinzel.className} menu-title mt-1 text-center text-5xl font-black tracking-[0.32em] text-[#f4e7c4] sm:text-7xl`}
        >
          PROTOCOL
        </h1>
        <div className="mt-4 h-px w-48 bg-gradient-to-r from-transparent via-[#c4b37a] to-transparent" />
        <p className="mt-4 max-w-md text-center text-sm leading-6 text-[#cfc6a8]">
          One four-digit seed writes the war — maps, factions, faces, and every mission objective.
        </p>

        <div className="mt-10 w-full max-w-lg border border-[#c4b37a]/35 bg-[#0d120c]/78 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <button
            type="button"
            onClick={newGame}
            className="w-full border border-[#c4b37a] bg-[#2a3218]/90 px-4 py-3 text-left font-medium tracking-[0.2em] hover:bg-[#3a4520]"
          >
            NEW GAME
          </button>

          <div className="mt-5">
            <p className="font-mono text-[0.65rem] tracking-[0.35em] text-[#8f9a6a]">ENTER SEED</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative">
                <div className="pointer-events-none flex gap-2" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-16 w-14 items-center justify-center border border-[#3d4a38] bg-[#0b0d10]/80 font-mono text-3xl text-[#f3e6c4]"
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
                className="h-16 shrink-0 border border-[#3d4a38] px-4 text-sm tracking-wide hover:border-[#c4b37a]"
              >
                Deploy
              </button>
            </div>
            <div className="mt-3 h-12">
              <p className="truncate font-mono text-xs tracking-wide text-[#8f9a6a]">{previewLine}</p>
              <p className={`mt-1 text-sm ${error ? "text-red-400" : "invisible"}`}>
                {error || "placeholder"}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <h2 className="font-mono text-[0.65rem] tracking-[0.35em] text-[#8f9a6a]">RESUME</h2>
            <div className="mt-2 h-28 overflow-y-auto">
              {saves.length === 0 ? (
                <p className="text-sm text-[#6d7260]">No saved theaters.</p>
              ) : (
                <ul className="space-y-1">
                  {saves.map((s) => (
                    <li key={s.seed}>
                      <button
                        type="button"
                        className="w-full border border-[#2a3324] px-3 py-2 text-left text-sm hover:border-[#c4b37a]"
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
    </div>
  );
}
