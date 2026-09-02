import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import sharp from "sharp";

/**
 * Rasterize `app/icon-source.png` into favicon.ico, apple-touch, app icon, and
 * PWA PNGs. Uses the `sharp` already hoisted by Next; it is not a runtime app
 * dependency.
 *
 *   yarn rasterize-icons
 */
const ROOT = process.cwd();
const SOURCE = join(ROOT, "app/icon-source.png");
const APP_ICON = join(ROOT, "app/icon.png");
const APPLE_ICON = join(ROOT, "app/apple-icon.png");
const FAVICON_ICO = join(ROOT, "app/favicon.ico");
const PWA_DIR = join(ROOT, "public/icons");
const VOID = { r: 5, g: 8, b: 14, alpha: 1 };
const MASKABLE_SAFE_ZONE = 0.8;

async function rasterize(px: number): Promise<Buffer> {
  return sharp(SOURCE)
    .resize(px, px, { fit: "fill", kernel: "lanczos3" })
    .flatten({ background: VOID })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function rasterizeMaskable(px: number): Promise<Buffer> {
  const markSize = Math.round(px * MASKABLE_SAFE_ZONE);
  const mark = await rasterize(markSize);
  return sharp({
    create: {
      width: px,
      height: px,
      channels: 4,
      background: VOID,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .flatten({ background: VOID })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function pngIco(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * frames.length;
  for (const frame of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 0);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(frame.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += frame.png.length;
  }
  return Buffer.concat([header, ...entries, ...frames.map((frame) => frame.png)]);
}

async function writePng(path: string, png: Buffer): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  const meta = await sharp(png).metadata();
  console.log(`${relative(ROOT, path)}  ${meta.width}x${meta.height}`);
}

async function main(): Promise<void> {
  const favicon16 = await rasterize(16);
  const favicon32 = await rasterize(32);
  writeFileSync(FAVICON_ICO, pngIco([{ size: 16, png: favicon16 }, { size: 32, png: favicon32 }]));
  console.log(`${relative(ROOT, FAVICON_ICO)}  16x16+32x32`);
  await writePng(APP_ICON, await rasterize(192));
  await writePng(APPLE_ICON, await rasterize(180));
  await writePng(join(PWA_DIR, "pwa-192.png"), await rasterize(192));
  await writePng(join(PWA_DIR, "pwa-512.png"), await rasterize(512));
  await writePng(join(PWA_DIR, "pwa-maskable-512.png"), await rasterizeMaskable(512));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
