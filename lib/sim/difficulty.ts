export type MissionDifficulty = {
  enemyProductionStart: number;
  enemyProductionEvery: number;
  enemyAssaultEvery: number;
  startingTank: boolean;
  startingTurret: boolean;
  assaultSupport: boolean;
  holdLineReinforcements: number;
};

const DIFFICULTY_CURVE: MissionDifficulty[] = [
  {
    enemyProductionStart: 180,
    enemyProductionEvery: 144,
    enemyAssaultEvery: 720,
    startingTank: false,
    startingTurret: false,
    assaultSupport: false,
    holdLineReinforcements: 0,
  },
  {
    enemyProductionStart: 156,
    enemyProductionEvery: 132,
    enemyAssaultEvery: 648,
    startingTank: true,
    startingTurret: true,
    assaultSupport: false,
    holdLineReinforcements: 1,
  },
  {
    enemyProductionStart: 132,
    enemyProductionEvery: 120,
    enemyAssaultEvery: 576,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 1,
  },
  {
    enemyProductionStart: 108,
    enemyProductionEvery: 108,
    enemyAssaultEvery: 504,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 2,
  },
  {
    enemyProductionStart: 96,
    enemyProductionEvery: 96,
    enemyAssaultEvery: 432,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 3,
  },
  {
    enemyProductionStart: 84,
    enemyProductionEvery: 84,
    enemyAssaultEvery: 384,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 3,
  },
  {
    enemyProductionStart: 72,
    enemyProductionEvery: 72,
    enemyAssaultEvery: 336,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 4,
  },
  {
    enemyProductionStart: 60,
    enemyProductionEvery: 60,
    enemyAssaultEvery: 288,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 4,
  },
];

export function missionDifficulty(missionIndex: number): MissionDifficulty {
  const index = Math.max(0, Math.min(DIFFICULTY_CURVE.length - 1, Math.floor(missionIndex)));
  return DIFFICULTY_CURVE[index]!;
}
