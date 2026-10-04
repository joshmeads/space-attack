import { GamePhase } from './types';

export const CONFIG = {
  width: 320,
  height: 240,
  tickRate: 60,
  playerY: 212,
  playerSpeed: 2.35,
  playerHalfWidth: 3.5,
  playerHalfHeight: 3.5,
  enemyHalfWidth: 5,
  enemyHalfHeight: 4,
  bulletHalfWidth: 1,
  bulletHalfHeight: 3,
  playerBulletSpeed: 4.5,
  playerFireInterval: 12,
  playerBulletCount: 2,
  enemyBulletCount: 64,
  startingLives: 3,
  bonusLifeScore: 5000,
  fuelCapacity: 100,
  fuelChunk: 3,
  fuelInterval: 120,
  respawnTicks: 60,
  invulnerabilityTicks: 120,
  waveClearTicks: 120,
  screensaverTicks: 600,
  hitStopTicks: 3,
  steeringInterval: 60,
  formationLimit: 14,
  formationStartX: 88,
  formationStartY: 42,
  formationSpacingX: 18,
  formationSpacingY: 11,
  rows: 6,
  columns: 9,
  baseFormationSpeed: 0.25,
  baseDiveSpeed: 1.05,
  baseDiveHorizontalSpeed: 0.7,
  baseDiveInterval: 150,
  minimumDiveInterval: 36,
  baseMaxDivers: 2,
  maximumDivers: 10,
  baseEnemyFireInterval: 30,
  minimumEnemyFireInterval: 30,
  baseEnemyBulletSpeed: 1.9,
  flagshipDiveScore: 150,
  escortBonus: 150,
} as const;

export const ROW_SCORES: readonly number[] = [60, 50, 40, 30, 20, 20];

export const TRANSITIONS: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  [GamePhase.Title]: [GamePhase.Screensaver, GamePhase.Playing],
  [GamePhase.Screensaver]: [GamePhase.Title, GamePhase.Playing],
  [GamePhase.Playing]: [
    GamePhase.Respawning,
    GamePhase.WaveClear,
    GamePhase.Paused,
    GamePhase.GameOver,
  ],
  [GamePhase.Respawning]: [GamePhase.Playing, GamePhase.Paused, GamePhase.GameOver],
  [GamePhase.WaveClear]: [GamePhase.Playing, GamePhase.Paused],
  [GamePhase.Paused]: [GamePhase.Playing, GamePhase.Respawning, GamePhase.WaveClear],
  [GamePhase.GameOver]: [],
};

export const FORMATION_COLUMNS: readonly (readonly number[])[] = [
  [3, 5],
  [2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
];

export const LEGACY_FORMATION_COLUMNS: readonly (readonly number[])[] = [
  [2, 3, 4, 5],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 1, 2, 3, 4, 5, 6, 7],
];

export const FORMATION_COUNT = FORMATION_COLUMNS.reduce(
  (count, columns) => count + columns.length,
  0,
);
