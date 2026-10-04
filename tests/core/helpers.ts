import { Command, EMPTY_INPUT, EnemyMode, createGame, step } from '../../src/core';
import type { EnemyState, GameEvent, GameState, InputFrame } from '../../src/core';

export function input(overrides: Partial<InputFrame> = {}): InputFrame {
  return { ...EMPTY_INPUT, ...overrides };
}

export function playing(seed = 1982): GameState {
  const state = createGame(seed);
  step(state, input({ command: Command.Start }));
  state.player.invulnerableTicks = 0;
  state.diveCooldown = 1_000_000;
  return state;
}

export function advance(state: GameState, ticks: number, frame = input()): GameEvent[] {
  const events: GameEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...step(state, frame));
  return events;
}

export function enemyAt(state: GameState, row = 1): EnemyState {
  const enemy = state.enemies.find((candidate) => candidate.row === row);
  if (!enemy) throw new Error(`Missing row ${row}`);
  return enemy;
}

export function isolateEnemy(state: GameState, row = 1): EnemyState {
  const target = enemyAt(state, row);
  for (const enemy of state.enemies) {
    if (enemy !== target) enemy.mode = EnemyMode.Dead;
  }
  return target;
}

export function aimShot(state: GameState, enemy: EnemyState): void {
  const bullet = state.playerBullets.find((candidate) => !candidate.active);
  if (!bullet) throw new Error('No free player bullet');
  Object.assign(bullet, { active: true, x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
}

export function enemyShot(state: GameState, x = state.player.x, y = state.player.y): void {
  const bullet = state.enemyBullets.find((candidate) => !candidate.active);
  if (!bullet) throw new Error('No free enemy bullet');
  Object.assign(bullet, { active: true, x, y, vx: 0, vy: 0 });
}
