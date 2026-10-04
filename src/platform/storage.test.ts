import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { CONFIG } from '../core/config';
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
  const bullet = () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  return {
    version: 1,
    seed: 42,
    rng: 23859871,
    tick: 902,
    phase: GamePhase.WaveClear,
    resumePhase: GamePhase.Playing,
    phaseTicks: 55,
    wave: 3,
    score: 3200,
    lives: 2,
    bonusLifeAwarded: false,
    fuel: 70,
    fuelTicks: 83,
    hitStopTicks: 0,
    player: { x: 160, y: CONFIG.playerY, direction: 0, fireCooldown: 0, invulnerableTicks: 0 },
    formationOffset: 3,
    formationDirection: -1,
    diveCooldown: 34,
    nextDiveGroup: 8,
    enemies: Array.from({ length: (CONFIG.rows - 1) * CONFIG.columns + 4 }, (_, id) => ({
      id,
      row: id < 4 ? 0 : 1 + Math.floor((id - 4) / CONFIG.columns),
      column: id < 4 ? id + 2 : (id - 4) % CONFIG.columns,
      kind: EnemyKind.Drone,
      mode: EnemyMode.Dead,
      homeX: 55 + (id % 8) * 30,
      homeY: 42 + Math.floor(id / 8) * 18,
      x: 100,
      y: 50,
      direction: 0,
      steerCooldown: 0,
      fireCooldown: 0,
      diveGroup: 0,
    })),
    playerBullets: Array.from({ length: CONFIG.playerBulletCount }, bullet),
    enemyBullets: Array.from({ length: CONFIG.enemyBulletCount }, bullet),
  };
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
    expect(loadPreferences()).toEqual({ theme: 'retro', music: true, sfx: true });
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
