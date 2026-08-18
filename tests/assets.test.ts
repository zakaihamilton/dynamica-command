import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, UNIT_KINDS } from "../lib/catalog";
import { buildingSprite, elevationFace, rubbleSprite, tileSprite, unitSprite, wreckSprite } from "../lib/gen/assets";
import { generateFactions } from "../lib/gen/factions";
import { BIOMES } from "../lib/gen/names";
import { SURFACE_CONCRETE } from "../lib/types";
import { generateCampaignVisualProfile } from "../lib/gen/visualProfile";
import { rotatedSpriteBounds } from "../lib/render/sprites";

describe("tactical procedural assets", () => {
  const palette = generateFactions(421)[0].palette;

  it("produces deterministic biome tile families", () => {
    for (const biome of BIOMES) {
      for (const kind of ["clear", "water", "resource", "blocked"] as const) {
        const a = tileSprite(kind, 2, { biome, variant: 7, edgeMask: 5, surface: 1, resourceLevel: 3 });
        const b = tileSprite(kind, 2, { biome, variant: 7, edgeMask: 5, surface: 1, resourceLevel: 3 });
        expect(a).toEqual(b);
        validateSpec(a);
      }
    }
  });

  it("renders rivers and mountains as edge contours instead of filled feature tiles", () => {
    const waterInterior = tileSprite("water", 0, { biome: "ash plains", variant: 3, edgeMask: 0, contour: "bank" });
    const waterEdge = tileSprite("water", 0, { biome: "ash plains", variant: 3, edgeMask: 5, contour: "bank" });
    const ridgeInterior = tileSprite("clear", 3, { biome: "ash plains", variant: 3, edgeMask: 0, contour: "ridge" });
    const ridgeEdge = tileSprite("clear", 3, { biome: "ash plains", variant: 3, edgeMask: 5, contour: "ridge" });
    validateSpec(waterInterior);
    validateSpec(waterEdge);
    validateSpec(ridgeInterior);
    validateSpec(ridgeEdge);
    expect(waterEdge.shapes.some((shape) => shape.type === "line" && (shape.strokeWidth ?? 0) >= 2)).toBe(true);
    expect(ridgeEdge.shapes.some((shape) => shape.type === "line" && (shape.strokeWidth ?? 0) >= 2)).toBe(true);
    expect(waterInterior.shapes.some((shape) => shape.type === "line" && (shape.strokeWidth ?? 0) >= 2)).toBe(false);
    expect(ridgeInterior.shapes.some((shape) => shape.type === "line" && (shape.strokeWidth ?? 0) >= 2)).toBe(false);
    expect(waterEdge.shapes.filter((shape) => shape.type === "poly").length).toBeGreaterThan(
      waterInterior.shapes.filter((shape) => shape.type === "poly").length,
    );
  });

  it("separates mid and high elevation surfaces visually", () => {
    const low = tileSprite("clear", 1, { biome: "ash plains", variant: 3, contour: "none" });
    const mid = tileSprite("clear", 2, { biome: "ash plains", variant: 3, contour: "none" });
    const high = tileSprite("clear", 3, { biome: "ash plains", variant: 3, contour: "none" });
    expect(mid.palette.primary).not.toBe(low.palette.primary);
    expect(high.palette.primary).not.toBe(mid.palette.primary);
    expect(mid.palette.secondary).not.toBe(low.palette.secondary);
  });

  it("paints grass, trees, and rocks as detailed floor props", () => {
    const grass = tileSprite("clear", 1, { biome: "jungle wreckage", variant: 4, contour: "none" });
    const trees = tileSprite("blocked", 1, { biome: "jungle wreckage", variant: 4, contour: "none" });
    const rocks = tileSprite("blocked", 1, { biome: "glass desert", variant: 4, contour: "none" });
    const dirt = tileSprite("clear", 1, { biome: "ash plains", variant: 2, surface: 1, contour: "none" });
    validateSpec(grass);
    validateSpec(trees);
    validateSpec(rocks);
    validateSpec(dirt);
    expect(grass.shapes.length).toBeGreaterThanOrEqual(2);
    expect(trees.shapes.length).toBeGreaterThan(grass.shapes.length);
    expect(rocks.shapes.some((shape) => shape.type === "poly")).toBe(true);
    expect(dirt.shapes.length).toBeGreaterThanOrEqual(4);
  });

  it("scatters floor mottling so neighboring tiles do not share a highlight lattice", () => {
    const tiles = [0, 1, 2, 3, 4, 5].map((variant) =>
      tileSprite("clear", 1, { biome: "jungle wreckage", variant, contour: "none" }),
    );
    const fingerprints = tiles.map((spec) =>
      spec.shapes
        .filter((shape) => shape.type === "ellipse" && shape.w >= 10)
        .map((shape) => `${Math.round(shape.x)},${Math.round(shape.y)},${Math.round(shape.w)}`)
        .join("|"),
    );
    expect(new Set(fingerprints).size).toBeGreaterThan(1);
    expect(tiles[0]!.shapes).not.toEqual(tiles[1]!.shapes);
  });

  it("gives concrete fields biome-specific materials and multiple slab layouts", () => {
    const theaterFingerprints = BIOMES.map((biome) =>
      tileSprite("clear", 1, { biome, variant: 12, surface: SURFACE_CONCRETE, contour: "none" }).shapes,
    );
    expect(new Set(theaterFingerprints.map((shapes) => JSON.stringify(shapes))).size).toBe(BIOMES.length);

    const jungleLayouts = Array.from({ length: 32 }, (_, variant) =>
      tileSprite("clear", 1, { biome: "jungle wreckage", variant, surface: SURFACE_CONCRETE, contour: "none" }).shapes,
    );
    expect(new Set(jungleLayouts.map((shapes) => JSON.stringify(shapes))).size).toBeGreaterThanOrEqual(5);
    const shapeCounts = jungleLayouts.map((shapes) => shapes.length);
    expect(Math.min(...shapeCounts)).toBeLessThanOrEqual(8);
    expect(Math.max(...shapeCounts) - Math.min(...shapeCounts)).toBeGreaterThan(3);
  });

  it("scatters distinct landmark families through continuous terrain fields", () => {
    const concreteMarks = new Set(
      Array.from({ length: 256 }, (_, variant) =>
        tileSprite("clear", 1, { biome: "jungle wreckage", variant, surface: SURFACE_CONCRETE, contour: "none" }).shapes,
      ).flatMap((shapes) => shapes.flatMap((shape) => [shape.fill, shape.stroke].filter(Boolean))),
    );
    expect(concreteMarks).toContain("#172f2d"); // standing water
    expect(concreteMarks).toContain("#66503b"); // wreck plate
    expect(concreteMarks).toContain("#77a563"); // vine growth

    const openMarks = new Set(
      Array.from({ length: 256 }, (_, variant) =>
        tileSprite("clear", 1, { biome: "jungle wreckage", variant, contour: "none" }).shapes,
      ).flatMap((shapes) => shapes.flatMap((shape) => [shape.fill, shape.stroke].filter(Boolean))),
    );
    expect(openMarks.size).toBeGreaterThan(5); // sparse terrain still carries biome material variety
  });

  it("renders blockers as varied hard-cover volumes with a hazard cap", () => {
    const specs = [0, 1, 2, 3, 4, 5, 6, 7].map((variant) =>
      tileSprite("blocked", 1, { biome: "jungle wreckage", variant, contour: "none" }),
    );
    expect(new Set(specs.map((spec) => JSON.stringify(spec.shapes))).size).toBeGreaterThan(1);
    expect(specs.every((spec) => spec.shapes.some((shape) => shape.stroke === "#d6a94d"))).toBe(true);
  });

  it("paints ore fields as gold nugget beds that thin out when depleted", () => {
    const rich = tileSprite("resource", 1, { biome: "ash plains", variant: 4, resourceLevel: 4, contour: "none" });
    const poor = tileSprite("resource", 1, { biome: "ash plains", variant: 4, resourceLevel: 1, contour: "none" });
    const other = tileSprite("resource", 1, { biome: "ash plains", variant: 11, resourceLevel: 4, contour: "none" });
    validateSpec(rich);
    validateSpec(poor);
    expect(rich.shapes.length).toBeGreaterThan(poor.shapes.length);
    expect(rich.shapes).not.toEqual(other.shapes);
    expect(rich.shapes.some((shape) => shape.fill === "#e8c45a")).toBe(true);
    expect(rich.shapes.filter((shape) => shape.type === "poly").length).toBeGreaterThan(8);
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

  it("changes unit tread and walk art across animation frames", () => {
    for (const kind of UNIT_KINDS) {
      const a = unitSprite(kind, palette, { facing: 2, animationFrame: 0, variant: 11 });
      const b = unitSprite(kind, palette, { facing: 2, animationFrame: 1, variant: 11 });
      if (a.imageSrc) expect(a.id).not.toEqual(b.id);
      else expect(a.svg).not.toEqual(b.svg);
    }
  });

  it("selects directional unit views instead of rotating one raster", () => {
    for (const kind of ["infantry", "harvester", "antiArmor", "tank"] as const) {
      const views = Array.from({ length: 8 }, (_, facing) =>
        unitSprite(kind, palette, { facing: facing as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }),
      );
      expect(views.every((spec) => spec.rotation === undefined)).toBe(true);
      expect(views[0]!.imageSrc).toMatch(/-right(?:-v1)?\.png/);
      expect(views[2]!.imageSrc).toMatch(/-front(?:-v1)?\.png/);
      expect(views[4]!.imageSrc).toMatch(/-left(?:-v1)?\.png/);
      expect(views[6]!.imageSrc).toMatch(/-back(?:-v1)?\.png/);
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

  it("paints wreckage and rubble as distinct deterministic sprites", () => {
    for (const kind of UNIT_KINDS) {
      const a = wreckSprite(kind, palette);
      const b = wreckSprite(kind, palette);
      expect(a).toEqual(b);
      validateSpec(a);
    }
    for (const kind of BUILDING_KINDS) {
      const a = rubbleSprite(kind, palette);
      const b = rubbleSprite(kind, palette);
      expect(a).toEqual(b);
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

  it("draws faceted terrain with raster tactical sprites", () => {
    const grassSamples = Array.from({ length: 12 }, (_, variant) =>
      tileSprite("clear", 1, { biome: "ash plains", variant, contour: "none" }),
    );
    const ellipseCounts = grassSamples.map((spec) => spec.shapes.filter((shape) => shape.type === "ellipse").length);
    const grass = grassSamples[ellipseCounts.indexOf(Math.max(...ellipseCounts))]!;
    expect(Math.max(...ellipseCounts)).toBeGreaterThanOrEqual(3);
    expect(Math.min(...ellipseCounts)).toBeLessThan(Math.max(...ellipseCounts));
    expect(grass.shapes.some((shape) => shape.type === "poly" && (shape.points?.length ?? 0) > 8)).toBe(true);
    const infantry = unitSprite("infantry", palette, { facing: 0, variant: 11 });
    expect(infantry.imageSrc).toMatch(/\/art\/sprites\/.*infantry-right-v1\.png/);
    const barracks = buildingSprite("barracks", palette, { variant: 13 });
    expect(barracks.imageSrc).toMatch(/\/art\/sprites\/.*barracks-v2\.png/);
    const tank = unitSprite("tank", palette, { facing: 3, animationFrame: 2, variant: 4 });
    expect(tank.imageSrc).toMatch(/\/art\/sprites\/.*tank-front\.png/);
  });

  it("paints floor silhouettes that are not four-point diamonds", () => {
    const grass = tileSprite("clear", 1, { biome: "ash plains", variant: 4, contour: "none" });
    const floor = grass.shapes.find((shape) => shape.type === "poly");
    expect((floor?.points?.length ?? 0) / 2).toBe(8);
    expect(grass.w).toBeGreaterThan(64);
    expect(grass.h).toBeGreaterThan(32);
  });

  it("gives blockers a centered, readable impassable silhouette", () => {
    const blocker = tileSprite("blocked", 1, { biome: "jungle wreckage", variant: 4, contour: "none" });
    expect(blocker.shapes.some((shape) => shape.type === "poly" && (shape.strokeWidth ?? 0) >= 1)).toBe(true);
    expect(blocker.shapes.some((shape) => shape.stroke === "#d6a94d")).toBe(true);
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

  it("changes terrain materials with the campaign visual profile", () => {
    const profiles = ([0, 1, 2] as const).map((family) => {
      const base = generateCampaignVisualProfile(421);
      const terrainTreatment = ["modular", "armored", "expeditionary"] as const;
      return { ...base, family, terrainTreatment: terrainTreatment[family] };
    });
    const tiles = profiles.map((campaignProfile) =>
      tileSprite("clear", 1, { biome: "ash plains", variant: 12, contour: "none", campaignProfile }),
    );
    expect(new Set(tiles.map((tile) => tile.id)).size).toBe(3);
    expect(new Set(tiles.map((tile) => JSON.stringify(tile.shapes))).size).toBe(3);
  });
});

function svgMarks(svg: string | undefined): number {
  return (svg?.match(/<(path|ellipse|line|polygon)\b/g) ?? []).length;
}

function validateSpec(spec: ReturnType<typeof tileSprite>): void {
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
