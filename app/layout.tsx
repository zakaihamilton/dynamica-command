import type { Metadata, Viewport } from "next";
import { AudioRoot } from "@/components/audio/AudioRoot";
import { TooltipLayer } from "@/components/TooltipLayer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Genesis Protocol",
  description: "Seeded isometric RTS — one 4-digit code writes the war.",
};

export const viewport: Viewport = {
  themeColor: "#05080e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
