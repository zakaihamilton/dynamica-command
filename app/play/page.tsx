"use client";

import { useSearchParams } from "next/navigation";
import { DynamicGameClient, GamePageContainer } from "@/components/game/GamePageWrapper";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { isSlotId } from "@/lib/persist/save";
import { parseMissionIndex, parseSeed } from "@/lib/seed/rng";

function PlaySession() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  const mission = parseMissionIndex(sp.get("mission")) ?? 0;
  const resume = sp.get("resume") === "1";
  const fresh = sp.get("fresh") === "1";
  const slotParam = sp.get("slot") ?? "";
  const slot = isSlotId(slotParam) ? slotParam : undefined;
  return (
    <DynamicGameClient
      key={`${seed}:${slot ?? `${mission}:${resume}:${fresh}`}`}
      seed={seed}
      mission={mission}
      resume={resume}
      fresh={fresh}
      slot={slot}
    />
  );
}

export default function PlayPage() {
  return (
    <ErrorBoundary eyebrow="Battlefield offline" title="Deployment failed">
      <GamePageContainer loadingText="Deploying…">
        <PlaySession />
      </GamePageContainer>
    </ErrorBoundary>
  );
}
