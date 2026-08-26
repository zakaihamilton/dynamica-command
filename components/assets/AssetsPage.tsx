"use client";

import { useRouter } from "next/navigation";
import type { Palette } from "@/lib/types";
import { AssetsBrowser } from "./AssetsBrowser";
import styles from "./AssetsPage.module.css";

export function AssetsPage({ palette }: { palette: Palette }) {
  const router = useRouter();

  return (
    <main className={styles.page} data-testid="assets-page">
      <AssetsBrowser palette={palette} onClose={() => router.replace("/")} />
    </main>
  );
}
