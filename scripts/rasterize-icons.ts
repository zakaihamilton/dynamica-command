import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import sharp from "sharp";

/**
 * Rasterize `app/icon.svg` into favicon.ico, apple-touch, and PWA PNGs. Uses
 * the `sharp` already hoisted by Next; it is not a runtime app dependency.
 *
 *   yarn rasterize-icons
 */
const ROOT = process.cwd();
const SVG_PATH = join(ROOT, "app/icon.svg");
const APPLE_ICON = join(ROOT, "app/apple-icon.png");
const FAVICON_ICO = join(ROOT, "app/favicon.ico");
const PWA_DIR = join(ROOT, "public/icons");
const VOID = { r: 5, g: 8, b: 14, alpha: 1 };
const MASKABLE_SAFE_ZONE = 0.8;

function sizedSvg(source: string, px: number): Buffer {
  if (/<svg\b[^>]*\bwidth=/.test(source)) {
    source = source.replace(/\swidth="[^"]*"/, ` width="${px}"`);
    source = source.replace(/\sheight="[^"]*"/, ` height="${px}"`);
  } else {
    source = source.replace(/<svg\b/, `<svg width="${px}" height="${px}"`);
  }
  return Buffer.from(source);
}

async function rasterize(source: string, px: number): Promise<Buffer> {
  return sharp(sizedSvg(source, px)).png({ compressionLevel: 9 }).toBuffer();
}

async function rasterizeMaskable(source: string, px: number): Promise<Buffer> {
  const markSize = Math.round(px * MASKABLE_SAFE_ZONE);
  const mark = await rasterize(source, markSize);
  return sharp({
    create: {
      width: px,
      height: px,
      channels: 4,
      background: VOID,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
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
  const source = readFileSync(SVG_PATH, "utf8");
  const favicon16 = await rasterize(source, 16);
  const favicon32 = await rasterize(source, 32);
  writeFileSync(FAVICON_ICO, pngIco([{ size: 16, png: favicon16 }, { size: 32, png: favicon32 }]));
  console.log(`${relative(ROOT, FAVICON_ICO)}  16x16+32x32`);
  await writePng(APPLE_ICON, await rasterize(source, 180));
  await writePng(join(PWA_DIR, "pwa-192.png"), await rasterize(source, 192));
  await writePng(join(PWA_DIR, "pwa-512.png"), await rasterize(source, 512));
  await writePng(join(PWA_DIR, "pwa-maskable-512.png"), await rasterizeMaskable(source, 512));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
