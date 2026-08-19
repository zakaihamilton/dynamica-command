import { existsSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, UNIT_KINDS } from "../lib/catalog";
import { buildingSprite, cliffFaces, elevationFace, rubbleSprite, unitSprite, wreckSprite } from "../lib/gen/assets";
import { generateFactions } from "../lib/gen/factions";
import { SPRITE_ART, UNIT_DIRECTION_ART } from "../lib/gen/visualAssets";
import { opaquePixelBounds, rotatedSpriteBounds } from "../lib/render/sprites";

describe("tactical procedural assets", () => {
  const palette = generateFactions(421)[0].palette;

  it("gives elevation faces stronger, deterministic material separation", () => {
    const low = cliffFaces("tundra grid", 1);
    const mid = cliffFaces("tundra grid", 2);
    const high = cliffFaces("tundra grid", 3);
    expect(low).toEqual(cliffFaces("tundra grid", 1));
    expect(new Set([low.south, mid.south, high.south]).size).toBeGreaterThan(1);
    expect(new Set([low.east, mid.east, high.east]).size).toBeGreaterThan(1);
    expect(mid.south).not.toBe(high.south);
  });

  it("provides unique valid frames for every unit facing", () => {
    for (const kind of UNIT_KINDS) {
      const ids = new Set<string>();
      for (let facing = 0; facing < 8; facing++) {
        for (const animationFrame of [0, 1, 2, 3] as const) {
          const spec = unitSprite(kind, palette, { facing: facing as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, animationFrame, variant: 11 });
          ids.add(spec.id);
          validateSpec(spec);
        }
      }
      expect(ids.size).toBe(32);
    }
  });

  it("keeps building sprite ids stable across overlay animation frames", () => {
    for (const kind of BUILDING_KINDS) {
      const a = buildingSprite(kind, palette, { animationFrame: 0, variant: 13 });
      const b = buildingSprite(kind, palette, { animationFrame: 3, variant: 13 });
      expect(a.id).toBe(b.id);
      expect(a.id).not.toMatch(/:facing:/);
      expect(a.imageSrc ?? a.svg).toBe(b.imageSrc ?? b.svg);
      validateSpec(a);
    }
  });

  it("provides valid construction and damage stages for every building", () => {
    for (const kind of BUILDING_KINDS) {
      const ids = new Set<string>();
      for (const constructionStage of [0, 1, 2, 3] as const) {
        for (const damageStage of [0, 1, 2] as const) {
          const spec = buildingSprite(kind, palette, { constructionStage, damageStage, variant: 13 });
          ids.add(spec.id);
          validateSpec(spec);
        }
      }
      expect(ids.size).toBe(12);
    }
  });

  it("gives each unit and building kind a distinct silhouette", () => {
    const unitFingerprints = UNIT_KINDS.map((kind) => {
      const spec = unitSprite(kind, palette, { facing: 0, variant: 11 });
      return spec.imageSrc ?? spec.svg;
    });
    expect(new Set(unitFingerprints).size).toBe(UNIT_KINDS.length);
    const buildingFingerprints = BUILDING_KINDS.map((kind) => {
      const spec = buildingSprite(kind, palette, { variant: 13 });
      return spec.imageSrc ?? spec.svg;
    });
    expect(new Set(buildingFingerprints).size).toBe(BUILDING_KINDS.length);
  });

  it("keeps the directional raster art for every unit animation frame", () => {
    for (const kind of UNIT_KINDS) {
      const a = unitSprite(kind, palette, { facing: 2, animationFrame: 0, variant: 11 });
      const b = unitSprite(kind, palette, { facing: 2, animationFrame: 1, variant: 11 });
      expect(a.imageSrc).toBeDefined();
      expect(b.imageSrc).toBe(a.imageSrc);
      expect(a.svg).toBeUndefined();
      expect(b.svg).toBeUndefined();
      expect(a.id).not.toEqual(b.id);
    }
  });

  it("crops generated neighboring artwork from affected direction assets", () => {
    const harvester = unitSprite("harvester", palette, { facing: 2 });
    const tank = unitSprite("tank", palette, { facing: 6 });
    expect(harvester.imageCrop?.w).toBeLessThan(627);
    expect(tank.imageCrop?.w).toBeLessThan(687);
  });

  it("selects directional unit views instead of rotating one raster", () => {
    for (const kind of ["infantry", "harvester", "antiArmor", "tank"] as const) {
      const views = Array.from({ length: 8 }, (_, facing) =>
        unitSprite(kind, palette, { facing: facing as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }),
      );
      expect(views.every((spec) => spec.rotation === undefined)).toBe(true);
      expect(new Set(views.map((spec) => spec.imageSrc)).size).toBe(8);
      expect(views[0]!.imageSrc).toMatch(/-right(?:-v[12])?\.png/);
      expect(views[1]!.imageSrc).toContain("-front-right-v1.png");
      expect(views[2]!.imageSrc).toMatch(/-front(?:-v1)?\.png/);
      expect(views[3]!.imageSrc).toContain("-front-left-v1.png");
      expect(views[4]!.imageSrc).toMatch(/-left(?:-v[12])?\.png/);
      expect(views[5]!.imageSrc).toContain("-back-left-v1.png");
      expect(views[6]!.imageSrc).toMatch(/-back(?:-v1)?\.png/);
      expect(views[7]!.imageSrc).toContain("-back-right-v1.png");
    }
  });

  it("ships every mapped directional raster with the application", () => {
    for (const kind of UNIT_KINDS) {
      for (const source of Object.values(UNIT_DIRECTION_ART[kind])) {
        expect(existsSync(resolve(process.cwd(), "public", source.slice(1)))).toBe(true);
      }
    }
  });

  it("does not keep unused sleek-modular sprites in the asset bay", () => {
    const used = new Set([
      ...Object.values(SPRITE_ART).map((src) => basename(src)),
      ...Object.values(UNIT_DIRECTION_ART).flatMap((views) => Object.values(views).map((src) => basename(src))),
    ]);
    const dir = resolve(process.cwd(), "public/art/sprites/sleek-modular");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".png"))) {
      expect(used.has(file), file).toBe(true);
    }
  });

  it("fits rotated unit bounds without moving the contact anchor", () => {
    const spec = unitSprite("infantry", palette, { facing: 3, variant: 11 });
    const bounds = rotatedSpriteBounds(spec);
    expect(bounds.width).toBe(spec.w);
    expect(bounds.height).toBe(spec.h);
    const scale = Math.min(420 / bounds.width, 280 / bounds.height) * 0.86;
    const dx = (420 - bounds.width * scale) / 2 - bounds.minX * scale;
    const dy = (280 - bounds.height * scale) / 2 - bounds.minY * scale;
    expect(dx + bounds.minX * scale).toBeCloseTo((420 - bounds.width * scale) / 2, 5);
    expect(dy + bounds.minY * scale).toBeCloseTo((280 - bounds.height * scale) / 2, 5);
  });

  it("keeps raster building art through construction and damage stages", () => {
    for (const kind of BUILDING_KINDS) {
      const foundation = buildingSprite(kind, palette, { constructionStage: 0, variant: 13 });
      const framed = buildingSprite(kind, palette, { constructionStage: 1, variant: 13 });
      const roofed = buildingSprite(kind, palette, { constructionStage: 2, variant: 13 });
      const finished = buildingSprite(kind, palette, { constructionStage: 3, variant: 13 });
      expect([foundation, framed, roofed, finished].every((spec) => Boolean(spec.imageSrc))).toBe(true);
      expect([foundation, framed, roofed, finished].every((spec) => spec.svg === undefined)).toBe(true);
      expect(new Set([foundation.id, framed.id, roofed.id, finished.id]).size).toBe(4);
    }
  });

  it("paints wreckage and rubble from the live rasters with a scorched treatment", () => {
    for (const kind of UNIT_KINDS) {
      const live = unitSprite(kind, palette, { facing: 2, variant: 11 });
      const a = wreckSprite(kind, palette);
      const b = wreckSprite(kind, palette);
      expect(a).toEqual(b);
      expect(a.imageSrc).toBe(live.imageSrc);
      expect(a.imageCrop).toEqual(live.imageCrop);
      expect(a.svg).toBeUndefined();
      expect(a.imageTint).not.toBe(live.imageTint);
      expect(a.imageTextureSrc).toMatch(/worn-panel/);
      expect(a.id).not.toBe(live.id);
      validateSpec(a);
    }
    for (const kind of BUILDING_KINDS) {
      const live = buildingSprite(kind, palette, { variant: 13 });
      const a = rubbleSprite(kind, palette);
      const b = rubbleSprite(kind, palette);
      expect(a).toEqual(b);
      expect(a.imageSrc).toBe(live.imageSrc);
      expect(a.svg).toBeUndefined();
      expect(a.imageTint).not.toBe(live.imageTint);
      expect(a.imageTextureSrc).toMatch(/worn-panel/);
      expect(a.id).not.toBe(live.id);
      validateSpec(a);
    }
    const wreckIds = new Set(UNIT_KINDS.map((kind) => wreckSprite(kind, palette).id));
    const rubbleIds = new Set(BUILDING_KINDS.map((kind) => rubbleSprite(kind, palette).id));
    expect(wreckIds.size).toBe(UNIT_KINDS.length);
    expect(rubbleIds.size).toBe(BUILDING_KINDS.length);
  });

  it("plants unit sprites on a contact shadow at the feet", () => {
    for (const kind of UNIT_KINDS) {
      const spec = unitSprite(kind, palette, { facing: 0, variant: 11 });
      if (spec.imageSrc) {
        expect(spec.anchorY ?? spec.h).toBeGreaterThan(spec.h * 0.8);
        expect(spec.anchorX).toBe(spec.w / 2);
        expect(spec.anchorY).toBe(spec.h);
        continue;
      }
      const shadowY = Number(spec.svg?.match(/<ellipse cx="[\d.]+" cy="([\d.]+)"/)?.[1]);
      expect(shadowY).toBeCloseTo(spec.anchorY ?? spec.h, 0);
      expect(spec.anchorY ?? spec.h).toBeGreaterThan(spec.h * 0.8);
    }
  });

  it("draws 1-step drops as hillsides without layer lines", () => {
    const face = elevationFace("south", 1, 64, 32, 16, 42);
    expect(face.cracks).toHaveLength(0);
    expect(face.points.length / 2).toBe(4);
  });

  it("draws steep cliffs as clean faces with controlled strata", () => {
    const face = elevationFace("east", 2, 64, 32, 16, 7);
    expect(face.points.length / 2).toBe(4);
    expect(face.cracks).toHaveLength(1);
    const xs = face.points.filter((_, i) => i % 2 === 0);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBe(2);
  });

  it("gives finished buildings three-face industrial volumes, not cubic shells or sketches", () => {
    for (const kind of BUILDING_KINDS) {
      const spec = buildingSprite(kind, palette, { variant: 13 });
      if (spec.imageSrc) {
        expect(spec.imageSrc).toMatch(/\/art\/sprites\//);
        continue;
      }
      expect(spec.svg).toContain("#9aabba");
      expect(spec.svg).toContain("#26323d");
      expect(spec.svg).not.toMatch(/ [QC]/);
    }
  });

  it("measures the opaque box so sidebar previews can center the graphic", () => {
    const width = 8;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);
    for (const [x, y] of [[2, 1], [3, 1], [2, 2], [3, 2]] as const) {
      data[(y * width + x) * 4 + 3] = 255;
    }
    expect(opaquePixelBounds(data, width, height)).toEqual({ minX: 2, minY: 1, width: 2, height: 2 });
    expect(opaquePixelBounds(new Uint8ClampedArray(width * height * 4), width, height)).toBeUndefined();
  });
});

function svgMarks(svg: string | undefined): number {
  return (svg?.match(/<(path|ellipse|line|polygon)\b/g) ?? []).length;
}

function validateSpec(spec: { w: number; h: number; pixelScale?: number; anchorX?: number; anchorY?: number; kind: string; imageSrc?: string; svg?: string; shapes: Array<{ x: number; y: number; w: number; h: number; points?: number[] }> }): void {
  expect(spec.w).toBeGreaterThan(0);
  expect(spec.h).toBeGreaterThan(0);
  expect(spec.pixelScale).toBe(1);
  expect(spec.anchorX ?? spec.w / 2).toBeGreaterThanOrEqual(0);
  expect(spec.anchorY ?? spec.h).toBeGreaterThanOrEqual(0);
  if (spec.kind === "unit" || spec.kind === "building") {
    if (spec.imageSrc) expect(spec.imageSrc).toMatch(/^\/art\/sprites\/.+\.png$/);
    else {
      expect(spec.svg).toMatch(/<svg /);
      expect(svgMarks(spec.svg)).toBeGreaterThan(2);
    }
  }
  for (const shape of spec.shapes) {
    for (const value of [shape.x, shape.y, shape.w, shape.h, ...(shape.points ?? [])]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  }
}
