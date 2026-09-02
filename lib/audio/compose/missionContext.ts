import { pickMissionBiomes } from "../../gen/names";
import { pickMissionKinds } from "../../gen/missionOrder";
import type { BiomeName, MissionKind } from "../../types";
import { createRng, type Rng } from "../../seed/rng";
import type {
  MusicArrangementName,
  MusicCue,
  MusicStyleName,
  MusicStyleProfile,
} from "./types";
import { TUTORIAL_MUSIC_MISSION } from "./types";

export type MusicMissionContext = {
  biome?: BiomeName;
  missionKind?: MissionKind;
};

const BIOME_STYLES: Record<BiomeName, readonly MusicStyleName[]> = {
  "ash plains": ["foundry-stomp", "industrial-march", "cinematic-tension"],
  "volcanic shelf": ["foundry-stomp", "night-raid", "acid-grid"],
  "rust canyons": ["industrial-march", "chrome-fanfare", "signal-chase"],
  "crystal flats": ["glass-chime", "neon-arpeggio", "chrome-fanfare"],
  "glass desert": ["acid-grid", "glass-chime", "signal-chase"],
  "tundra grid": ["ice-protocol", "low-orbit", "cinematic-tension"],
  "jungle wreckage": ["night-raid", "orbital-drift", "neon-arpeggio"],
  "salt marshes": ["orbital-drift", "low-orbit", "ice-protocol"],
};

const BIOME_STYLES_SECONDARY: Record<BiomeName, readonly MusicStyleName[]> = {
  "ash plains": ["chrome-fanfare", "signal-chase", "night-raid"],
  "volcanic shelf": ["industrial-march", "cinematic-tension", "foundry-stomp"],
  "rust canyons": ["foundry-stomp", "cinematic-tension", "acid-grid"],
  "crystal flats": ["acid-grid", "orbital-drift", "signal-chase"],
  "glass desert": ["neon-arpeggio", "night-raid", "chrome-fanfare"],
  "tundra grid": ["orbital-drift", "glass-chime", "cinematic-tension"],
  "jungle wreckage": ["low-orbit", "acid-grid", "signal-chase"],
  "salt marshes": ["night-raid", "cinematic-tension", "glass-chime"],
};

const KIND_STYLES: Partial<Record<MissionKind, readonly MusicStyleName[]>> = {
  harvestQuota: ["orbital-drift", "low-orbit", "ice-protocol", "cinematic-tension"],
  forceQuota: ["chrome-fanfare", "neon-arpeggio", "orbital-drift"],
  structureQuota: ["cinematic-tension", "low-orbit", "industrial-march"],
  holdTheLine: ["cinematic-tension", "industrial-march", "foundry-stomp"],
  sabotage: ["acid-grid", "signal-chase", "night-raid"],
  destroyMarked: ["signal-chase", "acid-grid", "night-raid"],
  razeAll: ["foundry-stomp", "industrial-march", "signal-chase"],
  annihilate: ["foundry-stomp", "signal-chase", "night-raid"],
  decapitate: ["industrial-march", "cinematic-tension", "foundry-stomp"],
  escort: ["orbital-drift", "low-orbit", "neon-arpeggio"],
  rescue: ["orbital-drift", "ice-protocol", "low-orbit"],
  extraction: ["low-orbit", "orbital-drift", "glass-chime"],
};

const KIND_ARRANGEMENTS: Partial<Record<MissionKind, readonly MusicArrangementName[]>> = {
  harvestQuota: ["slow-burn", "wide-open", "ghost-signal", "half-time-break"],
  forceQuota: ["forward-drive", "command-theme", "wide-open", "anthem-lift"],
  structureQuota: ["slow-burn", "command-theme", "wide-open", "inverted-hold"],
  holdTheLine: ["bass-siege", "command-theme", "anthem-lift", "half-time-break"],
  sabotage: ["syncopated-strike", "call-and-echo", "echo-canon", "drums-out"],
  destroyMarked: ["syncopated-strike", "forward-drive", "melody-late", "call-and-echo"],
  razeAll: ["panic-run", "bass-siege", "double-drop", "forward-drive"],
  annihilate: ["panic-run", "double-drop", "bass-siege", "drums-out"],
  decapitate: ["bass-siege", "panic-run", "anthem-lift", "double-drop"],
  escort: ["ghost-signal", "wide-open", "command-theme", "call-and-echo"],
  rescue: ["ghost-signal", "slow-burn", "echo-canon", "wide-open"],
  extraction: ["command-theme", "wide-open", "melody-late", "ghost-signal"],
};

export function musicMissionContext(seed: number, missionIndex: number): MusicMissionContext {
  const biomes = pickMissionBiomes(seed);
  const kinds = pickMissionKinds(seed);
  if (missionIndex === TUTORIAL_MUSIC_MISSION || missionIndex < 0) {
    return { biome: biomes[0] };
  }
  return {
    biome: biomes[missionIndex] ?? biomes[0],
    missionKind: kinds[missionIndex],
  };
}

export function campaignMusicContexts(seed: number): MusicMissionContext[] {
  const biomes = pickMissionBiomes(seed);
  const kinds = pickMissionKinds(seed);
  return biomes.map((biome, index) => ({ biome, missionKind: kinds[index] }));
}

