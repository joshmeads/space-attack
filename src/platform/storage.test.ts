import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  CONFIG,
  FORMATION_COUNT,
  LEGACY_FORMATION_COLUMNS,
  PLAYER_FIRE_INTERVAL_TICKS,
} from '../core/config';
import { createGame, step } from '../core/index';
import { Command, EMPTY_INPUT, EnemyKind, EnemyMode, GamePhase } from '../core/types';
import type { GameState } from '../core/types';
import { chooseDemoInput } from '../demo/ai';
import {
  addScore,
  clearRun,
  loadPreferences,
  loadRun,
  loadScores,
  savePreferences,
  saveRun,
  saveScores,
  STORAGE_KEYS,
} from './storage';

function fixture(): GameState {
  const state = createGame(42);
  state.rng = 23859871;
  state.tick = 902;
  state.phase = GamePhase.WaveClear;
  state.phaseTicks = 55;
  state.wave = 3;
  state.score = 3200;
  state.lives = 2;
  state.fuel = 70;
  state.fuelTicks = 83;
  state.formationOffset = 3;
  state.formationDirection = -1;
  state.diveCooldown = 34;
  state.nextDiveGroup = 8;
  for (const enemy of state.enemies) enemy.mode = EnemyMode.Dead;
  return state;
}

function legacyFixture(compact: boolean): GameState {
  const state = fixture();
  state.enemies = LEGACY_FORMATION_COLUMNS.flatMap((columns, row) =>
    columns.map((column) => ({
      id: row * 8 + column,
      row,
      column,
      kind: row === 0 ? EnemyKind.Flagship : EnemyKind.Drone,
      mode: EnemyMode.Formation,
      homeX: compact ? 83 + column * 22 : 55 + column * 30,
      homeY: 42 + row * (compact ? 15 : 18),
      x: compact ? 83 + column * 22 : 55 + column * 30,
      y: 42 + row * (compact ? 15 : 18),
      direction: 0,
      steerCooldown: 0,
      fireCooldown: 0,
      diveGroup: 0,
    })),
  );
  state.phase = GamePhase.Playing;
  state.phaseTicks = 0;
  return state;
}

let memory: Map<string, string>;

