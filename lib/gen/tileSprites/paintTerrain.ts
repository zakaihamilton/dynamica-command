import { type BiomeName, type Palette, type ShapeSpec } from "../../types";
import { hash, mixHex, pick, signed, ORE } from "../tilePalette";
import { blockerPropKind, type BlockerPropKind } from "../terrainDecorKinds";
import { tileCx, tileCy, INK, poly, ell, line, irregularIso } from "./constants";
import { wetGround, shoreSand, waterDeep, waterMid, waterHi, foam, rockColors, diamondEdges, insetBand } from "./colors";

export function paintWater(shapes: ShapeSpec[], biome: BiomeName, v: number, mask: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const deep = waterDeep(biome);
  const mid = waterMid(biome);
  const hi = waterHi(biome);
  shapes.push(poly(irregularIso(cx, cy, 108, 54, 0, 2), mixHex(deep, mid, 0.32)));
  shapes.push(ell(cx - 10, cy - 2, 24, 10, mixHex(deep, mid, 0.1)));
  shapes.push(line(cx - 14, cy + 1, cx + 12, cy - 3, mixHex(mid, hi, 0.22), 1));
  if (mask) paintBanks(shapes, biome, mask, v);
}

export function paintBanks(shapes: ShapeSpec[], biome: BiomeName, mask: number, v: number): void {
  const sand = shoreSand(biome);
  const mud = wetGround(biome);
  const froth = foam(biome);
  const deep = waterDeep(biome);
  for (const edge of diamondEdges()) {
    if (!(mask & edge.bit)) continue;
    const band = insetBand(edge.a, edge.b, 7);
    shapes.push(poly([...edge.a, ...edge.b, ...band.b, ...band.a], sand, mud, 1));
    const inner = insetBand(edge.a, edge.b, 4);
    shapes.push(poly([...band.a, ...band.b, ...inner.b, ...inner.a], deep));
    shapes.push(line(inner.a[0]!, inner.a[1]!, inner.b[0]!, inner.b[1]!, froth, 2));
    if ((v + edge.bit) % 3 === 0) {
      const mx = (edge.a[0]! + edge.b[0]!) / 2;
      const my = (edge.a[1]! + edge.b[1]!) / 2;
      shapes.push(ell(mx - 2, my - 1, 5, 3, "#6a5a44", INK));
    }
  }
}

export function paintRidge(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, mask: number): void {
  const rock = rockColors(biome, p);
  if (!mask) {
    shapes.push(ell(tileCx() + ((v % 7) - 3), tileCy() + 1, 7, 3, rock.dark));
    shapes.push(ell(tileCx() + ((v % 5) - 2), tileCy(), 4, 2, rock.hi));
    return;
  }
  for (const edge of diamondEdges()) {
    if (!(mask & edge.bit)) continue;
    const face = insetBand(edge.a, edge.b, 8);
    shapes.push(poly([...edge.a, ...edge.b, ...face.b, ...face.a], rock.mid, rock.ink, 1));
    const facet = insetBand(edge.a, edge.b, 4);
    shapes.push(poly([
      edge.a[0]!, edge.a[1]!,
      (edge.a[0]! + edge.b[0]!) / 2, (edge.a[1]! + edge.b[1]!) / 2,
      facet.a[0]!, facet.a[1]!,
    ], rock.hi));
    shapes.push(line(face.a[0]!, face.a[1]!, face.b[0]!, face.b[1]!, rock.dark, 2));
    const mx = (edge.a[0]! + edge.b[0]!) / 2 + ((v % 3) - 1);
    const my = (edge.a[1]! + edge.b[1]!) / 2;
    shapes.push(line(mx - 3, my, mx + 2, my + 2, rock.ink, 1));
  }
  if ((mask & 3) === 3) {
    const cx = tileCx();
    const cy = tileCy() - 14;
    shapes.push(poly([cx - 4, cy + 2, cx, cy, cx + 4, cy + 2, cx, cy + 8], rock.hi, rock.ink, 1));
    shapes.push(poly([cx - 2, cy + 2, cx, cy + 1, cx, cy + 7], rock.dark));
  }
}

