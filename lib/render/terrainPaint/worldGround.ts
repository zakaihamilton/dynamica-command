import { TILE_SPRITE_PAD_X, TILE_SPRITE_PAD_Y, tileSprite } from "../../gen/tileSprites";
import { defaultContour } from "../../gen/tileSprites/constants";
import { featureEdgeMask, isMountainScenery } from "../../gen/map";
import { generateCampaignVisualProfile } from "../../gen/visualProfile";
import type { SpriteSpec, SurfaceKind } from "../../types";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_RESOURCE, TILE_WATER } from "../../types";
import { TILE_H, TILE_W, type Camera, tileToScreen } from "../../iso";
import { rasterize } from "../sprites";
import { tileVariant, type AtlasWorld } from "../terrainAtlas";

const GROUND_VARIANT_SPAN = 8;

function contiguousSurfaceMask(state: AtlasWorld, x: number, y: number, surface: SurfaceKind): number {
  const same = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) return false;
    return state.surfaces[ny * state.width + nx] === surface;
  };
  return same(0, -1) && same(1, 0) && same(0, 1) && same(-1, 0) ? 0 : 15;
}

function resourceSpriteLevel(amount: number): number {
  return Math.max(1, Math.min(4, Math.ceil(Math.max(1, amount) / 200)));
}

export function worldGroundSprite(
  state: AtlasWorld,
  x: number,
  y: number,
  scenery: { kind: number; elev: number },
): SpriteSpec | null {
  if (scenery.kind === TILE_WATER) return null;
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  const surface = inMap ? state.surfaces[y * state.width + x] ?? SURFACE_NONE : SURFACE_NONE;
  const spriteKind = scenery.kind === TILE_RESOURCE ? "resource" : "clear";
  const mountain = isMountainScenery(scenery);
  const contour = mountain ? "ridge" : defaultContour(spriteKind, scenery.elev);
  const engineered = surface === SURFACE_CONCRETE || surface === SURFACE_ROAD;
  return tileSprite(spriteKind, scenery.elev, {
    biome: state.biome,
    variant: tileVariant(state.seed, x, y) % GROUND_VARIANT_SPAN,
    surface: engineered ? surface : undefined,
    surfaceMask: engineered ? contiguousSurfaceMask(state, x, y, surface) : undefined,
    resourceLevel: spriteKind === "resource" && inMap
      ? resourceSpriteLevel(state.resourceAmount[y * state.width + x] ?? 0)
      : undefined,
    contour,
    edgeMask: mountain ? featureEdgeMask(state, x, y).ridge : 0,
    campaignProfile: generateCampaignVisualProfile(state.seed),
  });
}

export function paintWorldGroundSprite(
  ctx: CanvasRenderingContext2D,
  state: AtlasWorld,
  cam: Camera,
  x: number,
  y: number,
  scenery: { kind: number; elev: number },
): boolean {
  const spec = worldGroundSprite(state, x, y, scenery);
  if (!spec) return false;
  const img = rasterize(spec);
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const s = tileToScreen(x, y, cam, scenery.elev);
  const padX = TILE_SPRITE_PAD_X * z;
  const padY = TILE_SPRITE_PAD_Y * z;
  ctx.drawImage(img, s.x - tw / 2 - padX, s.y - padY, tw + padX * 2, th + padY * 2);
  return true;
}
