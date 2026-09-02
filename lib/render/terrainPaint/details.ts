import { TILE_H } from "../../iso";
import type { BiomeName, SimState } from "../../types";
import { fogAt } from "../../sim/fog";
import { biomeMaterials, fogTerrainGain, oreCrystalCluster, tileVariant } from "../terrainAtlas";
import type { BiomeMaterials } from "../terrainMaterials";
import { tileToScreen, type Camera } from "../../iso";
import { blockerPropKind, type BlockerPropKind } from "./scatter";
import { mixRgb, rgbOf, withAlpha } from "./style";

export function smoothFogGain(state: SimState, x: number, y: number): number {
  let sum = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += fogTerrainGain(fogAt(state, x + dx, y + dy));
      count += 1;
    }
  }
  return sum / count;
}

function liftGreen(c: { r: number; g: number; b: number }, amount: number): { r: number; g: number; b: number } {
  return { r: c.r, g: Math.min(255, c.g + amount), b: c.b };
}

function blobShadow(ctx: CanvasRenderingContext2D, z: number, rx: number, ry: number, dy = 6): void {
  ctx.fillStyle = "rgba(6,10,12,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, dy * z, rx * z, ry * z, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoulder(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  lush: boolean,
  snowCap: boolean,
): void {
  const body = lush ? liftGreen(mats.blocked, 18) : mats.blocked;
  blobShadow(ctx, z, 16, 5);
  ctx.fillStyle = rgbOf(mats.dark);
  ctx.beginPath();
  ctx.moveTo(-14 * z, 2 * z);
  ctx.lineTo(13 * z, 3 * z);
  ctx.lineTo(9 * z, 9 * z);
  ctx.lineTo(-11 * z, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(body);
  ctx.beginPath();
  ctx.moveTo(-12 * z, 2 * z);
  ctx.lineTo(-3 * z, -11 * z);
  ctx.lineTo(12 * z, -1 * z);
  ctx.lineTo(8 * z, 5 * z);
  ctx.lineTo(-9 * z, 5 * z);
  ctx.closePath();
  ctx.fill();
  withAlpha(ctx, snowCap ? 0.82 : 0.55, () => {
    ctx.fillStyle = rgbOf(snowCap ? mixRgb(mats.light, { r: 236, g: 244, b: 246 }, 0.55) : mats.light);
    ctx.beginPath();
    ctx.moveTo(-3 * z, -11 * z);
    ctx.lineTo(12 * z, -1 * z);
    ctx.lineTo(4 * z, 1 * z);
    ctx.lineTo(-7 * z, -6 * z);
    ctx.closePath();
    ctx.fill();
  });
}

function drawCanopyTree(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const lean = ((v % 5) - 2) * z * 0.55;
  const dark = mixRgb(mats.high, mats.blocked, 0.28);
  const mid = liftGreen(mats.high, 28);
  const hi = mats.light;
  blobShadow(ctx, z, 18, 5.4);
  ctx.strokeStyle = rgbOf(mixRgb(mats.dark, { r: 62, g: 42, b: 28 }, 0.45));
  ctx.lineWidth = Math.max(2.4, 3.8 * z);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 6 * z);
  ctx.lineTo(lean, -18 * z);
  ctx.stroke();
  ctx.fillStyle = rgbOf(dark);
  ctx.beginPath();
  ctx.ellipse(-9 * z + lean * 0.28, -18 * z, 16 * z, 10 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbOf(mid);
  ctx.beginPath();
  ctx.ellipse(5 * z + lean, -21 * z, 13 * z, 8.6 * z, 0.12, 0, Math.PI * 2);
  ctx.fill();
  withAlpha(ctx, 0.5, () => {
    ctx.fillStyle = rgbOf(hi);
    ctx.beginPath();
    ctx.ellipse(2 * z + lean, -24 * z, 7.2 * z, 4.4 * z, -0.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPine(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const lean = ((v % 3) - 1) * z * 0.3;
  const needle = mixRgb(mats.high, { r: 48, g: 96, b: 62 }, 0.35);
  const dark = mixRgb(mats.mid, needle, 0.4);
  blobShadow(ctx, z, 14, 4.6);
  ctx.strokeStyle = rgbOf(mats.dark);
  ctx.lineWidth = Math.max(1.8, 2.8 * z);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 6 * z);
  ctx.lineTo(lean, -8 * z);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const w = (16 - i * 3.6) * z;
    const y = (-5 - i * 8) * z;
    ctx.fillStyle = rgbOf(i === 2 ? mixRgb(needle, mats.light, 0.18) : dark);
    ctx.beginPath();
    ctx.moveTo(-w + lean, y + 8 * z);
    ctx.lineTo(lean, y - 7 * z);
    ctx.lineTo(w + lean, y + 8 * z);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDeadTree(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const wood = mixRgb(mats.dark, mats.blocked, 0.25);
  blobShadow(ctx, z, 10, 3.4);
  ctx.strokeStyle = rgbOf(wood);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, 2.3 * z);
  ctx.beginPath();
  ctx.moveTo(0, 5 * z);
  ctx.lineTo(((v % 5) - 2) * z * 0.3, -14 * z);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.1, 1.5 * z);
  ctx.beginPath();
  ctx.moveTo(-0.4 * z, -6 * z);
  ctx.lineTo(-6 * z, -11 * z);
  ctx.moveTo(0.6 * z, -8 * z);
  ctx.lineTo(5.5 * z, -12 * z);
  ctx.stroke();
}

function drawCrystalOutcrop(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const gem = mixRgb(mats.ore, mats.light, 0.42);
  const dark = mixRgb(mats.dark, mats.ore, 0.38);
  blobShadow(ctx, z, 12, 4);
  const shards = [
    { lean: -6, rise: 14, half: 4.2 },
    { lean: 2, rise: 18, half: 3.4 },
    { lean: 8, rise: 11, half: 3.8 },
  ];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i]!;
    const twist = ((v >>> (i * 2)) % 5 - 2) * 0.4;
    ctx.fillStyle = rgbOf(i === 1 ? gem : dark);
    ctx.beginPath();
    ctx.moveTo((shard.lean - shard.half) * z, 3 * z);
    ctx.lineTo((shard.lean + twist) * z, -shard.rise * z);
    ctx.lineTo((shard.lean + shard.half) * z, 2.4 * z);
    ctx.closePath();
    ctx.fill();
  }
  withAlpha(ctx, 0.45, () => {
    ctx.fillStyle = rgbOf(mixRgb(gem, { r: 230, g: 255, b: 248 }, 0.4));
    ctx.beginPath();
    ctx.moveTo(1 * z, -2 * z);
    ctx.lineTo(2 * z, -16 * z);
    ctx.lineTo(4.5 * z, -1 * z);
    ctx.closePath();
    ctx.fill();
  });
}

function drawWreckage(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const rust = mixRgb(mats.ore, mats.blocked, 0.28);
  const iron = mixRgb(mats.dark, mats.blocked, 0.15);
  blobShadow(ctx, z, 14, 4.4);
  ctx.fillStyle = rgbOf(iron);
  ctx.beginPath();
  ctx.moveTo(-12 * z, 3 * z);
  ctx.lineTo(4 * z, -6 * z);
  ctx.lineTo(13 * z, 1 * z);
  ctx.lineTo(8 * z, 7 * z);
  ctx.lineTo(-9 * z, 7 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(rust);
  ctx.beginPath();
  ctx.moveTo(-6 * z, 1 * z);
  ctx.lineTo(7 * z, -4 * z);
  ctx.lineTo(10 * z, 2 * z);
  ctx.lineTo(-3 * z, 5 * z);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbOf(mixRgb(mats.light, rust, 0.4));
  ctx.lineWidth = Math.max(0.8, 1.1 * z);
  ctx.beginPath();
  ctx.moveTo(-8 * z, 2 * z);
  ctx.lineTo(6 * z, -2 * z + (v % 3) * z * 0.4);
  ctx.stroke();
}

function drawSpire(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const rock = mixRgb(mats.blocked, mats.dark, 0.2);
  const glow = mixRgb(mats.ore, { r: 210, g: 80, b: 36 }, 0.4);
  blobShadow(ctx, z, 10, 3.6);
  ctx.fillStyle = rgbOf(rock);
  ctx.beginPath();
  ctx.moveTo(-7 * z, 5 * z);
  ctx.lineTo(-2 * z, -16 * z);
  ctx.lineTo(3 * z, -8 * z);
  ctx.lineTo(8 * z, 5 * z);
  ctx.lineTo(-4 * z, 7 * z);
  ctx.closePath();
  ctx.fill();
  withAlpha(ctx, 0.55, () => {
    ctx.fillStyle = rgbOf(glow);
    ctx.beginPath();
    ctx.moveTo(-1 * z, 2 * z);
    ctx.lineTo(-1.4 * z, -14 * z);
    ctx.lineTo(1.6 * z, -6 * z);
    ctx.closePath();
    ctx.fill();
  });
  if (v % 2 === 0) {
    withAlpha(ctx, 0.28, () => {
      ctx.fillStyle = rgbOf(mats.light);
      ctx.beginPath();
      ctx.moveTo(-2 * z, -10 * z);
      ctx.lineTo(-2 * z, -16 * z);
      ctx.lineTo(0.6 * z, -11 * z);
      ctx.closePath();
      ctx.fill();
    });
  }
}

function drawDeadShrub(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const wood = mixRgb(mats.dark, mats.blocked, 0.2);
  const dust = mixRgb(mats.light, mats.blocked, 0.35);
  blobShadow(ctx, z, 11, 3.5);
  ctx.strokeStyle = rgbOf(wood);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.2, 1.7 * z);
  ctx.beginPath();
  ctx.moveTo(0, 5 * z);
  ctx.lineTo(((v % 3) - 1) * z * 0.4, -8 * z);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.9, 1.15 * z);
  ctx.beginPath();
  ctx.moveTo(-0.6 * z, -3 * z);
  ctx.lineTo(-7 * z, -8 * z);
  ctx.moveTo(0.5 * z, -4 * z);
  ctx.lineTo(6.5 * z, -9 * z);
  ctx.moveTo(0, -6 * z);
  ctx.lineTo(2 * z, -12 * z);
  ctx.stroke();
  withAlpha(ctx, 0.55, () => {
    ctx.fillStyle = rgbOf(dust);
    ctx.beginPath();
    ctx.ellipse(-4 * z, -7 * z, 3.2 * z, 1.6 * z, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4.2 * z, -8 * z, 2.8 * z, 1.4 * z, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function paintBlocker(
  ctx: CanvasRenderingContext2D,
  kind: BlockerPropKind,
  mats: BiomeMaterials,
  z: number,
  v: number,
  lush: boolean,
): void {
  switch (kind) {
    case "tree":
      drawCanopyTree(ctx, mats, z, v);
      return;
    case "pine":
      drawPine(ctx, mats, z, v);
      return;
    case "deadTree":
      drawDeadTree(ctx, mats, z, v);
      return;
    case "crystalOutcrop":
      drawCrystalOutcrop(ctx, mats, z, v);
      return;
    case "wreckage":
      drawWreckage(ctx, mats, z, v);
      return;
    case "spire":
      drawSpire(ctx, mats, z, v);
      return;
    case "deadShrub":
      drawDeadShrub(ctx, mats, z, v);
      return;
    case "sandstone":
      drawBoulder(ctx, mats, z, false, false);
      return;
    case "snowRock":
      drawBoulder(ctx, mats, z, false, true);
      return;
    case "boulder":
      drawBoulder(ctx, mats, z, lush, false);
      return;
  }
}

export function drawBlockerProp(
  ctx: CanvasRenderingContext2D,
  state: { seed: number; biome: BiomeName },
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
): void {
  const v = tileVariant(state.seed, x, y);
  const mats = biomeMaterials(state.biome);
  const kind = blockerPropKind(state.biome, v);
  const ox = ((v % 7) - 3) * z * 0.4;
  const oy = ((Math.floor(v / 11) % 5) - 2) * z * 0.2;
  ctx.save();
  ctx.translate(sx + ox, sy + TILE_H * z * 0.42 + oy);
  const lush = state.biome === "jungle wreckage" || state.biome === "salt marshes";
  paintBlocker(ctx, kind, mats, z, v, lush);
  ctx.restore();
}

export function rgbMix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  return rgbOf(mixRgb(a, b, t));
}

export function drawOreCrystals(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  elev: number,
  z: number,
): void {
  const cluster = oreCrystalCluster(state, x, y);
  if (!cluster) return;
  const mats = biomeMaterials(state.biome);
  const s = tileToScreen(x, y, cam, elev);
  const gemDark = rgbMix(mats.ore, mats.dark, 0.42);
  const gem = rgbMix(mats.ore, mats.light, 0.38);
  const gemHi = rgbMix(mats.light, { r: 255, g: 246, b: 210 }, 0.62);
  ctx.save();
  ctx.translate(s.x, s.y);
  const alpha = ctx.globalAlpha * cluster.intensity;
  ctx.fillStyle = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  for (const burst of cluster.bursts) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.beginPath();
    ctx.ellipse(burst.dx * z, burst.dy * z + 1.1 * z, 6.2 * z, 2.35 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  for (const shard of cluster.shards) {
    const ox = shard.dx * z;
    const oy = shard.dy * z;
    const tipX = ox + shard.lean * z;
    const tipY = oy - shard.rise * z;
    const vx = tipX - ox;
    const vy = tipY - oy;
    const len = Math.hypot(vx, vy);
    if (len < 0.5 * z) continue;
    const ux = vx / len;
    const uy = vy / len;
    const px = -uy;
    const py = ux;
    const half = shard.half * z;
    const buried = shard.buried * z;
    const midT = 0.34 + shard.twist * 0.05;
    const bx = ox - ux * buried;
    const by = oy - uy * buried;
    const mx = bx + (tipX - bx) * midT;
    const my = by + (tipY - by) * midT;
    const ntx = tipX - ux * 0.55 * z;
    const nty = tipY - uy * 0.55 * z;
    const baseW = half * 0.42;
    const midW = half;
    const tipW = half * 0.16;
    const baseL = { x: bx + px * baseW, y: by + py * baseW };
    const baseR = { x: bx - px * baseW, y: by - py * baseW };
    const midL = { x: mx + px * midW, y: my + py * midW };
    const midR = { x: mx - px * midW, y: my - py * midW };
    const tipL = { x: ntx + px * tipW, y: nty + py * tipW };
    const tipR = { x: ntx - px * tipW, y: nty - py * tipW };
    ctx.fillStyle = gemDark;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipR.x, tipR.y);
    ctx.lineTo(midR.x, midR.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(bx + ux * buried * 0.2, by + uy * buried * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gemHi;
    ctx.globalAlpha = alpha * 0.7;
    const hx = bx + ux * len * 0.14;
    const hy = by + uy * len * 0.14;
    ctx.beginPath();
    ctx.moveTo(hx + px * half * 0.12, hy + py * half * 0.12);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(hx - px * half * 0.22, hy - py * half * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.82;
    ctx.strokeStyle = gemHi;
    ctx.lineWidth = Math.max(0.65, 0.55 * z);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}
