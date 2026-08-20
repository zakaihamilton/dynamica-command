import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import sharp from "sharp";

const ROOT = join(process.cwd(), "public/art");
const TARGETS = ["portraits", "sprites", "terrain"];
const QUALITY = 80;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return extname(entry.name).toLowerCase() === ".png" ? [path] : [];
  });
}

async function convert(src: string): Promise<{ src: string; dest: string; before: number; after: number }> {
  const dest = src.replace(/\.png$/i, ".webp");
  mkdirSync(dirname(dest), { recursive: true });
  const before = statSync(src).size;
  await sharp(src).webp({ quality: QUALITY, alphaQuality: QUALITY }).toFile(dest);
  const after = statSync(dest).size;
  unlinkSync(src);
  return { src, dest, before, after };
}

async function main() {
  const files = TARGETS.flatMap((folder) => walk(join(ROOT, folder)));
  let before = 0;
  let after = 0;
  for (const file of files) {
    const result = await convert(file);
    before += result.before;
    after += result.after;
    const rel = relative(ROOT, result.dest);
    const pct = Math.round((1 - result.after / result.before) * 100);
    console.log(`${rel}: ${result.before} -> ${result.after} (${pct}% smaller)`);
  }
  console.log(`Converted ${files.length} PNGs: ${before} -> ${after} bytes`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
