import { beforeEach } from "vitest";
import { resetPathBudget } from "../lib/sim/pathBudget";
import { resetFxTileIndex } from "../lib/render/terrainWeather";
import { clearTurretRasterCache } from "../lib/render/gl/turretRaster";
import { invalidateMinimap } from "../lib/render/minimap";
import { resetPerfHudFlag } from "../lib/render/perfHud";

beforeEach(() => {
  resetPathBudget();
  resetFxTileIndex();
  clearTurretRasterCache();
  invalidateMinimap();
  resetPerfHudFlag();
});
