import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

const ICONS = [
  ["public/icons/pwa-192.png", 192],
  ["public/icons/pwa-512.png", 512],
  ["public/icons/pwa-maskable-512.png", 512],
  ["app/apple-icon.png", 180],
] as const;

function icoDirectory(file: Buffer): { count: number; sizes: number[] } {
  const count = file.readUInt16LE(4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const width = file.readUInt8(6 + i * 16);
    sizes.push(width === 0 ? 256 : width);
  }
  return { count, sizes };
}

describe("PWA icons and manifest", () => {
  it("names the app and uses the chrome void colors", () => {
    const webApp = manifest();
    expect(webApp.name).toBe("Dynamica Command");
    expect(webApp.short_name).toBe("Dynamica");
    expect(webApp.display).toBe("standalone");
    expect(webApp.theme_color).toBe("#05080e");
    expect(webApp.background_color).toBe("#05080e");
    expect(webApp.icons?.map((icon) => icon.src)).toEqual([
      "/icons/pwa-192.png",
      "/icons/pwa-512.png",
      "/icons/pwa-maskable-512.png",
    ]);
  });

  it.each(ICONS)("%s is %d px and fully opaque", async (file, size) => {
    const path = resolve(process.cwd(), file);
    const meta = await sharp(path).metadata();
    expect(meta.width).toBe(size);
    expect(meta.height).toBe(size);
    const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) transparent += 1;
    }
    expect(transparent).toBe(0);
  });

  it("ships a 16 and 32 px favicon.ico for the browser tab", () => {
    const file = readFileSync(resolve(process.cwd(), "app/favicon.ico"));
    expect(file.readUInt16LE(2)).toBe(1);
    expect(icoDirectory(file)).toEqual({ count: 2, sizes: [16, 32] });
  });
});