export function paintOreField(shapes: ShapeSpec[], biome: BiomeName, v: number, level: number, continuous = false): void {
  const cx = tileCx();
  const cy = tileCy();
  const n = Math.max(1, Math.min(4, level));
  const fieldTint = biome === "crystal flats" ? "#34594f"
    : biome === "rust canyons" ? "#5f321d"
      : biome === "tundra grid" ? "#465b5c"
        : biome === "volcanic shelf" ? "#2c1e1a"
          : biome === "jungle wreckage" ? "#2a3c22"
            : ORE.stainLo;
  const density = 1 + pick(v, 401, 4);
  if (!continuous) {
    shapes.push(poly(irregularIso(cx, cy + 1, 76, 36, v, 2), fieldTint));
    shapes.push(poly(irregularIso(cx, cy, 66, 29, v, 2), mixHex(fieldTint, ORE.stain, 0.54)));
  }
  for (let i = 0; i < density; i++) {
    const ox = -16 + i * 11 + signed(v, 404 + i, 2);
    const oy = 4 - i * 5 + signed(v, 410 + i, 2);
    const seam = 10 + pick(v, 416 + i, 7);
    shapes.push(line(cx + ox, cy + oy, cx + ox + seam, cy + oy - Math.max(2, Math.round(seam * 0.28)), ORE.south, 3));
    shapes.push(line(cx + ox + 1, cy + oy - 1, cx + ox + seam - 1, cy + oy - Math.max(3, Math.round(seam * 0.28)) - 1, ORE.lit, 1));
  }

  const slots: Array<[number, number, number, number]> = [
    [-11, 2, 8, 5],
    [8, -4, 9, 6],
    [1, 5, 7, 4],
    [14, 3, 6, 5],
    [-7, -5, 7, 5],
    [5, 1, 8, 6],
    [-15, 4, 5, 4],
  ];
  const picked = slots
    .map((slot, i) => ({ slot, order: slot[1]! * 8 + slot[0]!, mix: hash(v + i * 19) }))
    .sort((a, b) => a.mix - b.mix)
    .slice(0, 1 + Math.floor(n / 2))
    .sort((a, b) => a.order - b.order);

  for (let i = 0; i < picked.length; i++) {
    const [ox, oy, rw, zh] = picked[i]!.slot;
    const seed = hash(v + i * 31);
    const width = rw + (seed % 3) - 1;
    const z = Math.min(zh + (seed % 2), 6);
    const x = cx + ox;
    const y = cy + oy;
    const half = Math.max(3, Math.round(width * 0.38));
    shapes.push(poly([x - half, y, x, y - z, x + half, y, x, y + Math.max(2, half * 0.42)], ORE.top, ORE.ink, 1));
    shapes.push(poly([x - half, y, x, y + Math.max(2, half * 0.42), x, y + Math.max(2, half * 0.42) + 2, x - half, y + 2], ORE.south, ORE.ink, 1));
    shapes.push(line(x - half + 1, y - 1, x - 1, y - z + 1, ORE.lit, 1));
  }

  shapes.push(line(cx - 20, cy + 8, cx + 20, cy - 8, ORE.ink, 1));
  shapes.push(line(cx - 18, cy + 8, cx + 18, cy - 7, ORE.glint, 1));
}

function paintBoulder(
  shapes: ShapeSpec[],
  p: Palette,
  v: number,
  cx: number,
  cy: number,
  biome: BiomeName,
  snowCap: boolean,
): void {
  const ox = signed(v, 3, 5);
  const oy = signed(v, 4, 2);
  const body = biome === "volcanic shelf" ? "#473331" : biome === "glass desert" ? "#675947" : mixHex(p.secondary, p.dark, 0.38);
  const side = mixHex(body, "#171d20", 0.48);
  const facet = mixHex(body, "#0f1416", 0.28);
  const top = snowCap ? mixHex(p.light, "#e8f2f4", 0.55) : mixHex(p.light, "#a5b2ad", 0.28);
  const lush = biome === "jungle wreckage" || biome === "salt marshes";
  shapes.push(ell(cx - 17 + ox, cy + 2 + oy, 34, 10, "rgba(8, 12, 14, 0.42)"));
  shapes.push(poly([cx - 17 + ox, cy + 2 + oy, cx + 16 + ox, cy + 2 + oy, cx + 12 + ox, cy + 9 + oy, cx - 13 + ox, cy + 9 + oy], side, INK, 1));
  shapes.push(poly([
    cx - 14 + ox, cy + 2 + oy,
    cx - 6 + ox, cy - 8 + oy,
    cx - 2 + ox, cy - 13 + oy,
    cx + 15 + ox, cy - 2 + oy,
    cx + 11 + ox, cy + 4 + oy,
    cx - 12 + ox, cy + 5 + oy,
  ], body, INK, 1));
  shapes.push(poly([cx - 6 + ox, cy + 1 + oy, cx - 2 + ox, cy - 12 + oy, cx + 6 + ox, cy - 3 + oy, cx + 4 + ox, cy + 4 + oy], facet));
  shapes.push(line(cx - 4 + ox, cy - 4 + oy, cx + 3 + ox, cy + 3 + oy, mixHex(p.dark, body, 0.35), 1));
  if (lush) {
    shapes.push(ell(cx - 8 + ox, cy - 2 + oy, 8, 4, mixHex(p.secondary, "#3c633a", 0.4)));
    shapes.push(ell(cx + 3 + ox, cy + 1 + oy, 6, 3, mixHex(p.secondary, "#4f7743", 0.35)));
  }
  shapes.push(poly([cx - 2 + ox, cy - 13 + oy, cx + 15 + ox, cy - 2 + oy, cx + 8 + ox, cy, cx - 8 + ox, cy - 7 + oy], top, INK, 1));
}

