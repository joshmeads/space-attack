import { overlaps } from "./collision";
import { CONFIG, ROW_SCORES, TRANSITIONS } from "./config";
import { getDifficulty } from "./difficulty";
import { createFormation } from "./formation";
import { nextRandom } from "./random";
import {
  Command,
  EnemyKind,
  EnemyMode,
  GamePhase,
  type BulletState,
  type Difficulty,
  type Direction,
  type EnemyState,
  type GameEvent,
  type GameState,
  type InputFrame,
} from "./types";

const eventBuffers = new WeakMap<GameState, GameEvent[]>();

function createBullet(): BulletState {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0 };
}

export function createGame(seed: number): GameState {
  const normalizedSeed = seed >>> 0;
  const state: GameState = {
    version: 1,
    seed: normalizedSeed,
    rng: normalizedSeed || 0x6d2b79f5,
    tick: 0,
    phase: GamePhase.Title,
    resumePhase: GamePhase.Playing,
    phaseTicks: 0,
    wave: 1,
    score: 0,
    lives: CONFIG.startingLives,
    bonusLifeAwarded: false,
    fuel: CONFIG.fuelCapacity,
    fuelTicks: 0,
    hitStopTicks: 0,
    player: {
      x: CONFIG.width / 2,
      y: CONFIG.playerY,
      direction: 0,
      fireCooldown: 0,
      invulnerableTicks: 0,
    },
    formationOffset: 0,
    formationDirection: 1,
    diveCooldown: getDifficulty(1).diveInterval,
    nextDiveGroup: 1,
    enemies: createFormation(),
    playerBullets: Array.from({ length: CONFIG.playerBulletCount }, createBullet),
    enemyBullets: Array.from({ length: CONFIG.enemyBulletCount }, createBullet),
  };
  eventBuffers.set(state, []);
  return state;
}

function transition(state: GameState, next: GamePhase, events: GameEvent[]): void {
  if (!TRANSITIONS[state.phase].includes(next)) return;
  const from = state.phase;
  if (next === GamePhase.Paused) {
    if (
      from === GamePhase.Playing ||
      from === GamePhase.Respawning ||
      from === GamePhase.WaveClear
    ) {
      state.resumePhase = from;
    }
  } else if (from !== GamePhase.Paused) {
    state.phaseTicks = 0;
  }
  state.phase = next;
  events.push({ kind: "phase", from, to: next });
}

function refillFuel(state: GameState): void {
  state.fuel = CONFIG.fuelCapacity;
  state.fuelTicks = 0;
}

function clearBullets(state: GameState): void {
  for (const bullet of state.playerBullets) bullet.active = false;
  for (const bullet of state.enemyBullets) bullet.active = false;
}

function returnToFormation(state: GameState, enemy: EnemyState): void {
  enemy.mode = EnemyMode.Formation;
  enemy.x = enemy.homeX + state.formationOffset;
  enemy.y = enemy.homeY;
  enemy.direction = 0;
  enemy.steerCooldown = 0;
  enemy.fireCooldown = 0;
  enemy.diveGroup = 0;
}

function resetPlayer(state: GameState): void {
  state.player.x = CONFIG.width / 2;
  state.player.y = CONFIG.playerY;
  state.player.direction = 0;
  state.player.fireCooldown = 0;
  state.player.invulnerableTicks = CONFIG.invulnerabilityTicks;
  refillFuel(state);
}

function beginNextWave(state: GameState, events: GameEvent[]): void {
  state.wave += 1;
  state.enemies = createFormation();
  state.formationOffset = 0;
  state.formationDirection = 1;
  state.diveCooldown = getDifficulty(state.wave).diveInterval;
  state.nextDiveGroup = 1;
  state.hitStopTicks = 0;
  clearBullets(state);
  refillFuel(state);
  transition(state, GamePhase.Playing, events);
  events.push({ kind: "wave", wave: state.wave });
}

function damagePlayer(
  state: GameState,
  cause: "bullet" | "collision" | "fuel",
  events: GameEvent[],
): void {
  state.lives -= 1;
  events.push({
    kind: "hit",
    cause,
    x: state.player.x,
    y: state.player.y,
    lives: state.lives,
  });
  clearBullets(state);
  for (const enemy of state.enemies) {
    if (enemy.mode === EnemyMode.Diving) returnToFormation(state, enemy);
  }
  state.hitStopTicks = 0;
  state.player.direction = 0;
  transition(state, state.lives > 0 ? GamePhase.Respawning : GamePhase.GameOver, events);
  if (state.lives > 0) refillFuel(state);
}

