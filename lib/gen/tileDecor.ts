import type { BiomeName, Palette, ShapeSpec } from "../types";
import { ell, irregularIso, line, poly } from "./shapePrimitives";
import { pick, signed } from "./tilePalette";

const INK = "#202a32";

export function paintBiomeLandmark(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  const feature = pick(v, 263, 3);
  if (biome === "jungle wreckage") {
    if (feature === 0) {
      shapes.push(line(cx - 23, cy + 5, cx + 20, cy - 3, "#17271b", 4));
      shapes.push(line(cx - 8, cy + 2, cx - 2, cy - 9, "#4f7743", 2));
      shapes.push(ell(cx + 8, cy - 8, 16, 8, "#315b35", INK));
    } else if (feature === 1) {
      shapes.push(ell(cx - 20, cy - 7, 40, 14, "#18372f", "#10281f"));
      shapes.push(ell(cx - 11, cy - 5, 20, 7, "#397365"));
      shapes.push(ell(cx + 9, cy - 1, 8, 4, "#6a8458"));
    } else {
      shapes.push(poly([cx - 20, cy + 4, cx - 9, cy - 7, cx + 19, cy, cx + 7, cy + 7], "#5a4939", "#1b201c", 1));
      shapes.push(line(cx - 13, cy - 2, cx + 13, cy + 3, "#b0733d", 2));
      shapes.push(ell(cx - 14, cy - 7, 9, 5, "#3c633a"));
    }
  } else if (biome === "ash plains") {
    if (feature === 0) {
      shapes.push(ell(cx - 23, cy - 8, 46, 17, "#292f2d", "#171b19"));
      shapes.push(ell(cx - 12, cy - 4, 24, 8, "#111614"));
    } else if (feature === 1) {
      shapes.push(line(cx - 24, cy + 5, cx + 22, cy - 5, "#242a27", 5));
      shapes.push(line(cx - 18, cy + 3, cx + 18, cy - 4, "#7b8179", 1));
    } else {
      shapes.push(poly(irregularIso(cx, cy, 42, 16, 3), "#657069", "#202623", 1));
      shapes.push(line(cx - 12, cy + 4, cx + 9, cy - 5, "#313835", 2));
    }
  } else if (biome === "crystal flats") {
    for (let i = 0; i < 3 + feature; i++) {
      const ox = -16 + i * 8;
      shapes.push(poly([cx + ox - 4, cy + 5, cx + ox, cy - 10 - (i % 3) * 2, cx + ox + 4, cy + 4], i % 2 ? "#79b9ad" : "#9ce4d5", "#263c38", 1));
    }
  } else if (biome === "rust canyons") {
    shapes.push(line(cx - 25, cy + 5, cx + 23, cy - 5 + feature * 3, "#43281d", 5));
    shapes.push(line(cx - 20, cy + 3, cx + 19, cy - 4 + feature * 3, feature === 2 ? "#d38345" : "#8f4c2d", 2));
    if (feature === 1) shapes.push(poly([cx - 10, cy + 3, cx - 2, cy - 9, cx + 12, cy + 1], "#885334", "#2c1b14", 1));
  } else if (biome === "salt marshes") {
    shapes.push(ell(cx - 23, cy - 8, 46, 16, feature === 0 ? "#243f37" : "#586044", "#1a3029"));
    for (let i = 0; i < 4 + feature; i++) shapes.push(line(cx - 17 + i * 7, cy + 4, cx - 16 + i * 7, cy - 8 - (i % 2) * 3, "#879064", 1));
  } else if (biome === "glass desert") {
    shapes.push(poly([cx - 24, cy + 4, cx - 8, cy - 10 - feature, cx + 24, cy + 2, cx + 6, cy + 9], feature === 1 ? "#292f31" : "#75664f", "#b9aa8b", 1));
    shapes.push(line(cx - 7, cy - 9, cx + 14, cy, "#e3d4b2", 1));
  } else if (biome === "tundra grid") {
    shapes.push(poly(irregularIso(cx, cy, 48, 19, 2), feature === 0 ? "#85a4aa" : "#a6bcb9", "#39545b", 1));
    shapes.push(line(cx - 22, cy - 4, cx + 20, cy + 6, "#d4eeee", 2));
    if (feature === 2) shapes.push(line(cx - 13, cy + 5, cx + 4, cy - 7, "#526d72", 2));
  } else {
    shapes.push(line(cx - 24, cy - 4, cx - 3, cy + feature - 1, "#151313", 5));
    shapes.push(line(cx - 3, cy + feature - 1, cx + 23, cy - 4, feature === 1 ? "#8e2c22" : "#d04b2c", 3));
    shapes.push(line(cx - 2, cy + feature - 2, cx + 20, cy - 4, "#ff9a46", 1));
  }
  if (feature === 2) shapes.push(ell(cx + signed(v, 264, 12), cy + signed(v, 265, 4), 6, 3, p.dark));
}

