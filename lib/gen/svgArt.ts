import { BUILDING_STATS } from "../catalog";
import { SPRITE_ART, TEXTURE_ART, UNIT_DIRECTION_ART, UNIT_DIRECTION_CROPS, unitViewForFacing } from "./visualAssets";
import type {
  BuildingKind,
  BuildingSpriteOptions,
  FactionVisualProfile,
  Palette,
  ShapeSpec,
  SpriteSpec,
  UnitKind,
  UnitSpriteOptions,
} from "../types";

const TW = 64;
const TH = 32;

const DEFAULT_PROFILE: FactionVisualProfile = {
  designFamily: 0,
  material: "brushed",
  trimPattern: 0,
  insignia: 0,
  weathering: 0,
  lightRig: "cyan",
};

function rasterTreatment(profile: FactionVisualProfile): string {
  if (profile.designFamily === 1) return "rgba(187, 102, 67, 0.13)";
  if (profile.designFamily === 2) return "rgba(176, 137, 77, 0.11)";
  return "rgba(66, 190, 205, 0.1)";
}

function wreckTreatment(): string {
  return "rgba(46, 26, 16, 0.52)";
}

function rubbleTreatment(): string {
  return "rgba(38, 24, 16, 0.58)";
}

function kindOffset(kind: string): number {
  let h = 2166136261;
  for (let i = 0; i < kind.length; i++) h = Math.imul(h ^ kind.charCodeAt(i), 16777619);
  return h >>> 0;
}

function visualKey(profile: FactionVisualProfile): string {
  return `${profile.designFamily}:${profile.material}:${profile.trimPattern}:${profile.insignia}:${profile.weathering}:${profile.lightRig}`;
}

function supportUnitSprite(
  kind: "medic" | "repairTruck",
  palette: Palette,
  variant: number,
  facing: number,
  frame: number,
  dmg: number,
  profile: FactionVisualProfile,
): SpriteSpec {
  const medic = kind === "medic";
  const w = medic ? 38 : 64;
  const h = medic ? 44 : 60;
  const shapes: ShapeSpec[] = medic
    ? [
        { type: "ellipse", x: 13, y: 4, w: 12, h: 12, fill: palette.light, stroke: palette.outline, strokeWidth: 2 },
        { type: "rect", x: 10, y: 15, w: 18, h: 22, fill: palette.secondary, stroke: palette.outline, strokeWidth: 2 },
        { type: "rect", x: 14, y: 20, w: 10, h: 3, fill: "#f3f6ee" },
        { type: "rect", x: 17.5, y: 16.5, w: 3, h: 10, fill: "#f3f6ee" },
        { type: "line", x: 10, y: 37, w: 5, h: 5, fill: palette.dark, stroke: palette.outline, strokeWidth: 2 },
        { type: "line", x: 28, y: 37, w: -5, h: 5, fill: palette.dark, stroke: palette.outline, strokeWidth: 2 },
        { type: "rect", x: 12, y: 17, w: 14, h: 2, fill: palette.accent, alpha: 0.9 },
      ]
    : [
        { type: "rect", x: 7, y: 20, w: 37, h: 23, fill: palette.secondary, stroke: palette.outline, strokeWidth: 3 },
        { type: "rect", x: 39, y: 15, w: 17, h: 28, fill: palette.primary, stroke: palette.outline, strokeWidth: 3 },
        { type: "rect", x: 43, y: 18, w: 10, h: 8, fill: palette.accent, stroke: palette.outline, strokeWidth: 1, alpha: 0.9 },
        { type: "ellipse", x: 12, y: 37, w: 11, h: 11, fill: palette.dark, stroke: palette.outline, strokeWidth: 2 },
        { type: "ellipse", x: 42, y: 37, w: 11, h: 11, fill: palette.dark, stroke: palette.outline, strokeWidth: 2 },
        { type: "line", x: 23, y: 20, w: 9, h: -10, fill: palette.light, stroke: palette.outline, strokeWidth: 2 },
        { type: "line", x: 32, y: 10, w: 12, h: 0, fill: palette.light, stroke: palette.outline, strokeWidth: 2 },
        { type: "rect", x: 16, y: 25, w: 13, h: 4, fill: palette.accent, alpha: 0.95 },
      ];
  if (dmg > 0) shapes.push({ type: "ellipse", x: medic ? 8 : 10, y: medic ? 13 : 18, w: medic ? 22 : 42, h: 14, fill: "rgba(18, 12, 10, 0.45)" });
  return {
    id: `unit:procedural-support-v1:${kind}:${facing}:${palette.primary}:${visualKey(profile)}:${variant}:${frame}:${dmg}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h,
    pixelScale: 1,
  };
}

export function unitSprite(kind: UnitKind, palette: Palette, options: UnitSpriteOptions = {}): SpriteSpec {
  const frame = options.animationFrame ?? 0;
  const variant = options.variant ?? 0;
  const dmg = options.damageStage ?? 0;
  const profile = options.profile ?? DEFAULT_PROFILE;
  if (kind === "medic" || kind === "repairTruck") return supportUnitSprite(kind, palette, variant, options.facing ?? 0, frame, dmg, profile);
  const infantry = kind === "infantry";
  const antiArmor = kind === "antiArmor";
  // Keep foot soldiers visually subordinate to the larger tracked units while
  // retaining the same bottom contact anchor on the battlefield.
  const w = infantry ? 38 : antiArmor ? 44 : 64;
  const h = infantry ? 42 : antiArmor ? 46 : 60;
  const facing = options.facing ?? 0;
  const view = unitViewForFacing(facing);
  // Raster units are bottom-aligned inside their logical frame. The rotation
  // pivot must be the contact point at the feet/base, not the visual center.
  const ground = h;
  return {
    id: `unit:directional-v1:${kind}:${facing}:${view}:${palette.primary}:${visualKey(profile)}:${variant}:${frame}:${dmg}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: [],
    imageSrc: UNIT_DIRECTION_ART[kind]?.[view],
    imageTint: rasterTreatment(profile),
    imageCrop: UNIT_DIRECTION_CROPS[kind]?.[view],
    anchorX: w / 2,
    anchorY: ground,
    pixelScale: 1,
  };
}

