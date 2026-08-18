"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/ui/PageFallback";
import { parseSeed } from "@/lib/seed/rng";

const GameClient = dynamic(() => import("@/components/game/GameClient").then((m) => m.GameClient), {
  ssr: false,
  loading: () => <PageFallback>Preparing training range…</PageFallback>,
});

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  return <GameClient key={`tutorial:${seed}`} seed={seed} mission={0} resume={false} tutorial />;
}

export default function TutorialPage() {
  return <Suspense fallback={<PageFallback>Preparing training range…</PageFallback>}><Inner /></Suspense>;
}
