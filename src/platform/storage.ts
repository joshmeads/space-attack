import {
  CONFIG,
  FORMATION_COLUMNS,
  FORMATION_COUNT,
  LEGACY_FORMATION_COLUMNS,
  PLAYER_FIRE_INTERVAL_TICKS,
} from '../core/config';
import { EnemyKind, EnemyMode, GamePhase } from '../core/types';
import type {
  ActivePhase,
  BulletState,
  DeepReadonly,
  Direction,
  EnemyState,
  GameState,
  PlayerState,
} from '../core/types';
import type { ThemeId } from '../themes/types';

export interface Preferences {
  theme: ThemeId;
  music: boolean;
  sfx: boolean;
}

export interface HighScore {
  initials: string;
  score: number;
  wave: number;
}

export const STORAGE_KEYS = {
  run: 'space-attack.run.v1',
  preferences: 'space-attack.preferences.v1',
  scores: 'space-attack.scores.v1',
};

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  theme: 'classic',
  music: true,
  sfx: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isNumber(value) && Number.isSafeInteger(value) && value >= 0;
}

function isUint32(value: unknown): value is number {
  return isCount(value) && value <= 0xffffffff;
}

function isDirection(value: unknown): value is Direction {
  return value === -1 || value === 0 || value === 1;
}

function isActivePhase(value: unknown): value is ActivePhase {
  return (
    value === GamePhase.Playing || value === GamePhase.Respawning || value === GamePhase.WaveClear
  );
}

function isSavedPhase(value: unknown): value is ActivePhase | GamePhase.Paused {
  return isActivePhase(value) || value === GamePhase.Paused;
}

function isEnemyKind(value: unknown): value is EnemyKind {
  return (
    value === EnemyKind.Flagship ||
    value === EnemyKind.Scout ||
    value === EnemyKind.Striker ||
    value === EnemyKind.Drone
  );
}

function isEnemyMode(value: unknown): value is EnemyMode {
  return value === EnemyMode.Formation || value === EnemyMode.Diving || value === EnemyMode.Dead;
}

function parsePlayer(value: unknown): PlayerState | null {
  if (
    !isRecord(value) ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isDirection(value.direction) ||
    !isCount(value.fireCooldown) ||
    value.fireCooldown > PLAYER_FIRE_INTERVAL_TICKS ||
    !isCount(value.invulnerableTicks) ||
    value.invulnerableTicks > CONFIG.invulnerabilityTicks
  )
    return null;
  if (value.x < 0 || value.x > CONFIG.width || value.y !== CONFIG.playerY) return null;
  return {
    x: value.x,
    y: value.y,
    direction: value.direction,
    fireCooldown: value.fireCooldown,
    invulnerableTicks: value.invulnerableTicks,
  };
}

function parseBullet(value: unknown): BulletState | null {
  if (
    !isRecord(value) ||
    typeof value.active !== 'boolean' ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isNumber(value.vx) ||
    !isNumber(value.vy)
  )
    return null;
  return { active: value.active, x: value.x, y: value.y, vx: value.vx, vy: value.vy };
}

function parseEnemy(value: unknown): EnemyState | null {
  if (
    !isRecord(value) ||
    !isCount(value.id) ||
    !isCount(value.row) ||
    !isCount(value.column) ||
    !isEnemyKind(value.kind) ||
    !isEnemyMode(value.mode) ||
    !isNumber(value.homeX) ||
    !isNumber(value.homeY) ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isDirection(value.direction) ||
    !isCount(value.steerCooldown) ||
    value.steerCooldown > CONFIG.steeringInterval ||
    !isCount(value.fireCooldown) ||
    value.fireCooldown > Math.max(CONFIG.baseEnemyFireInterval, CONFIG.minimumEnemyFireInterval) ||
    !isCount(value.diveGroup)
  )
    return null;
  return {
    id: value.id,
    row: value.row,
    column: value.column,
    kind: value.kind,
    mode: value.mode,
    homeX: value.homeX,
    homeY: value.homeY,
    x: value.x,
    y: value.y,
    direction: value.direction,
    steerCooldown: value.steerCooldown,
    fireCooldown: value.fireCooldown,
    diveGroup: value.diveGroup,
  };
}

