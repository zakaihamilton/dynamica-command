export type { WeatherKind, WeatherParticle, WaterCaustic } from "./terrainWeather/types";

export { resetFxTileIndex } from "./terrainWeather/core";

export { paintWaterFx, waterFxNeedsClip, visibleFxTileCoords, waterCaustic, waterRippleCrests } from "./terrainWeather/water";

export { paintOreGlints, oreGlint, oreSparkle } from "./terrainWeather/ore";

export {
  paintTerrainWeather,
  weatherKindForBiome,
  weatherParticleAt,
} from "./terrainWeather/weather";
