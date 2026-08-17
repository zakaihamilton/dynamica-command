import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipLayer } from "@/components/TooltipLayer";
import styles from "./layout.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Genesis Protocol",
  description: "Seeded isometric RTS — one 4-digit code writes the war.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${styles.html}`}
    >
      <body className={styles.body}>
        {children}
        <TooltipLayer />
      </body>
    </html>
  );
}
