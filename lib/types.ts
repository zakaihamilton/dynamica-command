export type Owner = 0 | 1;

export type UnitKind = "harvester" | "infantry" | "antiArmor" | "tank";
export type BuildingKind =
  | "constructionYard"
  | "power"
  | "refinery"
  | "barracks"
  | "factory"
  | "turret"
  | "objective";

export type EntityClass = "unit" | "building";

export type WinCategoryKind =
  | "harvestQuota"
  | "forceQuota"
  | "structureQuota"
  | "destroyMarked"
  | "razeAll"
  | "decapitate"
  | "annihilate"
  | "holdTheLine";

export type WinCategory = {
  kind: WinCategoryKind;
  target?: number;
  role?: UnitKind;
  building?: BuildingKind;
  targetCount?: number;
  targetIds?: number[];
  ticks?: number;
};

export type TileKind = 0 | 1 | 2 | 3;

export const TILE_CLEAR = 0 as const;
export const TILE_WATER = 1 as const;
export const TILE_RESOURCE = 2 as const;
export const TILE_BLOCKED = 3 as const;

export type SurfaceKind = 0 | 1 | 2;
export const SURFACE_NONE = 0 as const;
export const SURFACE_ROAD = 1 as const;
export const SURFACE_CONCRETE = 2 as const;

export type BiomeName =
  | "ash plains"
  | "crystal flats"
  | "rust canyons"
  | "salt marshes"
  | "glass desert"
  | "tundra grid"
  | "jungle wreckage"
  | "volcanic shelf";

export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Vec2 = { x: number; y: number };

export type Entity = {
  id: number;
  owner: Owner;
  class: EntityClass;
  kind: UnitKind | BuildingKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  path: Vec2[];
  attackTarget?: number;
  carry: number;
  constructing: number;
  producing?: { kind: UnitKind; remaining: number };
  queue: UnitKind[];
  marked: boolean;
  gatherX?: number;
  gatherY?: number;
  idle: boolean;
  facing?: Facing;
  repairing?: boolean;
};

export type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  outline: string;
  light: string;
  dark: string;
};

export type Faction = {
  id: Owner;
  name: string;
  adjective: string;
  palette: Palette;
};

export type FaceDna = {
  skin: string;
  hair: string;
  hairStyle: 0 | 1 | 2 | 3;
  eyes: string;
  brow: number;
  jaw: number;
  mouthWidth: number;
  nose: number;
  uniform: string;
  headgear: 0 | 1 | 2 | 3;
  insignia: 0 | 1 | 2 | 3;
  beard: 0 | 1 | 2 | 3;
  scar: boolean;
};

export type CharacterRole = "commander" | "advisor" | "enemyLeader";

export type Character = {
  role: CharacterRole;
  name: string;
  title: string;
  face: FaceDna;
};

export type BriefingLine = {
  speaker: CharacterRole;
  text: string;
};

export type WorldSetting = {
  name: string;
  tone: string;
  conflict: string;
  era: string;
  biome: BiomeName;
};

export type MissionDef = {
  index: number;
  name: string;
  briefing: BriefingLine[];
  win: WinCategory;
  mapSize: number;
};

export type Campaign = {
  seed: string;
  seedNumber: number;
  world: WorldSetting;
  factions: [Faction, Faction];
  characters: {
    commander: Character;
    advisor: Character;
    enemyLeader: Character;
  };
  missions: MissionDef[];
};

export type ShapeSpec = {
  type: "rect" | "ellipse" | "poly" | "diamond" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  alpha?: number;
  points?: number[];
};

export type SpriteSpec = {
  id: string;
  kind: "unit" | "building" | "tile";
  w: number;
  h: number;
  palette: Palette;
  shapes: ShapeSpec[];
  svg?: string;
  anchorX?: number;
  anchorY?: number;
  pixelScale?: number;
};

export type TileContour = "none" | "bank" | "ridge";

export type TileSpriteOptions = {
  biome?: BiomeName;
  variant?: number;
  edgeMask?: number;
  surface?: SurfaceKind;
  resourceLevel?: number;
  contour?: TileContour;
};

export type AnimFrame = 0 | 1 | 2 | 3;

export type UnitSpriteOptions = {
  variant?: number;
  facing?: Facing;
  animationFrame?: AnimFrame;
  damageStage?: 0 | 1 | 2;
};

export type BuildingSpriteOptions = {
  variant?: number;
  animationFrame?: AnimFrame;
  damageStage?: 0 | 1 | 2;
  constructionStage?: 0 | 1 | 2 | 3;
};

export type SimState = {
  seed: number;
  missionIndex: number;
  tick: number;
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
  surfaces: SurfaceKind[];
  biome: BiomeName;
  resourceAmount: number[];
  fog: number[];
  entities: Entity[];
  nextId: number;
  credits: [number, number];
  creditsEarned: [number, number];
  unitsProduced: [number, number];
  unitsProducedByRole: Record<UnitKind, number>;
  buildingsCompleted: [number, number];
  buildingsCompletedByKind: Record<string, number>;
  win: WinCategory;
  result: "playing" | "won" | "lost";
  rngState: number;
  factions: [Faction, Faction];
  missionName: string;
};

export type Command =
  | { type: "move"; unitIds: number[]; x: number; y: number }
  | { type: "attack"; unitIds: number[]; targetId: number }
  | { type: "harvest"; unitIds: number[]; x: number; y: number }
  | { type: "build"; building: BuildingKind; x: number; y: number }
  | { type: "produce"; fromId: number; unit: UnitKind }
  | { type: "cancelBuild"; building: BuildingKind }
  | { type: "cancelProduce"; unit: UnitKind }
  | { type: "repair"; buildingId: number };

export type SimEvent =
  | { type: "produced"; owner: Owner; kind: UnitKind }
  | { type: "built"; owner: Owner; kind: BuildingKind }
  | { type: "destroyed"; id: number; kind: string }
  | { type: "credits"; owner: Owner; amount: number }
  | { type: "won" }
  | { type: "lost" };

export type InspectReport = {
  seed: string;
  missionIndex: number;
  tick: number;
  credits: number;
  creditsEarned: number;
  units: { player: number; enemy: number };
  buildings: { player: number; enemy: number };
  objective: { kind: WinCategoryKind; label: string; current: number; target: number };
  result: SimState["result"];
};