beforeEach(() => {
  memory = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('run persistence', () => {
  it('hydrates paused without changing simulation or random state', () => {
    const state = fixture();
    saveRun(state);
    expect(loadRun()).toEqual({
      ...state,
      phase: GamePhase.Paused,
      resumePhase: GamePhase.WaveClear,
    });
    state.phase = GamePhase.Paused;
    state.resumePhase = GamePhase.Respawning;
    saveRun(state);
    expect(loadRun()).toEqual(state);
    expect(state.phaseTicks).toBe(55);
  });

  it('rejects corrupt fields, incomplete pools, invalid enums and duplicate enemies', () => {
    const state = fixture();
    const corrupt: unknown[] = [
      null,
      { ...state, rng: -1 },
      { ...state, lives: CONFIG.startingLives + 2 },
      { ...state, lives: Number.MAX_SAFE_INTEGER },
      { ...state, wave: 0 },
      { ...state, phase: 'unknown' },
      { ...state, resumePhase: GamePhase.Title },
      { ...state, fuel: 101 },
      { ...state, player: { ...state.player, x: '160' } },
      { ...state, playerBullets: state.playerBullets.slice(1) },
      { ...state, enemyBullets: [...state.enemyBullets, { active: false }] },
      { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, mode: 'bad' })) },
      { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, id: 0 })) },
    ];
    for (const value of corrupt) {
      memory.set(STORAGE_KEYS.run, JSON.stringify(value));
      expect(loadRun()).toBeNull();
    }
    memory.set(STORAGE_KEYS.run, '{');
    expect(loadRun()).toBeNull();
  });

  it('rejects finite timers beyond simulation limits', () => {
    const state = fixture();
    const enormous = Number.MAX_SAFE_INTEGER;
    const corrupt = [
      { ...state, hitStopTicks: enormous },
      { ...state, fuelTicks: CONFIG.fuelInterval },
      { ...state, diveCooldown: enormous },
      { ...state, phaseTicks: CONFIG.waveClearTicks },
      {
        ...state,
        phase: GamePhase.Paused,
        resumePhase: GamePhase.Respawning,
        phaseTicks: CONFIG.respawnTicks,
      },
      { ...state, phase: GamePhase.Playing, phaseTicks: 1 },
      { ...state, player: { ...state.player, fireCooldown: enormous } },
      { ...state, player: { ...state.player, invulnerableTicks: enormous } },
      { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, steerCooldown: enormous })) },
      { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, fireCooldown: enormous })) },
    ];
    for (const value of corrupt) {
      memory.set(STORAGE_KEYS.run, JSON.stringify(value));
      expect(loadRun()).toBeNull();
    }
  });

  it('round-trips actual core saves and continues the identical random stream', () => {
    const original = createGame(42);
    step(original, { ...EMPTY_INPUT, command: Command.Start });
    for (let tick = 0; tick < 1200; tick += 1) {
      step(original, { ...chooseDemoInput(original), debugInvulnerable: true });
      if (tick % 60 !== 0) continue;
      saveRun(original);
      const restored = loadRun();
      expect(restored).not.toBeNull();
      if (!restored) throw new Error('Valid run was rejected');
      expect(restored).toEqual({
        ...original,
        phase: GamePhase.Paused,
        resumePhase: original.phase,
      });
    }
    saveRun(original);
    const restored = loadRun();
    if (!restored) throw new Error('Valid run was rejected');
    step(restored, { ...EMPTY_INPUT, command: Command.Continue });
    for (let tick = 0; tick < 300; tick += 1) {
      const input = { ...chooseDemoInput(original), debugInvulnerable: true };
      expect(step(restored, input)).toEqual(step(original, input));
      expect(restored).toEqual(original);
    }
  });

  it('preserves both legacy 36-enemy save geometries until the next wave', () => {
    for (const compact of [false, true]) {
      const original = legacyFixture(compact);
      saveRun(original);
      const restored = loadRun();
      if (!restored) throw new Error('Legacy run was rejected');
      expect(restored).toEqual({ ...original, phase: GamePhase.Paused });
      step(restored, { ...EMPTY_INPUT, command: Command.Continue });
      for (let tick = 0; tick < 150; tick += 1) {
        const input = { ...chooseDemoInput(original), debugInvulnerable: true };
        expect(step(restored, input)).toEqual(step(original, input));
        expect(restored).toEqual(original);
      }
      expect(restored.enemies).toHaveLength(36);
      step(restored, { ...EMPTY_INPUT, debugSkipWave: true });
      for (let tick = 0; tick < CONFIG.waveClearTicks; tick += 1) step(restored, EMPTY_INPUT);
      expect(restored.enemies).toHaveLength(FORMATION_COUNT);
      saveRun(restored);
      expect(loadRun()).toEqual({ ...restored, phase: GamePhase.Paused });
    }
  });

  it('accepts the configured fire timer and rejects invalid occupied slots', () => {
    const state = fixture();
    state.player.fireCooldown = PLAYER_FIRE_INTERVAL_TICKS;
    saveRun(state);
    expect(loadRun()?.player.fireCooldown).toBe(PLAYER_FIRE_INTERVAL_TICKS);
    state.player.fireCooldown += 1;
    saveRun(state);
    expect(loadRun()).toBeNull();
    const first = state.enemies[0];
    if (!first) throw new Error('Fixture has no enemies');
    state.player.fireCooldown = 0;
    first.column = 4;
    first.id = 4;
    saveRun(state);
    expect(loadRun()).toBeNull();
  });

  it('saves only resumable phases and clears a run independently', () => {
    const state = fixture();
    for (const phase of [GamePhase.Title, GamePhase.Screensaver, GamePhase.GameOver]) {
      state.phase = phase;
      saveRun(state);
      expect(memory.has(STORAGE_KEYS.run)).toBe(false);
    }
    state.phase = GamePhase.Playing;
    state.phaseTicks = 0;
    saveRun(state);
    savePreferences({ theme: 'retro', music: false, sfx: true });
    clearRun();
    expect(loadRun()).toBeNull();
    expect(loadPreferences().music).toBe(false);
  });

  it('survives unavailable storage on every persistence operation', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadRun()).toBeNull();
    expect(loadPreferences()).toEqual({ theme: 'classic', music: true, sfx: true });
    expect(loadScores()).toEqual([]);
    expect(() => {
      saveRun(fixture());
      savePreferences({ theme: 'retro', music: true, sfx: true });
      saveScores([]);
      clearRun();
    }).not.toThrow();
  });
});

it('stores separate preferences and the best five normalized scores', () => {
  savePreferences({ theme: 'modern', music: false, sfx: true });
  expect(loadPreferences()).toEqual({ theme: 'modern', music: false, sfx: true });
  saveScores(
    Array.from({ length: 7 }, (_, index) => ({ initials: ' a!', score: index * 100, wave: 1 })),
  );
  expect(loadScores().map((entry) => entry.score)).toEqual([600, 500, 400, 300, 200]);
  expect(loadScores()[0]?.initials).toBe('AAA');
  expect(addScore({ initials: 'XYZ', score: 900, wave: 3 })[0]?.initials).toBe('XYZ');
});

it('demo input is deterministic and does not mutate state', () => {
  const state = fixture();
  state.phase = GamePhase.Playing;
  const previous = structuredClone(state);
  expect(chooseDemoInput(state)).toEqual(chooseDemoInput(state));
  expect(state).toEqual(previous);
  state.enemyBullets[0] = { active: true, x: 159, y: CONFIG.playerY - 10, vx: 0, vy: 2 };
  expect(chooseDemoInput(state).move).toBe(1);
});

it('defaults to Classic while preserving all valid stored theme preferences', () => {
  expect(loadPreferences().theme).toBe('classic');
  for (const theme of ['classic', 'retro', 'modern'] as const) {
    savePreferences({ theme, music: false, sfx: true });
    expect(loadPreferences()).toEqual({ theme, music: false, sfx: true });
  }
});