function fireBullet(
  bullets: BulletState[],
  owner: "player" | "enemy",
  x: number,
  y: number,
  speed: number,
  events: GameEvent[],
): boolean {
  for (const bullet of bullets) {
    if (bullet.active) continue;
    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = 0;
    bullet.vy = speed;
    events.push({ kind: "shot", owner, x, y });
    return true;
  }
  return false;
}

function moveBullets(bullets: BulletState[]): void {
  for (const bullet of bullets) {
    if (!bullet.active) continue;
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    if (bullet.y < -CONFIG.bulletHalfHeight || bullet.y > CONFIG.height + CONFIG.bulletHalfHeight) {
      bullet.active = false;
    }
  }
}

function launchDive(state: GameState, enemy: EnemyState, group: number, events: GameEvent[]): void {
  enemy.mode = EnemyMode.Diving;
  enemy.diveGroup = group;
  enemy.direction = state.player.x < enemy.x ? -1 : 1;
  enemy.steerCooldown = CONFIG.steeringInterval;
  enemy.fireCooldown = getDifficulty(state.wave).enemyFireInterval;
  events.push({ kind: "dive", enemyId: enemy.id, x: enemy.x, y: enemy.y });
}

function scheduleDive(state: GameState, difficulty: Difficulty, events: GameEvent[]): void {
  if (state.player.invulnerableTicks > 0) return;
  state.diveCooldown = Math.max(0, state.diveCooldown - 1);
  if (state.diveCooldown > 0) return;
  let diving = 0;
  let available = 0;
  for (const enemy of state.enemies) {
    if (enemy.mode === EnemyMode.Diving) diving += 1;
    else if (enemy.mode === EnemyMode.Formation) available += 1;
  }
  if (diving >= difficulty.maxDivers || available === 0) return;
  let choice = Math.floor(nextRandom(state) * available);
  let selected: EnemyState | undefined;
  for (const enemy of state.enemies) {
    if (enemy.mode !== EnemyMode.Formation) continue;
    if (choice === 0) {
      selected = enemy;
      break;
    }
    choice -= 1;
  }
  if (!selected) return;
  const group = state.nextDiveGroup;
  state.nextDiveGroup += 1;
  launchDive(state, selected, group, events);
  diving += 1;
  if (selected.kind === EnemyKind.Flagship) {
    for (let escort = 0; escort < 2 && diving < difficulty.maxDivers; escort += 1) {
      let nearest: EnemyState | undefined;
      let distance = Infinity;
      for (const enemy of state.enemies) {
        if (enemy.mode !== EnemyMode.Formation || enemy.kind === EnemyKind.Flagship) continue;
        const nextDistance = Math.abs(enemy.column - selected.column) * 10 + enemy.row;
        if (nextDistance < distance) {
          nearest = enemy;
          distance = nextDistance;
        }
      }
      if (!nearest) break;
      launchDive(state, nearest, group, events);
      diving += 1;
    }
  }
  state.diveCooldown = difficulty.diveInterval;
}

function moveEnemies(state: GameState, difficulty: Difficulty, events: GameEvent[]): void {
  state.formationOffset += difficulty.formationSpeed * state.formationDirection;
  if (state.formationOffset >= CONFIG.formationLimit) {
    state.formationOffset = CONFIG.formationLimit;
    state.formationDirection = -1;
  } else if (state.formationOffset <= -CONFIG.formationLimit) {
    state.formationOffset = -CONFIG.formationLimit;
    state.formationDirection = 1;
  }
  for (const enemy of state.enemies) {
    if (enemy.mode === EnemyMode.Dead) continue;
    if (enemy.mode === EnemyMode.Formation) {
      enemy.x = enemy.homeX + state.formationOffset;
      enemy.y = enemy.homeY;
      continue;
    }
    enemy.steerCooldown -= 1;
    if (enemy.steerCooldown <= 0) {
      const target = state.player.x + (nextRandom(state) - 0.5) * 32;
      const direction: Direction = target < enemy.x ? -1 : 1;
      enemy.direction = direction;
      enemy.steerCooldown = CONFIG.steeringInterval;
    }
    enemy.x = Math.max(
      CONFIG.enemyHalfWidth,
      Math.min(
        CONFIG.width - CONFIG.enemyHalfWidth,
        enemy.x + enemy.direction * difficulty.diveHorizontalSpeed,
      ),
    );
    enemy.y += difficulty.diveSpeed;
    if (enemy.y > CONFIG.height + CONFIG.enemyHalfHeight) {
      returnToFormation(state, enemy);
      continue;
    }
    enemy.fireCooldown -= 1;
    if (enemy.fireCooldown <= 0) {
      fireBullet(
        state.enemyBullets,
        "enemy",
        enemy.x,
        enemy.y + CONFIG.enemyHalfHeight + CONFIG.bulletHalfHeight,
        difficulty.enemyBulletSpeed,
        events,
      );
      enemy.fireCooldown = difficulty.enemyFireInterval;
    }
  }
}