type Iso = { ox: number; oy: number; w: number; h: number; fw: number; fh: number };

function makeIso(fw: number, fh: number, sky: number): Iso {
  const pad = 10;
  const gw = (fw + fh) * (TW / 2);
  const gh = (fw + fh) * (TH / 2);
  return { ox: pad + fh * (TW / 2), oy: pad + sky, w: gw + pad * 2, h: sky + gh + pad * 2, fw, fh };
}

function pt(iso: Iso, lx: number, ly: number, z: number): [number, number] {
  return [iso.ox + (lx - ly) * (TW / 2), iso.oy + (lx + ly) * (TH / 2) - z];
}

function buildingSky(kind: BuildingKind): number {
  switch (kind) {
    case "turret": return 28;
    case "barracks": return 38;
    case "power": return 52;
    case "refinery": return 54;
    case "factory": return 46;
    case "constructionYard": return 48;
    case "objective": return 50;
    default: return 40;
  }
}

export function buildingSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const iso = makeIso(fp.w, fp.h, buildingSky(kind));
  const construction = options.constructionStage ?? 3;
  const dmg = options.damageStage ?? 0;
  const variant = options.variant ?? 0;
  const profile = options.profile ?? DEFAULT_PROFILE;
  const ground = pt(iso, fp.w / 2, fp.h / 2, 0);
  const reveal = constructionReveal(construction);
  return {
    id: `bld:raster-v4:${kind}:${palette.primary}:${visualKey(profile)}:${variant}:${construction}:${dmg}`,
    kind: "building",
    w: iso.w,
    h: iso.h,
    palette,
    shapes: buildingStageOverlays(iso, ground, construction, dmg),
    imageSrc: SPRITE_ART[kind],
    imageTint: buildingStageTint(profile, construction, dmg),
    imageTextureSrc: construction < 3 || dmg > 0 ? TEXTURE_ART.worn : undefined,
    imageTextureOpacity: dmg > 1 ? 0.4 : dmg > 0 ? 0.28 : construction <= 0 ? 0.34 : 0.2,
    imageTextureOffset: kindOffset(kind) ^ (construction * 17 + dmg * 41),
    imageReveal: reveal,
    anchorX: ground[0],
    anchorY: ground[1],
    pixelScale: 1,
  };
}

