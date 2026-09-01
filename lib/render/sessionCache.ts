import { clearVisualProfileCache } from "../gen/visualProfile";
import { invalidateMinimap } from "./minimap";
import { clearTurretRasterCache } from "./gl/turretRaster";
import { resetUnitTransformTracker } from "./gl/unitTransformTracker";
import { clearSpriteCache } from "./sprites";
import { invalidateTerrainAtlas } from "./terrainAtlas";
import { clearRendererSessionCache } from "./renderer/cache";

/** Releases per-mission render state when the browser leaves a game session. */
export function clearRenderSessionCaches(): void {
  clearSpriteCache();
  clearVisualProfileCache();
  clearTurretRasterCache();
  resetUnitTransformTracker();
  invalidateTerrainAtlas();
  invalidateMinimap();
  clearRendererSessionCache();
}
