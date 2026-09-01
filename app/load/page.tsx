"use client";

import { CampaignArchiveScreen } from "@/components/campaign/CampaignArchiveScreen";
import { RouteBoundary } from "@/components/ui/RouteBoundary";

export default function LoadPage() {
  return (
    <RouteBoundary loadingText="Loading campaign archive…" eyebrow="Archive link lost" title="Campaign archive unavailable">
      <CampaignArchiveScreen />
    </RouteBoundary>
  );
}
