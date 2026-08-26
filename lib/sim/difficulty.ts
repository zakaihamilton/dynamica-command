export type MissionDifficulty = {
  enemyProductionStart: number;
  enemyProductionEvery: number;
  enemyAssaultEvery: number;
  startingTank: boolean;
  startingTurret: boolean;
  assaultSupport: boolean;
  holdLineReinforcements: number;
  startingGuards: number;
};

const DIFFICULTY_CURVE: MissionDifficulty[] = [
  {
    enemyProductionStart: 180,
    enemyProductionEvery: 144,
    enemyAssaultEvery: 720,
    startingTank: false,
    startingTurret: false,
    assaultSupport: false,
    holdLineReinforcements: 2,
    startingGuards: 0,
  },
  {
    enemyProductionStart: 66,
    enemyProductionEvery: 60,
    enemyAssaultEvery: 168,
    startingTank: true,
    startingTurret: true,
    assaultSupport: false,
    holdLineReinforcements: 3,
    startingGuards: 2,
  },
  {
    enemyProductionStart: 132,
    enemyProductionEvery: 120,
    enemyAssaultEvery: 156,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 3,
    startingGuards: 3,
  },
  {
    enemyProductionStart: 54,
    enemyProductionEvery: 48,
    enemyAssaultEvery: 144,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 4,
    startingGuards: 3,
  },
  {
    enemyProductionStart: 48,
    enemyProductionEvery: 42,
    enemyAssaultEvery: 132,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 5,
    startingGuards: 4,
  },
  {
    enemyProductionStart: 42,
    enemyProductionEvery: 36,
    enemyAssaultEvery: 120,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 5,
    startingGuards: 4,
  },
  {
    enemyProductionStart: 36,
    enemyProductionEvery: 30,
    enemyAssaultEvery: 108,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 6,
    startingGuards: 5,
  },
  {
    enemyProductionStart: 60,
    enemyProductionEvery: 60,
    enemyAssaultEvery: 288,
    startingTank: true,
    startingTurret: true,
    assaultSupport: true,
    holdLineReinforcements: 4,
    startingGuards: 0,
  },
];

export function missionDifficulty(missionIndex: number): MissionDifficulty {
  const index = Math.max(0, Math.min(DIFFICULTY_CURVE.length - 1, Math.floor(missionIndex)));
  return DIFFICULTY_CURVE[index]!;
}
