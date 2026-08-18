"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CampaignCompleteScreen } from "@/components/campaign/CampaignCompleteScreen";
import { PageFallback } from "@/components/ui/PageFallback";
import { parseSeed } from "@/lib/seed/rng";

function Inner() {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  return <CampaignCompleteScreen key={seed} seed={seed} />;
}

export default function CampaignCompletePage() {
  return (
    <Suspense fallback={<PageFallback>Loading campaign record…</PageFallback>}>
      <Inner />
    </Suspense>
  );
}
