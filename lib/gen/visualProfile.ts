import { createRng } from "../seed/rng";
import type { CampaignVisualProfile, FactionVisualProfile, Owner } from "../types";

const LIGHTS = ["cyan", "amber", "red"] as const;
const FAMILY_MATERIALS = [
  ["brushed", "armored"],
  ["armored", "industrial"],
  ["industrial", "brushed"],
] as const;
const TERRAIN_TREATMENTS = ["modular", "armored", "expeditionary"] as const;

const campaignCache = new Map<number, CampaignVisualProfile>();
const profileCache = new Map<string, FactionVisualProfile>();

function computeCampaignVisualProfile(seed: number): CampaignVisualProfile {
  const rng = createRng(seed, "campaign-visual-profile");
  const family = rng.int(3) as CampaignVisualProfile["family"];
  return {
    family,
    terrainTreatment: TERRAIN_TREATMENTS[family],
    terrainAccent: LIGHTS[(family + rng.int(3)) % LIGHTS.length]!,
  };
}

function computeVisualProfile(seed: number, owner: Owner): FactionVisualProfile {
  const rng = createRng(seed, `visual-profile:${owner}`);
  const campaign = generateCampaignVisualProfile(seed);
  const designFamily = campaign.family;
  return {
    designFamily,
    material: FAMILY_MATERIALS[designFamily][(owner + rng.int(2)) % 2]!,
    trimPattern: rng.int(4) as FactionVisualProfile["trimPattern"],
    insignia: rng.int(5) as FactionVisualProfile["insignia"],
    weathering: rng.int(4) as FactionVisualProfile["weathering"],
    lightRig: LIGHTS[(owner + rng.int(2)) % LIGHTS.length]!,
  };
}

export function generateCampaignVisualProfile(seed: number): CampaignVisualProfile {
  const hit = campaignCache.get(seed);
  if (hit) return hit;
  const profile = computeCampaignVisualProfile(seed);
  campaignCache.set(seed, profile);
  return profile;
}

export function generateVisualProfile(seed: number, owner: Owner): FactionVisualProfile {
  const key = `${seed}:${owner}`;
  const hit = profileCache.get(key);
  if (hit) return hit;
  const profile = computeVisualProfile(seed, owner);
  profileCache.set(key, profile);
  return profile;
}

export function profileKey(profile: FactionVisualProfile): string {
  return `${profile.designFamily}:${profile.material}:${profile.trimPattern}:${profile.insignia}:${profile.weathering}:${profile.lightRig}`;
}

export function campaignProfileKey(profile: CampaignVisualProfile): string {
  return `${profile.family}:${profile.terrainTreatment}:${profile.terrainAccent}`;
}
