export enum GamePhase {
  Title = 'title',
  Screensaver = 'screensaver',
  Playing = 'playing',
  Respawning = 'respawning',
  WaveClear = 'wave-clear',
  Paused = 'paused',
  GameOver = 'game-over',
}

export enum Command {
  None = 'none',
  Start = 'start',
  Pause = 'pause',
  Continue = 'continue',
}

export enum EnemyMode {
  Formation = 'formation',
  Diving = 'diving',
  Dead = 'dead',
}

export enum EnemyKind {
  Flagship = 'flagship',
  Scout = 'scout',
  Striker = 'striker',
  Drone = 'drone',
}

export type ActivePhase = GamePhase.Playing | GamePhase.Respawning | GamePhase.WaveClear;
export type Direction = -1 | 0 | 1;
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export interface InputFrame {
  move: Direction;
  fire: boolean;
  command: Command;
  activity: boolean;
  debugInvulnerable: boolean;
  debugSkipWave: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  direction: Direction;
  fireCooldown: number;
  invulnerableTicks: number;
}

export interface BulletState {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface EnemyState {
  id: number;
  row: number;
  column: number;
  kind: EnemyKind;
  mode: EnemyMode;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  direction: Direction;
  steerCooldown: number;
  fireCooldown: number;
  diveGroup: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  tick: number;
  phase: GamePhase;
  resumePhase: ActivePhase;
  phaseTicks: number;
  wave: number;
  score: number;
  lives: number;
  bonusLifeAwarded: boolean;
  fuel: number;
  fuelTicks: number;
  hitStopTicks: number;
  player: PlayerState;
  formationOffset: number;
  formationDirection: Direction;
  diveCooldown: number;
  nextDiveGroup: number;
  enemies: EnemyState[];
  playerBullets: BulletState[];
  enemyBullets: BulletState[];
}

export interface Difficulty {
  formationSpeed: number;
  diveSpeed: number;
  diveHorizontalSpeed: number;
  diveInterval: number;
  maxDivers: number;
  enemyFireInterval: number;
  enemyBulletSpeed: number;
}

export type GameEvent =
  | { kind: 'shot'; owner: 'player' | 'enemy'; x: number; y: number }
  | {
      kind: 'kill';
      enemyId: number;
      enemyKind: EnemyKind;
      diving: boolean;
      x: number;
      y: number;
      points: number;
    }
  | { kind: 'hit'; cause: 'bullet' | 'collision' | 'fuel'; x: number; y: number; lives: number }
  | { kind: 'dive'; enemyId: number; x: number; y: number }
  | { kind: 'wave'; wave: number }
  | { kind: 'phase'; from: GamePhase; to: GamePhase }
  | { kind: 'bonus'; lives: number; score: number }
  | { kind: 'cancel'; x: number; y: number };

export const EMPTY_INPUT: Readonly<InputFrame> = {
  move: 0,
  fire: false,
  command: Command.None,
  activity: false,
  debugInvulnerable: false,
  debugSkipWave: false,
};