function parsePool<T>(
  value: unknown,
  length: number,
  parse: (entry: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  const entries: T[] = [];
  for (const entry of value) {
    const parsed = parse(entry);
    if (parsed === null) return null;
    entries.push(parsed);
  }
  return entries;
}

function parseRun(value: unknown): GameState | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isUint32(value.seed) ||
    !isUint32(value.rng) ||
    value.rng === 0 ||
    !isCount(value.tick) ||
    !isSavedPhase(value.phase) ||
    !isActivePhase(value.resumePhase) ||
    !isCount(value.phaseTicks) ||
    !isCount(value.wave) ||
    value.wave < 1 ||
    !isCount(value.score) ||
    !isCount(value.lives) ||
    value.lives < 1 ||
    value.lives > CONFIG.startingLives + 1 ||
    typeof value.bonusLifeAwarded !== 'boolean' ||
    !isNumber(value.fuel) ||
    value.fuel < 0 ||
    value.fuel > CONFIG.fuelCapacity ||
    !isCount(value.fuelTicks) ||
    value.fuelTicks >= CONFIG.fuelInterval ||
    !isCount(value.hitStopTicks) ||
    value.hitStopTicks > CONFIG.hitStopTicks ||
    !isNumber(value.formationOffset) ||
    !isDirection(value.formationDirection) ||
    !isCount(value.diveCooldown) ||
    value.diveCooldown > Math.max(CONFIG.baseDiveInterval, CONFIG.minimumDiveInterval) ||
    !isCount(value.nextDiveGroup)
  )
    return null;
  const resumePhase = value.phase === GamePhase.Paused ? value.resumePhase : value.phase;
  if (
    (resumePhase === GamePhase.Playing && value.phaseTicks !== 0) ||
    (resumePhase === GamePhase.Respawning && value.phaseTicks >= CONFIG.respawnTicks) ||
    (resumePhase === GamePhase.WaveClear && value.phaseTicks >= CONFIG.waveClearTicks)
  )
    return null;
  const player = parsePlayer(value.player);
  if (!Array.isArray(value.enemies)) return null;
  const legacyCount = LEGACY_FORMATION_COLUMNS.reduce(
    (count, columns) => count + columns.length,
    0,
  );
  const legacy = value.enemies.length === legacyCount;
  if (!legacy && value.enemies.length !== FORMATION_COUNT) return null;
  const layout = legacy ? LEGACY_FORMATION_COLUMNS : FORMATION_COLUMNS;
  const enemies = parsePool(value.enemies, legacy ? legacyCount : FORMATION_COUNT, parseEnemy);
  const playerBullets = parsePool(value.playerBullets, CONFIG.playerBulletCount, parseBullet);
  const enemyBullets = parsePool(value.enemyBullets, CONFIG.enemyBulletCount, parseBullet);
  if (!player || !enemies || !playerBullets || !enemyBullets) return null;
  if (
    new Set(enemies.map((enemy) => enemy.id)).size !== enemies.length ||
    new Set(enemies.map((enemy) => `${enemy.row}:${enemy.column}`)).size !== enemies.length ||
    enemies.some((enemy) => {
      if (!layout[enemy.row]?.includes(enemy.column)) return true;
      if (enemy.id !== enemy.row * (legacy ? 8 : CONFIG.columns) + enemy.column) return true;
      if (legacy) {
        const compact =
          enemy.homeX === 83 + enemy.column * 22 && enemy.homeY === 42 + enemy.row * 15;
        const original =
          enemy.homeX === 55 + enemy.column * 30 && enemy.homeY === 42 + enemy.row * 18;
        return !compact && !original;
      }
      return (
        enemy.homeX !== CONFIG.formationStartX + enemy.column * CONFIG.formationSpacingX ||
        enemy.homeY !== CONFIG.formationStartY + enemy.row * CONFIG.formationSpacingY
      );
    })
  )
    return null;
  return {
    version: 1,
    seed: value.seed,
    rng: value.rng,
    tick: value.tick,
    phase: GamePhase.Paused,
    resumePhase,
    phaseTicks: value.phaseTicks,
    wave: value.wave,
    score: value.score,
    lives: value.lives,
    bonusLifeAwarded: value.bonusLifeAwarded,
    fuel: value.fuel,
    fuelTicks: value.fuelTicks,
    hitStopTicks: value.hitStopTicks,
    player,
    formationOffset: value.formationOffset,
    formationDirection: value.formationDirection,
    diveCooldown: value.diveCooldown,
    nextDiveGroup: value.nextDiveGroup,
    enemies,
    playerBullets,
    enemyBullets,
  };
}

function read(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? null : JSON.parse(stored);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function loadRun(): GameState | null {
  return parseRun(read(STORAGE_KEYS.run));
}

export function saveRun(state: DeepReadonly<GameState>): void {
  if (isSavedPhase(state.phase)) write(STORAGE_KEYS.run, state);
}

export function clearRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.run);
  } catch {
    return;
  }
}

export function loadPreferences(): Preferences {
  const value = read(STORAGE_KEYS.preferences);
  if (
    !isRecord(value) ||
    (value.theme !== 'classic' && value.theme !== 'retro' && value.theme !== 'modern') ||
    typeof value.music !== 'boolean' ||
    typeof value.sfx !== 'boolean'
  )
    return { ...DEFAULT_PREFERENCES };
  return { theme: value.theme, music: value.music, sfx: value.sfx };
}

export function savePreferences(preferences: Readonly<Preferences>): void {
  write(STORAGE_KEYS.preferences, preferences);
}

function parseScore(value: unknown): HighScore | null {
  if (
    !isRecord(value) ||
    typeof value.initials !== 'string' ||
    !/^[A-Z0-9]{3}$/.test(value.initials) ||
    !isCount(value.score) ||
    !isCount(value.wave) ||
    value.wave < 1
  )
    return null;
  return { initials: value.initials, score: value.score, wave: value.wave };
}

export function loadScores(): HighScore[] {
  const value = read(STORAGE_KEYS.scores);
  if (!Array.isArray(value) || value.length > 5) return [];
  const entries = parsePool(value, value.length, parseScore);
  return entries?.sort((first, second) => second.score - first.score) ?? [];
}

export function saveScores(scores: readonly HighScore[]): void {
  const entries = scores
    .map((entry) => ({
      initials: entry.initials
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .padEnd(3, 'A')
        .slice(0, 3),
      score: entry.score,
      wave: entry.wave,
    }))
    .filter((entry) => parseScore(entry) !== null)
    .sort((first, second) => second.score - first.score)
    .slice(0, 5);
  write(STORAGE_KEYS.scores, entries);
}

export function qualifiesForHighScore(score: number): boolean {
  if (!isCount(score)) return false;
  const scores = loadScores();
  return scores.length < 5 || score > (scores[4]?.score ?? 0);
}

export function addScore(entry: HighScore): HighScore[] {
  saveScores([...loadScores(), entry]);
  return loadScores();
}