export function paintBiomeSignature(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  const ox = signed(v, 270, 10);
  const oy = signed(v, 271, 3);
  if (biome === "ash plains") {
    shapes.push(ell(cx + ox - 6, cy + oy - 2, 12, 5, "#2a302c", "#667068"));
    shapes.push(ell(cx + ox - 3, cy + oy - 1, 6, 2.5, "#151a18"));
  } else if (biome === "crystal flats") {
    shapes.push(poly([cx + ox - 4, cy + oy + 3, cx + ox - 1, cy + oy - 6, cx + ox + 1, cy + oy + 2], "#92b8ac", "#263c38", 1));
    shapes.push(poly([cx + ox, cy + oy + 3, cx + ox + 5, cy + oy - 3, cx + ox + 4, cy + oy + 4], "#6f9188", "#263c38", 1));
  } else if (biome === "rust canyons") {
    shapes.push(line(cx + ox - 7, cy + oy, cx + ox + 7, cy + oy + 3, "#3d2b22", 3));
    shapes.push(line(cx + ox - 5, cy + oy - 1, cx + ox + 5, cy + oy + 1, "#a7683f", 1));
  } else if (biome === "salt marshes") {
    for (let i = -2; i <= 2; i++) shapes.push(line(cx + ox + i * 2, cy + oy + 3, cx + ox + i * 2 + (i % 2), cy + oy - 5 - Math.abs(i), "#778465", 1));
  } else if (biome === "glass desert") {
    shapes.push(poly([cx + ox - 8, cy + oy + 3, cx + ox - 2, cy + oy - 4, cx + ox + 8, cy + oy + 2, cx + ox + 1, cy + oy + 4], "#262b2c", "#9a9d95", 1));
    shapes.push(line(cx + ox - 2, cy + oy - 3, cx + ox + 5, cy + oy + 1, "#d0c4aa", 1));
  } else if (biome === "tundra grid") {
    shapes.push(poly([cx + ox - 9, cy + oy + 1, cx + ox - 4, cy + oy - 4, cx + ox + 8, cy + oy - 1, cx + ox + 2, cy + oy + 3], "#718f94", "#46545a", 1));
    shapes.push(ell(cx + ox - 3, cy + oy - 1, 7, 2, "#a7b7ba"));
  } else if (biome === "jungle wreckage") {
    shapes.push(line(cx + ox - 8, cy + oy, cx + ox + 8, cy + oy + 2, "#17271b", 2));
    shapes.push(ell(cx + ox - 5, cy + oy - 4, 8, 4, "#547448", INK));
    shapes.push(ell(cx + ox + 1, cy + oy - 3, 7, 4, "#385f3d", INK));
  } else if (biome === "volcanic shelf") {
    shapes.push(line(cx + ox - 8, cy + oy - 2, cx + ox, cy + oy + 1, "#1c1716", 3));
    shapes.push(line(cx + ox, cy + oy + 1, cx + ox + 8, cy + oy - 1, "#c54f2b", 2));
    shapes.push(line(cx + ox + 1, cy + oy + 1, cx + ox + 6, cy + oy, "#ff9a42", 1));
  }
  if (pick(v, 272, 5) === 0) shapes.push(ell(cx - ox * 0.4, cy - oy, 4, 2, p.light));
}

export function pushBush(shapes: ShapeSpec[], x: number, y: number, v: number, biome: BiomeName): void {
  const canopy = canopyColors(biome);
  const w = 9 + pick(v, 16, 6);
  shapes.push(ell(x - w / 2, y + 1, w, 4, "rgba(10,12,8,0.32)"));
  shapes.push(ell(x - w / 2 - 1, y - 5, w * 0.7, 6, canopy.dark, INK));
  shapes.push(ell(x - w / 2 + 3, y - 6, w * 0.55, 5, canopy.mid));
  if (pick(v, 17, 2) === 0) shapes.push(ell(x + 1, y - 4, 4, 3, canopy.hi));
}

function canopyColors(biome: BiomeName): { dark: string; mid: string; hi: string } {
  switch (biome) {
    case "jungle wreckage": return { dark: "#1e3a22", mid: "#2f5a30", hi: "#5a8a40" };
    case "salt marshes": return { dark: "#2a4030", mid: "#3e5a3c", hi: "#6a7a48" };
    case "tundra grid": return { dark: "#3a4a44", mid: "#4e6058", hi: "#7a8a78" };
    case "crystal flats": return { dark: "#2a3c32", mid: "#3e5844", hi: "#6a8a62" };
    default: return { dark: "#2a3a26", mid: "#3c5234", hi: "#5a7044" };
  }
}
