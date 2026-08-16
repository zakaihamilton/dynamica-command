"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BriefingScreen } from "@/components/BriefingScreen";
import { parseSeed } from "@/lib/seed/rng";

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  const mission = Number(sp.get("mission") ?? "0") || 0;
  return <BriefingScreen seed={seed} mission={mission} />;
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d10] text-[#e8e0d0]">Loading briefing…</div>}>
      <Inner />
    </Suspense>
  );
}
