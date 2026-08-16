"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BriefingScreen } from "@/components/BriefingScreen";
import { parseSeed } from "@/lib/seed/rng";

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  const mission = Number(sp.get("mission") ?? "0") || 0;
  const returnToGame = sp.get("return") === "game";
  return <BriefingScreen key={`${seed}:${mission}:${returnToGame}`} seed={seed} mission={mission} returnToGame={returnToGame} />;
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--chrome-bg)] text-[var(--chrome-text)]">Loading briefing…</div>}>
      <Inner />
    </Suspense>
  );
}
