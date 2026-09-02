"use client";

import { DynamicGameClient, GamePageContainer } from "@/components/game/GamePageWrapper";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TUTORIAL_SEED } from "@/lib/sim/tutorial";

function TutorialSession() {
  return <DynamicGameClient key="tutorial" seed={TUTORIAL_SEED} mission={0} resume={false} tutorial />;
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