function paintSandstone(
  shapes: ShapeSpec[],
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  const ox = signed(v, 3, 5);
  const oy = signed(v, 4, 2);
  const base = mixHex(p.secondary, p.dark, 0.22);
  const mid = mixHex(p.light, p.secondary, 0.28);
  const hi = mixHex(p.light, "#e8d2a8", 0.35);
  shapes.push(ell(cx - 16 + ox, cy + 2 + oy, 32, 10, "rgba(8, 12, 14, 0.42)"));
  shapes.push(poly([cx - 14 + ox, cy + 4 + oy, cx + 13 + ox, cy + 4 + oy, cx + 10 + ox, cy + 9 + oy, cx - 11 + ox, cy + 8 + oy], mixHex(base, "#171d20", 0.4), INK, 1));
  shapes.push(poly([cx - 12 + ox, cy + 4 + oy, cx + 11 + ox, cy + 3 + oy, cx + 9 + ox, cy - 1 + oy, cx - 10 + ox, cy], base, INK, 1));
  shapes.push(poly([cx - 11 + ox, cy, cx + 10 + ox, cy - 1 + oy, cx + 8 + ox, cy - 6 + oy, cx - 9 + ox, cy - 5 + oy], mid, INK, 1));
  shapes.push(poly([cx - 8 + ox, cy - 9 + oy, cx + 1 + ox, cy - 12 + oy, cx + 9 + ox, cy - 8 + oy, cx + 6 + ox, cy - 6 + oy, cx - 5 + ox, cy - 7 + oy], hi, INK, 1));
  shapes.push(line(cx - 9 + ox, cy - 1 + oy, cx + 8 + ox, cy - 2 + oy, mixHex(p.dark, base, 0.4), 1));
  shapes.push(line(cx - 8 + ox, cy + 3 + oy, cx + 7 + ox, cy + 2 + oy, mixHex(p.dark, base, 0.4), 1));
}

