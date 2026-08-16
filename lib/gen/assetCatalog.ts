import { BUILDING_KINDS, UNIT_KINDS, labelFor } from "../catalog";
import { BIOMES } from "./names";
import type { BiomeName } from "../types";

const TILE_KINDS = ["clear", "water", "resource", "blocked"] as const;

export type CatalogAsset = {
  id: string;
  category: "unit" | "building" | "tile" | "wreck" | "rubble";
  label: string;
  kind: string;
  biome?: BiomeName;
  tileKind?: (typeof TILE_KINDS)[number];
};

export function listGeneratedAssets(): CatalogAsset[] {
  const assets: CatalogAsset[] = [];
  for (const kind of UNIT_KINDS) {
    assets.push({ id: `unit:${kind}`, category: "unit", label: labelFor(kind), kind });
  }
  for (const kind of BUILDING_KINDS) {
    assets.push({ id: `building:${kind}`, category: "building", label: labelFor(kind), kind });
  }
  for (const biome of BIOMES) {
    for (const tileKind of TILE_KINDS) {
      assets.push({
        id: `tile:${tileKind}:${biome}`,
        category: "tile",
        label: `${tileKind} · ${biome}`,
        kind: tileKind,
        biome,
        tileKind,
      });
    }
  }
  for (const kind of UNIT_KINDS) {
    assets.push({ id: `wreck:${kind}`, category: "wreck", label: `${labelFor(kind)} wreck`, kind });
  }
  for (const kind of BUILDING_KINDS) {
    assets.push({ id: `rubble:${kind}`, category: "rubble", label: `${labelFor(kind)} rubble`, kind });
  }
  return assets;
}
