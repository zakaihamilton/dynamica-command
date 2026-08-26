import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatSeed } from "@/lib/seed/rng";
import { briefingCommandFromKey, isEditableTarget } from "@/lib/ui/shortcuts";

export function useBriefingController({
  seed,
  mission,
  returnToGame,
  isComplete,
  replayTransmission,
  skipToEnd,
}: {
  seed: number;
  mission: number;
  returnToGame: boolean;
  isComplete: boolean;
  replayTransmission: () => void;
  skipToEnd: () => void;
}) {
  const router = useRouter();

  const launch = useCallback(() => {
    router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : "&fresh=1"}`);
  }, [mission, returnToGame, router, seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = briefingCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        revealed: isComplete,
        returnToGame,
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "skip") {
        skipToEnd();
        return;
      }
      if (command.type === "replay") {
        replayTransmission();
        return;
      }
      launch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isComplete, launch, replayTransmission, returnToGame, skipToEnd]);

  return {
    launch,
  };
}
