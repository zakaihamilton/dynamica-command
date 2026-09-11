import type { Metadata } from "next";
import { PortraitGallery } from "@/components/portraits/PortraitGallery";

export const metadata: Metadata = {
  title: "Shifting Front",
  description: "Hidden portrait calibration gallery.",
};

export default function PortraitsPage() {
  return <PortraitGallery />;
}
