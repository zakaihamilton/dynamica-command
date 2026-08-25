"use client";

import { useSearchParams } from "next/navigation";
import { DynamicGameClient, GamePageContainer } from "@/components/game/GamePageWrapper";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { parseSeed } from "@/lib/seed/rng";

function TutorialSession() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  return <DynamicGameClient key={`tutorial:${seed}`} seed={seed} mission={0} resume={false} tutorial />;
}

export default function TutorialPage() {
  return (
    <ErrorBoundary eyebrow="Training range offline" title="Training failed to load">
      <GamePageContainer loadingText="Preparing training range…">
        <TutorialSession />
      </GamePageContainer>
    </ErrorBoundary>
  );
}
