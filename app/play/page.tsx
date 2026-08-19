"use client";

import { useSearchParams } from "next/navigation";
import { DynamicGameClient, GamePageContainer } from "@/components/game/GamePageWrapper";
import { parseSeed } from "@/lib/seed/rng";

function PlaySession() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  const mission = Number(sp.get("mission") ?? "0") || 0;
  const resume = sp.get("resume") === "1";
  return <DynamicGameClient key={`${seed}:${mission}:${resume}`} seed={seed} mission={mission} resume={resume} />;
}

export default function PlayPage() {
  return (
    <GamePageContainer loadingText="Deploying…">
      <PlaySession />
    </GamePageContainer>
  );
}