export function styleAffinityScore(name: MusicStyleName, ctx: MusicMissionContext): number {
  let score = 0;
  if (ctx.biome && BIOME_STYLES[ctx.biome]?.includes(name)) score += 4;
  if (ctx.biome && BIOME_STYLES_SECONDARY[ctx.biome]?.includes(name)) score += 2;
  if (ctx.missionKind && KIND_STYLES[ctx.missionKind]?.includes(name)) score += 3;
  return score;
}

export function arrangementAffinityScore(name: MusicArrangementName, ctx: MusicMissionContext): number {
  if (ctx.missionKind && KIND_ARRANGEMENTS[ctx.missionKind]?.includes(name)) return 3;
  return 0;
}

export function pickBestByScore<T>(
  candidates: readonly T[],
  scoreOf: (item: T) => number,
  rng: Rng,
): T {
  if (candidates.length === 0) throw new Error("pickBestByScore requires candidates");
  const shuffled = rng.shuffle(candidates);
  let best = shuffled[0] as T;
  let bestScore = scoreOf(best);
  for (const candidate of shuffled) {
    const score = scoreOf(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function assignCampaignItems<T>(
  items: readonly T[],
  contexts: readonly MusicMissionContext[],
  scoreOf: (item: T, ctx: MusicMissionContext) => number,
  rng: Rng,
): T[] {
  const remaining = [...items];
  const pending = contexts.map((_, index) => index);
  const slots: (T | undefined)[] = contexts.map(() => undefined);
  while (pending.length > 0) {
    let target = pending[0]!;
    let fewestPrimary = Infinity;
    for (const index of pending) {
      const ctx = contexts[index]!;
      const primaryCount = remaining.filter((item) => scoreOf(item, ctx) >= 4).length;
      if (primaryCount < fewestPrimary || (primaryCount === fewestPrimary && index < target)) {
        fewestPrimary = primaryCount;
        target = index;
      }
    }
    const ctx = contexts[target]!;
    const pick = pickBestByScore(remaining, (item) => scoreOf(item, ctx), rng.fork(String(target)));
    slots[target] = pick;
    remaining.splice(remaining.indexOf(pick), 1);
    pending.splice(pending.indexOf(target), 1);
  }
  return slots as T[];
}

export function pickAssignedItem<T>(
  items: readonly T[],
  contexts: readonly MusicMissionContext[],
  missionIndex: number,
  scoreOf: (item: T, ctx: MusicMissionContext) => number,
  rng: Rng,
  fallbackCtx: MusicMissionContext,
): T {
  const assigned = assignCampaignItems(items, contexts, scoreOf, rng);
  if (missionIndex >= 0 && missionIndex < assigned.length) return assigned[missionIndex]!;
  const used = new Set(assigned);
  const leftover = items.filter((item) => !used.has(item));
  return pickBestByScore(
    leftover.length > 0 ? leftover : items,
    (item) => scoreOf(item, fallbackCtx),
    rng.fork(String(missionIndex)),
  );
}

export function applyMissionTints(style: MusicStyleProfile, ctx: MusicMissionContext): MusicStyleProfile {
  const next: MusicStyleProfile = { ...style, drum: { ...style.drum } };
  const biome = ctx.biome;
  const kind = ctx.missionKind;
  if (biome === "ash plains" || biome === "volcanic shelf" || biome === "rust canyons") {
    next.drum.kickStart += 12;
    next.drum.kickTail = Math.max(0.1, next.drum.kickTail - 0.03);
    next.reverbSeconds *= 0.88;
    next.cutoffMin *= 0.92;
    next.cutoffMax *= 0.92;
  } else if (biome === "crystal flats" || biome === "glass desert") {
    next.delayWet = Math.min(0.5, next.delayWet + 0.06);
    next.cutoffMin *= 1.08;
    next.cutoffMax *= 1.1;
  } else if (biome === "tundra grid") {
    next.reverbSeconds *= 1.18;
    next.reverbWet = Math.min(0.5, next.reverbWet + 0.06);
    next.drumDensity *= 0.86;
  } else if (biome === "jungle wreckage" || biome === "salt marshes") {
    next.delayFeedback = Math.min(0.55, next.delayFeedback + 0.06);
    next.delayWet = Math.min(0.5, next.delayWet + 0.05);
  }

  if (kind === "harvestQuota" || kind === "forceQuota" || kind === "structureQuota") {
    next.drumDensity *= 0.84;
    next.tempoBias -= 2;
  } else if (kind === "holdTheLine") {
    next.tempoBias -= 1;
    next.drumDensity *= 0.95;
  } else if (kind === "sabotage" || kind === "destroyMarked") {
    next.tempoBias += 2;
    next.drumDensity = Math.min(1, next.drumDensity * 1.06);
  } else if (kind === "razeAll" || kind === "annihilate" || kind === "decapitate") {
    next.tempoBias += 3;
    next.drumDensity = Math.min(1, next.drumDensity * 1.12);
  } else if (kind === "escort" || kind === "rescue" || kind === "extraction") {
    next.drumDensity *= 0.9;
    next.reverbWet = Math.min(0.5, next.reverbWet + 0.04);
    next.counterChance = Math.min(1, next.counterChance + 0.08);
  }
  return next;
}

export function assignmentRng(seed: number, cue: MusicCue, label: string): Rng {
  return createRng(seed, `${label}:${cue}`);
}