function killEnemy(state: GameState, enemy: EnemyState, events: GameEvent[]): void {
  const diving = enemy.mode === EnemyMode.Diving;
  let points = ROW_SCORES[enemy.row] ?? 20;
  if (diving) {
    if (enemy.kind === EnemyKind.Flagship) {
      points = CONFIG.flagshipDiveScore;
      for (const escort of state.enemies) {
        if (
          escort.mode === EnemyMode.Dead &&
          escort.kind !== EnemyKind.Flagship &&
          escort.diveGroup === enemy.diveGroup
        ) {
          points += CONFIG.escortBonus;
        }
      }
    } else {
      points *= 2;
    }
  }
  enemy.mode = EnemyMode.Dead;
  state.score += points;
  state.hitStopTicks = CONFIG.hitStopTicks;
  events.push({
    kind: "kill",
    enemyId: enemy.id,
    enemyKind: enemy.kind,
    diving,
    x: enemy.x,
    y: enemy.y,
    points,
  });
  if (!state.bonusLifeAwarded && state.score >= CONFIG.bonusLifeScore) {
    state.bonusLifeAwarded = true;
    state.lives += 1;
    events.push({ kind: "bonus", lives: state.lives, score: state.score });
  }
}

function collidePlayerBullets(state: GameState, events: GameEvent[]): void {
  for (const bullet of state.playerBullets) {
    if (!bullet.active) continue;
    for (const opposing of state.enemyBullets) {
      if (
        opposing.active &&
        overlaps(
          bullet.x,
          bullet.y,
          CONFIG.bulletHalfWidth,
          CONFIG.bulletHalfHeight,
          opposing.x,
          opposing.y,
          CONFIG.bulletHalfWidth,
          CONFIG.bulletHalfHeight,
        )
      ) {
        bullet.active = false;
        opposing.active = false;
        events.push({ kind: "cancel", x: bullet.x, y: bullet.y });
        break;
      }
    }
    if (!bullet.active) continue;
    for (const enemy of state.enemies) {
      if (
        enemy.mode !== EnemyMode.Dead &&
        overlaps(
          bullet.x,
          bullet.y,
          CONFIG.bulletHalfWidth,
          CONFIG.bulletHalfHeight,
          enemy.x,
          enemy.y,
          CONFIG.enemyHalfWidth,
          CONFIG.enemyHalfHeight,
        )
      ) {
        bullet.active = false;
        killEnemy(state, enemy, events);
        break;
      }
    }
  }
}

function collidePlayer(state: GameState, input: InputFrame, events: GameEvent[]): void {
  if (state.player.invulnerableTicks > 0 || input.debugInvulnerable) return;
  for (const bullet of state.enemyBullets) {
    if (
      bullet.active &&
      overlaps(
        state.player.x,
        state.player.y,
        CONFIG.playerHalfWidth,
        CONFIG.playerHalfHeight,
        bullet.x,
        bullet.y,
        CONFIG.bulletHalfWidth,
        CONFIG.bulletHalfHeight,
      )
    ) {
      damagePlayer(state, "bullet", events);
      return;
    }
  }
  for (const enemy of state.enemies) {
    if (
      enemy.mode === EnemyMode.Diving &&
      overlaps(
        state.player.x,
        state.player.y,
        CONFIG.playerHalfWidth,
        CONFIG.playerHalfHeight,
        enemy.x,
        enemy.y,
        CONFIG.enemyHalfWidth,
        CONFIG.enemyHalfHeight,
      )
    ) {
      damagePlayer(state, "collision", events);
      return;
    }
  }
}

