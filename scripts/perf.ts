import { createMission } from "../lib/sim/api";
import { bakeTerrainAtlasData } from "../lib/render/terrainAtlas";

const MAX_ATLAS_MS = 1_000;
const MAX_ATLAS_BYTES = 4 * 1024 * 1024;

type Sample = {
  seed: number;
  mission: number;
  map: string;
  ms: number;
  bytes: number;
};

const samples: Sample[] = [];
for (const seed of [0, 421, 9999]) {
  const state = createMission({ seed, missionIndex: 7 });
  const started = performance.now();
  const atlas = bakeTerrainAtlasData(state);
  samples.push({
    seed,
    mission: state.missionIndex,
    map: `${state.width}x${state.height}`,
    ms: performance.now() - started,
    bytes: atlas.data.byteLength,
  });
}

const failures = samples.filter((sample) => sample.ms > MAX_ATLAS_MS || sample.bytes > MAX_ATLAS_BYTES);
console.log(JSON.stringify({ maxAtlasMs: MAX_ATLAS_MS, maxAtlasBytes: MAX_ATLAS_BYTES, samples }, null, 2));
if (failures.length) {
  throw new Error(`Terrain performance budget exceeded for ${failures.map((sample) => `${sample.seed}/${sample.mission}`).join(", ")}`);
}
