import type { CharacterRole } from "../types";

export const PORTRAIT_FRAME_COUNT = 3;
export const PORTRAIT_FRAME_WIDTH = 512;
export const PORTRAIT_FRAME_HEIGHT = 1024;

export type PortraitAsset = {
  id: string;
  src: string;
  role: CharacterRole;
  feminine: boolean;
  frameCount: typeof PORTRAIT_FRAME_COUNT;
  frameWidth: typeof PORTRAIT_FRAME_WIDTH;
  frameHeight: typeof PORTRAIT_FRAME_HEIGHT;
};

function createPortraitAssets(role: CharacterRole, prefix: string): PortraitAsset[] {
  return Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `${prefix}-${number}`,
      src: `/art/portraits/${prefix}-${number}.png`,
      role,
      feminine: index % 2 === 0,
      frameCount: PORTRAIT_FRAME_COUNT,
      frameWidth: PORTRAIT_FRAME_WIDTH,
      frameHeight: PORTRAIT_FRAME_HEIGHT,
    };
  });
}

export const PORTRAIT_ASSETS: readonly PortraitAsset[] = [
  ...createPortraitAssets("commander", "commander"),
  ...createPortraitAssets("advisor", "advisor"),
  ...createPortraitAssets("enemyLeader", "enemy-leader"),
];

const PORTRAIT_BY_ID = new Map(PORTRAIT_ASSETS.map((asset) => [asset.id, asset]));

export function getPortraitAsset(id: string): PortraitAsset | undefined {
  return PORTRAIT_BY_ID.get(id);
}

export function portraitCandidates(role?: CharacterRole, feminine?: boolean): readonly PortraitAsset[] {
  const roleCandidates = role ? PORTRAIT_ASSETS.filter((asset) => asset.role === role) : PORTRAIT_ASSETS;
  if (feminine === undefined) return roleCandidates;
  const presentationCandidates = roleCandidates.filter((asset) => asset.feminine === feminine);
  return presentationCandidates.length > 0 ? presentationCandidates : roleCandidates;
}
