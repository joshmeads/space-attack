import { describe, expect, it } from 'vite-plus/test';
import { createGame, step } from '../../src/core';
import approvedReplay from './replay-digest.json';
import { replay, replayInput } from './replay';

describe('deterministic replay', () => {
  it('produces identical state and events for the same seed and recorded inputs', () => {
    expect(replay(1982)).toEqual(replay(1982));
    expect(replay(1983)).not.toEqual(replay(1982));
  });

  it('matches the reviewed replay checkpoints', () => {
    expect(replay(approvedReplay.seed, approvedReplay.ticks)).toEqual(approvedReplay);
  });

  it('continues from a complete snapshot with the same RNG and results', () => {
    const uninterrupted = createGame(1982);
    for (let tick = 0; tick < 1377; tick += 1) step(uninterrupted, replayInput(tick));
    const restored = structuredClone(uninterrupted);
    expect(restored.rng).toBe(uninterrupted.rng);
    for (let tick = 1377; tick < 3600; tick += 1) {
      expect(step(restored, replayInput(tick))).toEqual(step(uninterrupted, replayInput(tick)));
    }
    expect(JSON.stringify(restored)).toBe(JSON.stringify(uninterrupted));
  });
});
