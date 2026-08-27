"use client";

import { useSearchParams } from "next/navigation";
import { BriefingScreen } from "@/components/briefing/BriefingScreen";
import { RouteBoundary } from "@/components/ui/RouteBoundary";
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
    <RouteBoundary loadingText="Loading briefing…" eyebrow="Signal lost" title="Briefing unavailable">
      <Inner />
    </RouteBoundary>
  );
}
