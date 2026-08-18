import { describe, expect, it } from "vitest";
import { assetById, assetPreviewSpec, spriteSpecToSvg, toAssetApiItem } from "../lib/gen/assetApi";
import { listGeneratedAssets } from "../lib/gen/assetCatalog";

describe("asset API contract", () => {
  it("exposes every Asset Bay entry with stable metadata and preview URLs", () => {
    const assets = listGeneratedAssets();
    const items = assets.map((asset) => toAssetApiItem(asset, "https://example.test/"));

    expect(items).toHaveLength(54);
    expect(items.every((item) => item.metadataUrl.startsWith("https://example.test/api/assets/"))).toBe(true);
    expect(items.every((item) => item.previewUrl.endsWith("/preview"))).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);

    const unit = items.find((item) => item.id === "unit:infantry")!;
    expect(unit.render.supportsFacing).toBe(true);
    expect(unit.render.directions).toHaveLength(8);
    expect(unit.render.directions[7]!.previewUrl).toContain("facing=7");
    expect(items.find((item) => item.id === "building:power")!.render.directions).toHaveLength(0);
  });

  it("returns renderable SVG for procedural assets", () => {
    const asset = assetById("tile:resource:ash plains");
    expect(asset).toBeDefined();
    const spec = assetPreviewSpec(asset!);
    const svg = spriteSpecToSvg(spec);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<polygon");
  });

  it("applies each facing to unit previews", () => {
    const units = listGeneratedAssets().filter((asset) => asset.category === "unit");
    for (const asset of units) {
      for (const facing of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
        const spec = assetPreviewSpec(asset, facing);
        const svg = spriteSpecToSvg(spec, "https://example.test/unit.png");
        expect(spec.rotation).toBeUndefined();
        expect(svg).toContain(`<image href="https://example.test/unit.png"`);
        expect(svg).not.toContain("rotate(");
      }
    }

    const infantry = assetById("unit:infantry")!;
    expect(spriteSpecToSvg(assetPreviewSpec(infantry, 0), "https://example.test/infantry.png"))
      .toContain('width="54" height="54" viewBox="0 0 54 54"');
    expect(spriteSpecToSvg(assetPreviewSpec(infantry, 6), "https://example.test/infantry.png"))
      .toContain('width="54" height="54" viewBox="0 0 54 54"');

    const harvester = assetById("unit:harvester")!;
    expect(spriteSpecToSvg(assetPreviewSpec(harvester, 2), "https://example.test/harvester.png"))
      .toContain('viewBox="0 0 535 580"');
  });
});
