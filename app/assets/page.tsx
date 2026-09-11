import type { Metadata } from "next";
import { AssetsPage } from "@/components/assets/AssetsPage";
import { generateFactions } from "@/lib/gen/factions";

const ASSET_BAY_PALETTE = generateFactions(421)[0].palette;

export const metadata: Metadata = {
  title: "Shifting Front",
  description: "Public generated asset browser and preview API.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AssetsRoute() {
  return <AssetsPage palette={ASSET_BAY_PALETTE} />;
}
