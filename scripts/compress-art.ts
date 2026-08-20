import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";

/**
 * One-shot PNG → alpha WebP converter. Uses the `sharp` already hoisted by Next;
 * it is not a runtime app dependency. Does not crop or resize — canvas loaders
 * slice portraits from `naturalWidth / PORTRAIT_FRAME_COUNT`.
 *
 *   yarn compress-art --dry-run
 *   yarn compress-art portraits
 *   yarn compress-art sprites terrain
 *   yarn compress-art all
 */
const ART_ROOT = join(process.cwd(), "public/art");

const TARGETS: Record<string, string> = {
  portraits: join(ART_ROOT, "portraits"),
  sprites: join(ART_ROOT, "sprites/sleek-modular"),
  terrain: join(ART_ROOT, "terrain"),
};

/** High-quality lossy WebP with a lossless alpha plane. Near-lossless stays ~40% of PNG size on these sheets and misses the art-budget bar. */
const WEBP = {
  quality: 95,
  alphaQuality: 100,
  effort: 6,
  smartSubsample: true,
} as const;

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function listPngs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPngs(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) out.push(full);
  }
  return out.sort();
}

function resolveTargets(names: string[]): string[] {
  const dirs: string[] = [];
  for (const name of names) {
    if (name === "all") {
      dirs.push(...Object.values(TARGETS));
      continue;
    }
    const mapped = TARGETS[name];
    if (mapped) {
      dirs.push(mapped);
      continue;
    }
    throw new Error(`Unknown target "${name}". Use portraits, sprites, terrain, or all.`);
  }
  return [...new Set(dirs)];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const names = args.filter((arg) => arg !== "--dry-run");
  const dirs = resolveTargets(names.length > 0 ? names : ["portraits"]);
  const files = dirs.flatMap(listPngs);

  if (files.length === 0) {
    console.log("No PNG files found.");
    return;
  }

  let before = 0;
  let after = 0;

  for (const png of files) {
    const webp = png.replace(/\.png$/i, ".webp");
    const inputBytes = statSync(png).size;
    before += inputBytes;
    const srcStats = await sharp(png).stats();
    const srcAlpha = srcStats.channels[3];
    const srcHadTransparency = Boolean(srcAlpha && srcAlpha.min < 255);
    const pipeline = sharp(png).ensureAlpha().webp(WEBP);
    if (dryRun) {
      const buf = await pipeline.toBuffer();
      after += buf.length;
      console.log(
        `${relative(process.cwd(), png)}  ${formatBytes(inputBytes)} → ${formatBytes(buf.length)}  (dry-run)`,
      );
      continue;
    }
    await pipeline.toFile(webp);
    const meta = await sharp(webp).metadata();
    if (srcHadTransparency && !meta.hasAlpha) {
      console.warn(`warning: ${relative(process.cwd(), webp)} dropped a useful alpha plane`);
    }
    const outputBytes = statSync(webp).size;
    after += outputBytes;
    unlinkSync(png);
    console.log(`${relative(process.cwd(), png)}  ${formatBytes(inputBytes)} → ${formatBytes(outputBytes)}`);
  }

  console.log(
    `${dryRun ? "dry-run " : ""}${files.length} files  ${formatBytes(before)} → ${formatBytes(after)}  (${((after / before) * 100).toFixed(1)}%)`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
