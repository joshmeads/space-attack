import { CONFIG } from '../core/config';
import { Command, EnemyMode, GamePhase } from '../core/types';
import type { DeepReadonly, Direction, GameState, InputFrame } from '../core/types';

export function chooseDemoInput(state: DeepReadonly<GameState>): InputFrame {
  let command = Command.None;
  if (state.phase === GamePhase.Title || state.phase === GamePhase.Screensaver)
    command = Command.Start;
  if (state.phase === GamePhase.Paused) command = Command.Continue;
  let target = CONFIG.width / 2;
  let best = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (enemy.mode === EnemyMode.Dead) continue;
    const alignment = Math.abs(enemy.x - state.player.x);
    const weight = alignment + (enemy.mode === EnemyMode.Diving ? -20 : enemy.row * 3);
    if (weight < best) {
      best = weight;
      target = enemy.x;
    }
  }
  let move: Direction =
    Math.abs(target - state.player.x) < 3 ? 0 : target < state.player.x ? -1 : 1;
  let dangerTime = Number.POSITIVE_INFINITY;
  let dangerX = state.player.x;
  for (const bullet of state.enemyBullets) {
    if (!bullet.active || bullet.vy <= 0) continue;
    const ticksToPlayer = (state.player.y - bullet.y) / bullet.vy;
    if (ticksToPlayer < 0 || ticksToPlayer > 30) continue;
    const crossingX = bullet.x + bullet.vx * ticksToPlayer;
    if (Math.abs(crossingX - state.player.x) < 12 && ticksToPlayer < dangerTime) {
      dangerTime = ticksToPlayer;
      dangerX = crossingX;
    }
  }
  for (const enemy of state.enemies) {
    if (
      enemy.mode !== EnemyMode.Diving ||
      enemy.y < state.player.y - 35 ||
      enemy.y > state.player.y + 12
    )
      continue;
    if (Math.abs(enemy.x - state.player.x) < 18) {
      dangerTime = 0;
      dangerX = enemy.x;
    }
  }
  if (dangerTime < Number.POSITIVE_INFINITY) {
    move = state.player.x < dangerX ? -1 : 1;
    if (state.player.x < 20) move = 1;
    if (state.player.x > CONFIG.width - 20) move = -1;
  }
  return {
    move,
    fire: state.phase === GamePhase.Playing,
    command,
    activity: true,
    debugInvulnerable: false,
    debugSkipWave: false,
  };
}

export const getAIInput = chooseDemoInput;
