"use client";

import { CampaignRoute } from "@/components/campaign/CampaignRoute";
import { RouteBoundary } from "@/components/ui/RouteBoundary";

export default function CampaignPage() {
  return (
    <RouteBoundary loadingText="Loading operations map…" eyebrow="Campaign link lost" title="Operations map unavailable">
      <CampaignRoute mode="operations" />
    </RouteBoundary>
  );
}
