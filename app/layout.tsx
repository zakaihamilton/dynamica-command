import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AudioRoot } from "@/components/audio/AudioRoot";
import { TooltipLayer } from "@/components/TooltipLayer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import styles from "./layout.module.css";

const DESCRIPTION = "Seeded isometric RTS — one 4-digit code writes the war.";

const metadataBase = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase,
  title: "Dynamica Command",
  description: DESCRIPTION,
  openGraph: {
    title: "Dynamica Command",
    description: DESCRIPTION,
    siteName: "Dynamica Command",
    type: "website",
    images: [{ url: "/art/menu-command-vista.webp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dynamica Command",
    description: DESCRIPTION,
    images: ["/art/menu-command-vista.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#05080e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={styles.html}>
      <body className={styles.body}>
        <AudioRoot />
        <ErrorBoundary>{children}</ErrorBoundary>
        <TooltipLayer />
      </body>
    </html>
  );
}