function paintSpriteBlocker(
  shapes: ShapeSpec[],
  kind: BlockerPropKind,
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  if (kind === "sandstone") {
    paintSandstone(shapes, p, v, cx, cy);
    return;
  }
  if (kind === "boulder" || kind === "snowRock") {
    paintBoulder(shapes, p, v, cx, cy, biome, kind === "snowRock");
    return;
  }
  const ox = signed(v, 3, 4);
  const oy = signed(v, 4, 2);
  const x = cx + ox;
  const y = cy + oy;
  shapes.push(ell(x - 14, y + 2, 28, 8, "rgba(8, 12, 14, 0.38)"));
  if (kind === "tree") {
    const canopy = biome === "salt marshes" ? "#3e5a3c" : "#2f5a30";
    const hi = biome === "salt marshes" ? "#6a7a48" : "#5a8a40";
    const lean = signed(v, 5, 2);
    shapes.push(line(x - 2, y + 5, x + 2, y + 5, mixHex(p.dark, "#3a2818", 0.4), 4));
    shapes.push(line(x, y + 4, x + lean, y - 18, mixHex(p.dark, "#3a2818", 0.4), 3));
    shapes.push(ell(x - 13, y - 18, 20, 13, mixHex(canopy, p.dark, 0.2), INK));
    shapes.push(ell(x - 1, y - 22, 16, 11, canopy));
    shapes.push(ell(x - 8, y - 14, 12, 8, mixHex(canopy, p.dark, 0.15)));
    shapes.push(ell(x + 6, y - 16, 10, 7, canopy));
    shapes.push(ell(x - 3, y - 26, 9, 6, hi));
    if (biome === "jungle wreckage" && pick(v, 9, 3) !== 1) {
      shapes.push(line(x - 4 + lean, y - 18, x - 7, y + 2, mixHex(canopy, "#274428", 0.4), 1));
      shapes.push(line(x + 6 + lean, y - 20, x + 8, y + 1, mixHex(canopy, "#274428", 0.4), 1));
    }
    return;
  }
  if (kind === "pine") {
    const needle = mixHex(p.secondary, "#30603e", 0.35);
    const snow = biome === "tundra grid";
    shapes.push(line(x, y + 4, x, y - 10, p.dark, 2));
    for (let i = 0; i < 5; i++) {
      const w = 16 - i * 2.4;
      const top = y - 1 - i * 6;
      shapes.push(poly(
        [x - w, top + 7, x, top - 6, x + w, top + 7],
        i >= 3 ? mixHex(needle, p.light, 0.18) : needle,
        INK,
        1,
      ));
      if (snow && i >= 2) {
        shapes.push(poly([x - w * 0.35, top + 1, x, top - 6, x + w * 0.35, top + 1], mixHex(p.light, "#e8f2f4", 0.45)));
      }
    }
    return;
  }
  if (kind === "deadTree" || kind === "deadShrub") {
    const wood = mixHex(p.dark, p.secondary, 0.25);
    const tall = kind === "deadTree";
    shapes.push(line(x, y + 4, x + signed(v, 6, 2), y - (tall ? 16 : 9), wood, tall ? 2 : 1));
    shapes.push(line(x - 1, y - 5, x - 7, y - (tall ? 12 : 8), wood, 1));
    shapes.push(line(x + 1, y - 6, x + 6, y - (tall ? 14 : 9), wood, 1));
    shapes.push(line(x, y - (tall ? 11 : 6), x - 3, y - (tall ? 17 : 11), wood, 1));
    shapes.push(line(x + 1, y - (tall ? 7 : 4), x + 4, y - (tall ? 10 : 6), wood, 1));
    if (!tall) {
      shapes.push(ell(x - 6, y - 8, 6, 3, mixHex(p.light, p.secondary, 0.3)));
      shapes.push(ell(x + 3, y - 9, 5, 2, mixHex(p.light, p.secondary, 0.3)));
      shapes.push(ell(x + 1, y - 12, 4, 2, mixHex(p.light, p.secondary, 0.25)));
    }
    return;
  }
  if (kind === "crystalOutcrop") {
    const gem = mixHex(p.accent, p.light, 0.35);
    shapes.push(poly([x - 11, y + 3, x + 12, y + 3, x + 8, y + 7, x - 8, y + 7], mixHex(p.dark, p.secondary, 0.3), INK, 1));
    shapes.push(poly([x - 9, y + 3, x - 5, y - 13, x - 1, y + 2], gem, INK, 1));
    shapes.push(poly([x - 2, y + 3, x + 2, y - 18, x + 6, y + 2], mixHex(gem, "#d8fff4", 0.3), INK, 1));
    shapes.push(poly([x + 3, y + 3, x + 8, y - 12, x + 12, y + 2], mixHex(p.dark, gem, 0.4), INK, 1));
    shapes.push(poly([x + 1, y + 3, x + 5, y - 9, x + 7, y + 2], mixHex(gem, p.dark, 0.25), INK, 1));
    shapes.push(poly([x + 1, y - 2, x + 2, y - 16, x + 5, y - 1], mixHex(gem, "#d8fff4", 0.45)));
    return;
  }
  if (kind === "wreckage") {
    const rust = mixHex(p.secondary, "#c16f3d", 0.4);
    const iron = mixHex(p.dark, p.secondary, 0.2);
    shapes.push(poly([x - 13, y + 3, x + 3, y - 7, x + 14, y + 1, x + 9, y + 7, x - 10, y + 7], iron, INK, 1));
    shapes.push(poly([x - 7, y + 1, x + 7, y - 4, x + 11, y + 2, x - 3, y + 5], rust, INK, 1));
    shapes.push(poly([x - 10, y + 2, x - 2, y - 3, x + 1, y + 2, x - 7, y + 5], mixHex(iron, p.light, 0.16)));
    shapes.push(line(x - 8, y + 2, x + 6, y - 2, mixHex(p.light, rust, 0.4), 1));
    shapes.push(line(x + 8, y + 1, x + 13, y - 8, mixHex(p.light, rust, 0.35), 2));
    for (let i = 0; i < 4; i++) shapes.push(ell(x - 7 + i * 3, y + 1 + (i % 2), 1.2, 1, mixHex(p.light, rust, 0.3)));
    return;
  }
  const rock = mixHex(p.secondary, p.dark, 0.25);
  const glow = mixHex(p.accent, "#d25024", 0.4);
  shapes.push(ell(x - 9, y + 4, 18, 6, mixHex(p.dark, glow, 0.22)));
  shapes.push(poly([x - 8, y + 5, x - 2, y - 17, x + 3, y - 9, x + 8, y + 5, x - 4, y + 7], rock, INK, 1));
  shapes.push(poly([x - 1, y + 2, x - 2, y - 15, x + 2, y - 6], glow));
  shapes.push(line(x, y + 3, x - 1, y - 14, mixHex(glow, "#ff8c3c", 0.35), 1));
}

export function paintBlocker(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  paintSpriteBlocker(shapes, blockerPropKind(biome, v), biome, p, v, cx, cy);
}
