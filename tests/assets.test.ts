import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, UNIT_KINDS } from "../lib/catalog";
import { buildingSprite, rubbleSprite, tileSprite, unitSprite, wreckSprite } from "../lib/gen/assets";
import { generateFactions } from "../lib/gen/factions";
import { BIOMES } from "../lib/gen/names";

describe("retro procedural assets", () => {
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

  it("paints grass, trees, and rocks as detailed floor props", () => {
    const grass = tileSprite("clear", 1, { biome: "jungle wreckage", variant: 4, contour: "none" });
    const trees = tileSprite("blocked", 1, { biome: "jungle wreckage", variant: 4, contour: "none" });
    const rocks = tileSprite("blocked", 1, { biome: "glass desert", variant: 4, contour: "none" });
    const dirt = tileSprite("clear", 1, { biome: "ash plains", variant: 2, surface: 1, contour: "none" });
    validateSpec(grass);
    validateSpec(trees);
    validateSpec(rocks);
    validateSpec(dirt);
    expect(grass.shapes.length).toBeGreaterThan(8);
    expect(trees.shapes.length).toBeGreaterThan(grass.shapes.length);
    expect(rocks.shapes.some((shape) => shape.type === "poly")).toBe(true);
    expect(dirt.shapes.length).toBeGreaterThan(4);
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
      expect(a.svg).toBe(b.svg);
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
    const unitFingerprints = UNIT_KINDS.map((kind) => unitSprite(kind, palette, { facing: 0, variant: 11 }).svg);
    expect(new Set(unitFingerprints).size).toBe(UNIT_KINDS.length);
    const buildingFingerprints = BUILDING_KINDS.map((kind) => buildingSprite(kind, palette, { variant: 13 }).svg);
    expect(new Set(buildingFingerprints).size).toBe(BUILDING_KINDS.length);
  });

  it("changes unit tread and walk art across animation frames", () => {
    for (const kind of UNIT_KINDS) {
      const a = unitSprite(kind, palette, { facing: 2, animationFrame: 0, variant: 11 });
      const b = unitSprite(kind, palette, { facing: 2, animationFrame: 1, variant: 11 });
      expect(a.svg).not.toEqual(b.svg);
    }
  });

  it("builds construction stages as incomplete shells, not only scaffolding overlays", () => {
    for (const kind of BUILDING_KINDS) {
      const foundation = buildingSprite(kind, palette, { constructionStage: 0, variant: 13 });
      const framed = buildingSprite(kind, palette, { constructionStage: 1, variant: 13 });
      const roofed = buildingSprite(kind, palette, { constructionStage: 2, variant: 13 });
      const finished = buildingSprite(kind, palette, { constructionStage: 3, variant: 13 });
      expect(svgMarks(foundation.svg)).toBeLessThan(svgMarks(framed.svg));
      expect(svgMarks(framed.svg)).toBeLessThan(svgMarks(roofed.svg));
      expect(roofed.svg).not.toEqual(finished.svg);
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

  it("draws organic terrain and SVG military silhouettes", () => {
    const grass = tileSprite("clear", 1, { biome: "ash plains", variant: 4, contour: "none" });
    expect(grass.shapes.filter((shape) => shape.type === "ellipse").length).toBeGreaterThan(8);
    expect(grass.shapes.some((shape) => shape.type === "poly" && (shape.points?.length ?? 0) > 8)).toBe(true);
    const infantry = unitSprite("infantry", palette, { facing: 0, variant: 11 });
    expect(infantry.svg).toContain("<path");
    expect(infantry.svg).toContain("<ellipse");
    const barracks = buildingSprite("barracks", palette, { variant: 13 });
    expect(barracks.svg).toContain("<path");
    expect(barracks.svg).toContain("#8b9288");
    expect(barracks.svg).toContain("#2c322e");
    const tank = unitSprite("tank", palette, { facing: 3, animationFrame: 2, variant: 4 });
    expect(tank.svg).toContain("<path");
    expect(tank.svg).toContain("#8b9288");
    expect(tank.svg).toContain("#2c322e");
  });

  it("gives finished buildings three-face industrial volumes, not cubic shells or sketches", () => {
    for (const kind of BUILDING_KINDS) {
      const spec = buildingSprite(kind, palette, { variant: 13 });
      expect(spec.svg).toContain("#8b9288");
      expect(spec.svg).toContain("#2c322e");
      expect(spec.svg).not.toMatch(/ [QC]/);
    }
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
    expect(spec.svg).toMatch(/<svg /);
    expect(svgMarks(spec.svg)).toBeGreaterThan(2);
  }
  for (const shape of spec.shapes) {
    for (const value of [shape.x, shape.y, shape.w, shape.h, ...(shape.points ?? [])]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  }
}
