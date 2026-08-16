"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { parseSeed } from "@/lib/seed/rng";

const GameClient = dynamic(
  () => import("@/components/GameClient").then((m) => m.GameClient),
  { ssr: false, loading: () => <div className="min-h-screen bg-[#0b0d10] text-[#e8e0d0]">Deploying…</div> },
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
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d10] text-[#e8e0d0]">Deploying…</div>}>
      <Inner />
    </Suspense>
  );
}
