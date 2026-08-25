import { TILE_H } from "../../iso";
import type { SimState } from "../../types";
import { fogAt } from "../../sim/fog";
import { biomeMaterials, fogTerrainGain, oreCrystalCluster, tileVariant } from "../terrainAtlas";
import { tileToScreen, type Camera } from "../../iso";

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

export function drawBlockerProp(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
): void {
  const v = tileVariant(state.seed, x, y);
  const mats = biomeMaterials(state.biome);
  const lush = state.biome === "jungle wreckage" || state.biome === "salt marshes";
  const ox = ((v % 7) - 3) * z * 0.4;
  const oy = ((Math.floor(v / 11) % 5) - 2) * z * 0.2;
  const body = lush
    ? `rgb(${mats.blocked.r},${Math.min(255, mats.blocked.g + 18)},${mats.blocked.b})`
    : `rgb(${mats.blocked.r},${mats.blocked.g},${mats.blocked.b})`;
  const top = `rgb(${mats.light.r},${mats.light.g},${mats.light.b})`;
  const side = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  ctx.save();
  ctx.translate(sx + ox, sy + TILE_H * z * 0.42 + oy);
  ctx.fillStyle = "rgba(6,10,12,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 6 * z, 16 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(-14 * z, 2 * z);
  ctx.lineTo(13 * z, 3 * z);
  ctx.lineTo(9 * z, 9 * z);
  ctx.lineTo(-11 * z, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-12 * z, 2 * z);
  ctx.lineTo(-3 * z, -11 * z);
  ctx.lineTo(12 * z, -1 * z);
  ctx.lineTo(8 * z, 5 * z);
  ctx.lineTo(-9 * z, 5 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-3 * z, -11 * z);
  ctx.lineTo(12 * z, -1 * z);
  ctx.lineTo(4 * z, 1 * z);
  ctx.lineTo(-7 * z, -6 * z);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function rgbMix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgb(${Math.round(a.r + (b.r - a.r) * u)},${Math.round(a.g + (b.g - a.g) * u)},${Math.round(a.b + (b.b - a.b) * u)})`;
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
