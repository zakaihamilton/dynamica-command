import type { Palette } from "../../types";
import type { UnitModel } from "./modelLoader";

function parseHex(hex: string): [number, number, number] {
  if (hex.startsWith("#")) {
    if (hex.length === 4) {
      return [
        parseInt(hex[1]! + hex[1]!, 16) || 0,
        parseInt(hex[2]! + hex[2]!, 16) || 0,
        parseInt(hex[3]! + hex[3]!, 16) || 0,
      ];
    }
    return [
      parseInt(hex.slice(1, 3), 16) || 0,
      parseInt(hex.slice(3, 5), 16) || 0,
      parseInt(hex.slice(5, 7), 16) || 0,
    ];
  }
  return [120, 140, 160];
}

function shadeColor(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  const nr = Math.max(0, Math.min(255, Math.round(r * factor)));
  const ng = Math.max(0, Math.min(255, Math.round(g * factor)));
  const nb = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `rgb(${nr},${ng},${nb})`;
}

export function draw3dModel(
  ctx: CanvasRenderingContext2D,
  model: UnitModel,
  screenX: number,
  screenY: number,
  scale: number,
  yawAngle: number,
  palette?: Palette,
  recoil: number = 0,
): void {
  const cos = Math.cos(yawAngle);
  const sin = Math.sin(yawAngle);

  // Isometric projection constants matching Genesis Protocol's tile ratio (2:1)
  const isoX = 20 * scale;
  const isoY = 10 * scale;
  const isoZ = 16 * scale;

  // Sun light direction vector (from top-left)
  const lx = 0.45;
  const ly = -0.55;
  const lz = 0.70;

  type Tri = {
    p0: [number, number];
    p1: [number, number];
    p2: [number, number];
    depth: number;
    color: string;
    stroke: string;
  };

  const tris: Tri[] = [];

  for (const node of model.nodes) {
    const isBarrel = node.name === "barrel";
    const { positions, normals, masks, indices } = node.mesh;
    const count = indices.length;

    for (let i = 0; i < count; i += 3) {
      const i0 = indices[i]!;
      const i1 = indices[i + 1]!;
      const i2 = indices[i + 2]!;

      // Vertex 0
      let x0 = positions[i0 * 3]!;
      const y0 = positions[i0 * 3 + 1]!;
      const z0 = positions[i0 * 3 + 2]!;
      // Vertex 1
      let x1 = positions[i1 * 3]!;
      const y1 = positions[i1 * 3 + 1]!;
      const z1 = positions[i1 * 3 + 2]!;
      // Vertex 2
      let x2 = positions[i2 * 3]!;
      const y2 = positions[i2 * 3 + 1]!;
      const z2 = positions[i2 * 3 + 2]!;

      if (isBarrel && recoil > 0) {
        x0 -= recoil * 0.08;
        x1 -= recoil * 0.08;
        x2 -= recoil * 0.08;
      }

      // Rotate around Z axis by yawAngle
      const rx0 = x0 * cos - y0 * sin;
      const ry0 = x0 * sin + y0 * cos;
      const rx1 = x1 * cos - y1 * sin;
      const ry1 = x1 * sin + y1 * cos;
      const rx2 = x2 * cos - y2 * sin;
      const ry2 = x2 * sin + y2 * cos;

      // Project to isometric screen coordinates
      const sx0 = screenX + (rx0 - ry0) * isoX;
      const sy0 = screenY + (rx0 + ry0) * isoY - z0 * isoZ;
      const sx1 = screenX + (rx1 - ry1) * isoX;
      const sy1 = screenY + (rx1 + ry1) * isoY - z1 * isoZ;
      const sx2 = screenX + (rx2 - ry2) * isoX;
      const sy2 = screenY + (rx2 + ry2) * isoY - z2 * isoZ;

      // Backface culling in 2D projection
      const cross = (sx1 - sx0) * (sy2 - sy0) - (sy1 - sy0) * (sx2 - sx0);
      if (cross >= 0) continue;

      // Rotated normal for lighting calculation
      const nx = normals[i0 * 3]!;
      const ny = normals[i0 * 3 + 1]!;
      const nz = normals[i0 * 3 + 2]!;
      const rnx = nx * cos - ny * sin;
      const rny = nx * sin + ny * cos;
      const rnz = nz;

      const dot = rnx * lx + rny * ly + rnz * lz;
      const lightFactor = Math.max(0.35, Math.min(1.3, 0.7 + 0.55 * dot));

      // Material color
      const mask = masks[i0] ?? 0;
      let baseColor = "#3c4856";
      let strokeColor = "#1a222a";
      if (mask === 1) {
        baseColor = palette?.primary ?? "#4a5d6e";
        strokeColor = shadeColor(baseColor, 0.5);
      } else if (mask === 2) {
        baseColor = palette?.secondary ?? "#6b7c8d";
        strokeColor = shadeColor(baseColor, 0.5);
      } else if (mask === 3) {
        baseColor = "#46e2ff";
        strokeColor = "#1cb0cc";
      } else if (mask === 4) {
        baseColor = "#262f38";
        strokeColor = "#12171c";
      }

      const color = mask === 3 ? baseColor : shadeColor(baseColor, lightFactor);
      const depth = (rx0 + ry0 + rx1 + ry1 + rx2 + ry2) / 3 - ((z0 + z1 + z2) / 3) * 0.15;

      tris.push({
        p0: [sx0, sy0],
        p1: [sx1, sy1],
        p2: [sx2, sy2],
        depth,
        color,
        stroke: strokeColor,
      });
    }
  }

  // Painter's sorting
  tris.sort((a, b) => a.depth - b.depth);

  ctx.save();
  ctx.lineWidth = Math.max(0.5, 0.75 * scale);
  for (const tri of tris) {
    ctx.fillStyle = tri.color;
    ctx.strokeStyle = tri.stroke;
    ctx.beginPath();
    ctx.moveTo(tri.p0[0], tri.p0[1]);
    ctx.lineTo(tri.p1[0], tri.p1[1]);
    ctx.lineTo(tri.p2[0], tri.p2[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
