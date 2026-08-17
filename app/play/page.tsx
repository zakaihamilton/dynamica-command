"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/ui/PageFallback";
import { parseSeed } from "@/lib/seed/rng";

const GameClient = dynamic(
  () => import("@/components/game/GameClient").then((m) => m.GameClient),
  { ssr: false, loading: () => <PageFallback>Deploying…</PageFallback> },
);

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  const mission = Number(sp.get("mission") ?? "0") || 0;
  const resume = sp.get("resume") === "1";
  return <GameClient key={`${seed}:${mission}:${resume}`} seed={seed} mission={mission} resume={resume} />;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<PageFallback>Deploying…</PageFallback>}>
      <Inner />
    </Suspense>
  );
}
