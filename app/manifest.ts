import type { MetadataRoute } from "next";

const DESCRIPTION = "A Command & Conquer–like RTS — one 4-digit code writes the war.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dynamica Command",
    short_name: "Dynamica",
    description: DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#05080e",
    theme_color: "#05080e",
    lang: "en",
    orientation: "any",
    categories: ["games"],
    icons: [
      {
        src: "/icons/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
