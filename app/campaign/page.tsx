"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CampaignCompleteScreen } from "@/components/campaign/CampaignCompleteScreen";
import { PageFallback } from "@/components/ui/PageFallback";
import { parseSeed } from "@/lib/seed/rng";

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  return <CampaignCompleteScreen key={seed} seed={seed} mode="operations" />;
}

export default function CampaignPage() {
  return (
    <Suspense fallback={<PageFallback>Loading operations map…</PageFallback>}>
      <Inner />
    </Suspense>
  );
}
