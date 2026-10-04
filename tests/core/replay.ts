import { createHash } from 'node:crypto';
import { Command, createGame, step } from '../../src/core';
import type { InputFrame } from '../../src/core';
import { input } from './helpers';

export function replayInput(tick: number): InputFrame {
  return input({
    move: tick % 180 < 90 ? -1 : 1,
    fire: true,
    command:
      tick === 0
        ? Command.Start
        : tick === 650
          ? Command.Pause
          : tick === 710
            ? Command.Continue
            : Command.None,
    activity: true,
  });
}

export function replay(seed: number, ticks = 3600) {
  const state = createGame(seed);
  const eventHash = createHash('sha256');
  const checkpoints: { inputTick: number; state: string; events: string }[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    eventHash.update(JSON.stringify(step(state, replayInput(tick))));
    if ([1, 600, 1200, 2400, 3600].includes(tick + 1)) {
      checkpoints.push({
        inputTick: tick + 1,
        state: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
        events: eventHash.copy().digest('hex'),
      });
    }
  }
  return { seed, ticks, checkpoints };
}