function constructionReveal(stage: number): number {
  if (stage <= 0) return 0.32;
  if (stage === 1) return 0.56;
  if (stage === 2) return 0.82;
  return 1;
}

function buildingStageTint(profile: FactionVisualProfile, construction: number, dmg: number): string {
  if (dmg > 1) return "rgba(40, 24, 14, 0.5)";
  if (dmg > 0) return construction < 3 ? "rgba(52, 34, 22, 0.4)" : "rgba(48, 30, 18, 0.3)";
  if (construction <= 0) return "rgba(90, 96, 100, 0.5)";
  if (construction === 1) return "rgba(76, 84, 92, 0.32)";
  if (construction === 2) return "rgba(70, 78, 86, 0.16)";
  return rasterTreatment(profile);
}

function buildingStageOverlays(
  iso: Iso,
  ground: readonly [number, number],
  construction: number,
  dmg: number,
): ShapeSpec[] {
  const shapes: ShapeSpec[] = [];
  const gx = ground[0];
  const gy = ground[1];
  if (construction < 3) {
    const topY = iso.h * (1 - constructionReveal(construction) * 0.9);
    shapes.push(
      { type: "line", x: gx - 22, y: gy - 2, w: 12, h: topY - gy + 2, fill: "#8b623a", stroke: "#8b623a", strokeWidth: 2, alpha: 0.85 },
      { type: "line", x: gx + 18, y: gy - 1, w: -8, h: topY - gy + 6, fill: "#b0814d", stroke: "#b0814d", strokeWidth: 2, alpha: 0.8 },
      { type: "line", x: gx - 16, y: topY + 2, w: 34, h: 3, fill: "#c4a06a", stroke: "#c4a06a", strokeWidth: 2, alpha: 0.9 },
    );
  }
  if (dmg > 0) {
    shapes.push(
      { type: "ellipse", x: gx - 18, y: gy - 10, w: 28, h: 12, fill: "rgba(22, 16, 12, 0.55)" },
      { type: "line", x: gx - 8, y: gy - 26, w: 16, h: 22, fill: "#1a1512", stroke: "#1a1512", strokeWidth: 2, alpha: 0.85 },
    );
  }
  if (dmg > 1) {
    shapes.push(
      { type: "ellipse", x: gx + 4, y: gy - 34, w: 16, h: 14, fill: "rgba(28, 30, 28, 0.42)" },
      { type: "line", x: gx + 2, y: gy - 18, w: 14, h: 10, fill: "#2a221c", stroke: "#2a221c", strokeWidth: 2, alpha: 0.8 },
      { type: "ellipse", x: gx - 6, y: gy - 42, w: 10, h: 8, fill: "rgba(36, 34, 32, 0.35)" },
    );
  }
  return shapes;
}

export function wreckSprite(kind: UnitKind, palette: Palette, options: UnitSpriteOptions = {}): SpriteSpec {
  const facing = options.facing ?? 2;
  const profile = options.profile ?? DEFAULT_PROFILE;
  const live = unitSprite(kind, palette, { ...options, facing, animationFrame: 0, profile });
  return {
    ...live,
    id: `wreck:raster-v1:${kind}:${facing}:${palette.primary}:${visualKey(profile)}`,
    imageTint: wreckTreatment(),
    imageTextureSrc: TEXTURE_ART.worn,
    imageTextureOpacity: 0.4,
    imageTextureOffset: kindOffset(kind),
  };
}

export function rubbleSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const live = buildingSprite(kind, palette, { ...options, constructionStage: 3, damageStage: 0, profile });
  return {
    ...live,
    id: `rubble:raster-v1:${kind}:${palette.primary}:${visualKey(profile)}`,
    imageTint: rubbleTreatment(),
    imageTextureSrc: TEXTURE_ART.worn,
    imageTextureOpacity: 0.44,
    imageTextureOffset: kindOffset(kind) ^ 0x9e3779b9,
  };
}
