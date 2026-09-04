import { clearVisualProfileCache } from "../gen/visualProfile";
import { invalidateMinimap } from "./minimap";
import { clearEntityVisibilityCache } from "./renderPicking";
import { clearTurretAimCache } from "./renderStructures/turret";
import { clearTooltipRenderCache } from "./renderOverlays/tooltips";
import { clearTurretRasterCache } from "./gl/turretRaster";
import { resetUnitTransformTracker } from "./gl/unitTransformTracker";
import { clearSpriteCache } from "./sprites";
import { invalidateTerrainAtlas } from "./terrainAtlas";
import { clearTerrainMaterialCache } from "./terrainMaterials";
import { clearTerrainPaintCache } from "./terrainPaint/world";
import { clearTerrainAtmosphereCache } from "./terrainAtmosphere";
import { clearTerrainLightCache } from "./terrainLighting";
import { clearRendererSessionCache } from "./renderer/cache";

/** Releases per-mission render state when the browser leaves a game session. */
export function clearRenderSessionCaches(): void {
  clearSpriteCache();
  clearVisualProfileCache();
  clearEntityVisibilityCache();
  clearTurretAimCache();
  clearTurretRasterCache();
  resetUnitTransformTracker();
  clearTerrainMaterialCache();
  clearTerrainPaintCache();
  clearTerrainAtmosphereCache();
  clearTerrainLightCache();
  clearTooltipRenderCache();
  invalidateTerrainAtlas();
  invalidateMinimap();
  clearRendererSessionCache();
}
