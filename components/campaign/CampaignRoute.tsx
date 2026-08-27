"use client";

import { useSearchParams } from "next/navigation";
import { parseSeed } from "@/lib/seed/rng";
import { CampaignCompleteScreen } from "./CampaignCompleteScreen";

export function CampaignRoute({ mode }: { mode: "record" | "operations" }) {
  const sp = useSearchParams();
  const seed = parseSeed(sp.get("seed") ?? "0000") ?? 0;
  return <CampaignCompleteScreen key={`${seed}:${mode}`} seed={seed} mode={mode} />;
}
