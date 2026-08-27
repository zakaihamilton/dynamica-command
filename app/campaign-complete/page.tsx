"use client";

import { CampaignRoute } from "@/components/campaign/CampaignRoute";
import { RouteBoundary } from "@/components/ui/RouteBoundary";

export default function CampaignCompletePage() {
  return (
    <RouteBoundary loadingText="Loading campaign record…" eyebrow="Archive corrupted" title="Campaign record unavailable">
      <CampaignRoute mode="record" />
    </RouteBoundary>
  );
}