function finishWave(state: GameState, events: GameEvent[]): void {
  clearBullets(state);
  state.player.direction = 0;
  state.hitStopTicks = 0;
  transition(state, GamePhase.WaveClear, events);
}

function playTick(state: GameState, input: InputFrame, events: GameEvent[]): void {
  if (input.debugSkipWave) {
    for (const enemy of state.enemies) enemy.mode = EnemyMode.Dead;
    finishWave(state, events);
    return;
  }
  if (state.hitStopTicks > 0) {
    state.hitStopTicks -= 1;
    return;
  }
  const difficulty = getDifficulty(state.wave);
  state.player.direction = input.move;
  state.player.x = Math.max(
    CONFIG.playerHalfWidth,
    Math.min(
      CONFIG.width - CONFIG.playerHalfWidth,
      state.player.x + input.move * CONFIG.playerSpeed,
    ),
  );
  if (state.player.fireCooldown > 0) state.player.fireCooldown -= 1;
  if (input.fire && state.player.fireCooldown === 0) {
    if (
      fireBullet(
        state.playerBullets,
        "player",
        state.player.x,
        state.player.y - CONFIG.playerHalfHeight - CONFIG.bulletHalfHeight,
        -CONFIG.playerBulletSpeed,
        events,
      )
    ) {
      state.player.fireCooldown = CONFIG.playerFireInterval;
    }
  }
  scheduleDive(state, difficulty, events);
  moveEnemies(state, difficulty, events);
  moveBullets(state.playerBullets);
  moveBullets(state.enemyBullets);
  collidePlayerBullets(state, events);
  collidePlayer(state, input, events);
  if (state.phase !== GamePhase.Playing) return;
  if (state.player.invulnerableTicks > 0) state.player.invulnerableTicks -= 1;
  if (state.enemies.every((enemy) => enemy.mode === EnemyMode.Dead)) {
    finishWave(state, events);
    return;
  }
  state.fuelTicks += 1;
  if (state.fuelTicks >= CONFIG.fuelInterval) {
    state.fuelTicks -= CONFIG.fuelInterval;
    state.fuel = Math.max(0, state.fuel - CONFIG.fuelChunk);
    if (state.fuel === 0 && !input.debugInvulnerable) damagePlayer(state, "fuel", events);
  }
}

export function step(state: GameState, input: InputFrame): readonly GameEvent[] {
  let events = eventBuffers.get(state);
  if (!events) {
    events = [];
    eventBuffers.set(state, events);
  }
  events.length = 0;
  if (state.phase === GamePhase.Paused) {
    if (input.command === Command.Continue || input.command === Command.Pause) {
      transition(state, state.resumePhase, events);
    }
    return events;
  }
  if (
    input.command === Command.Pause &&
    (state.phase === GamePhase.Playing ||
      state.phase === GamePhase.Respawning ||
      state.phase === GamePhase.WaveClear)
  ) {
    transition(state, GamePhase.Paused, events);
    return events;
  }
  state.tick += 1;
  switch (state.phase) {
    case GamePhase.Title:
    case GamePhase.Screensaver:
      if (input.command === Command.Start) {
        transition(state, GamePhase.Playing, events);
        events.push({ kind: "wave", wave: state.wave });
      } else if (input.activity || input.move !== 0 || input.fire) {
        state.phaseTicks = 0;
        if (state.phase === GamePhase.Screensaver) transition(state, GamePhase.Title, events);
      } else if (state.phase === GamePhase.Title) {
        state.phaseTicks += 1;
        if (state.phaseTicks >= CONFIG.screensaverTicks) {
          transition(state, GamePhase.Screensaver, events);
        }
      }
      break;
    case GamePhase.Playing:
      playTick(state, input, events);
      break;
    case GamePhase.Respawning:
      state.phaseTicks += 1;
      if (state.phaseTicks >= CONFIG.respawnTicks) {
        resetPlayer(state);
        transition(state, GamePhase.Playing, events);
      }
      break;
    case GamePhase.WaveClear:
      state.phaseTicks += 1;
      if (state.phaseTicks >= CONFIG.waveClearTicks) beginNextWave(state, events);
      break;
    case GamePhase.GameOver:
      break;
    default: {
      const exhaustive: never = state.phase;
      return exhaustive;
    }
  }
  return events;
}
