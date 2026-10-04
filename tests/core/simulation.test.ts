import { describe, expect, it } from 'vite-plus/test';
import {
  CONFIG,
  Command,
  EnemyMode,
  GamePhase,
  ROW_SCORES,
  createGame,
  getDifficulty,
  step,
} from '../../src/core';
import { advance, aimShot, enemyAt, enemyShot, input, isolateEnemy, playing } from './helpers';

describe('state machine', () => {
  it('starts from title and enters screensaver after ten idle seconds', () => {
    const state = createGame(1982);
    expect(state.phase).toBe(GamePhase.Title);
    advance(state, CONFIG.screensaverTicks - 1);
    expect(state.phase).toBe(GamePhase.Title);
    step(state, input());
    expect(state.phase).toBe(GamePhase.Screensaver);
    step(state, input({ activity: true }));
    expect(state.phase).toBe(GamePhase.Title);
    step(state, input({ command: Command.Start }));
    expect(state.phase).toBe(GamePhase.Playing);
  });

  it.each([GamePhase.Playing, GamePhase.Respawning, GamePhase.WaveClear])(
    'pauses %s without advancing its timer or simulation',
    (phase) => {
      const state = playing();
      state.phase = phase;
      state.phaseTicks = 31;
      step(state, input({ command: Command.Pause }));
      expect(state.phase).toBe(GamePhase.Paused);
      const frozen = JSON.stringify({ ...state, tick: 0 });
      advance(state, 180, input({ move: 1, fire: true }));
      expect(JSON.stringify({ ...state, tick: 0 })).toBe(frozen);
      step(state, input({ command: Command.Continue }));
      expect(state.phase).toBe(phase);
      expect(state.phaseTicks).toBe(31);
    },
  );

  it('creates a separate pristine object for a new game', () => {
    const old = playing();
    old.score = 1234;
    old.lives = 1;
    const fresh = createGame(1982);
    expect(fresh).not.toBe(old);
    expect(fresh.player).not.toBe(old.player);
    expect(fresh.enemies).not.toBe(old.enemies);
    expect(fresh.score).toBe(0);
    expect(fresh.lives).toBe(CONFIG.startingLives);
  });
});

describe('bullets and collisions', () => {
  it('keeps straight shots in a fixed two-slot pool and reuses a hit slot', () => {
    const state = playing();
    const pool = state.playerBullets;
    const slots = [...pool];
    advance(state, CONFIG.playerFireInterval + 1, input({ move: 1, fire: true }));
    expect(pool.filter((bullet) => bullet.active)).toHaveLength(2);
    advance(state, CONFIG.playerFireInterval, input({ fire: true }));
    expect(pool.filter((bullet) => bullet.active)).toHaveLength(2);
    expect(pool.every((bullet) => bullet.vx === 0)).toBe(true);
    const enemy = enemyAt(state);
    const bullet = pool[0];
    if (!bullet) throw new Error('Missing bullet slot');
    Object.assign(bullet, { x: enemy.x, y: enemy.y, vy: 0 });
    step(state, input());
    expect(bullet.active).toBe(false);
    state.player.fireCooldown = 0;
    advance(state, CONFIG.hitStopTicks + 1, input({ fire: true }));
    expect(bullet.active).toBe(true);
    expect(state.playerBullets).toBe(pool);
    expect(pool).toEqual(slots);
  });

  it.each([EnemyMode.Formation, EnemyMode.Diving])('hits an enemy in %s', (mode) => {
    const state = playing();
    const target = enemyAt(state);
    target.mode = mode;
    target.fireCooldown = 10_000;
    aimShot(state, target);
    const events = step(state, input());
    expect(target.mode).toBe(EnemyMode.Dead);
    expect(events.some((event) => event.kind === 'kill' && event.enemyId === target.id)).toBe(true);
    expect(state.hitStopTicks).toBe(CONFIG.hitStopTicks);
  });

  it('cancels opposing bullets before either damages an enemy', () => {
    const state = playing();
    const target = enemyAt(state);
    aimShot(state, target);
    enemyShot(state, target.x, target.y);
    const events = step(state, input());
    expect(events.filter((event) => event.kind === 'cancel')).toHaveLength(1);
    expect(target.mode).toBe(EnemyMode.Formation);
    expect(state.playerBullets.some((bullet) => bullet.active)).toBe(false);
    expect(state.enemyBullets.some((bullet) => bullet.active)).toBe(false);
    expect(state.score).toBe(0);
  });

  it.each(['bullet', 'collision', 'fuel'])('spends one life for %s, then respawns', (cause) => {
    const state = playing();
    if (cause === 'bullet') {
      enemyShot(state);
      enemyShot(state);
    } else if (cause === 'collision') {
      const enemy = enemyAt(state);
      Object.assign(enemy, {
        mode: EnemyMode.Diving,
        x: state.player.x,
        y: state.player.y,
        fireCooldown: 10_000,
      });
    } else {
      state.fuel = CONFIG.fuelChunk;
      state.fuelTicks = CONFIG.fuelInterval - 1;
    }
    const events = step(state, input());
    expect(events.filter((event) => event.kind === 'hit')).toHaveLength(1);
    expect(state.lives).toBe(CONFIG.startingLives - 1);
    expect(state.phase).toBe(GamePhase.Respawning);
    advance(state, CONFIG.respawnTicks);
    expect(state.phase).toBe(GamePhase.Playing);
    expect(state.fuel).toBe(CONFIG.fuelCapacity);
    expect(state.player.invulnerableTicks).toBe(CONFIG.invulnerabilityTicks);
  });

  it('ends the game on the final life and does not spend further lives', () => {
    const state = playing();
    state.lives = 1;
    enemyShot(state);
    step(state, input());
    expect(state.phase).toBe(GamePhase.GameOver);
    expect(state.lives).toBe(0);
    advance(state, 120, input({ fire: true, command: Command.Continue }));
    expect(state.phase).toBe(GamePhase.GameOver);
    expect(state.lives).toBe(0);
  });

  it('uses the smaller core player hitbox', () => {
    const state = playing();
    enemyShot(state, state.player.x + CONFIG.playerHalfWidth + CONFIG.bulletHalfWidth + 0.1);
    step(state, input());
    expect(state.lives).toBe(CONFIG.startingLives);
    enemyShot(state, state.player.x + CONFIG.playerHalfWidth + CONFIG.bulletHalfWidth - 0.1);
    step(state, input());
    expect(state.lives).toBe(CONFIG.startingLives - 1);
  });
});

describe('score, fuel and progression', () => {
  it.each([0, 1, 2, 3, 4])('scores row %i and doubles diving kills', (row) => {
    for (const mode of [EnemyMode.Formation, EnemyMode.Diving]) {
      const state = playing();
      const target = enemyAt(state, row);
      target.mode = mode;
      target.fireCooldown = 10_000;
      aimShot(state, target);
      step(state, input());
      const base = ROW_SCORES[row];
      if (base === undefined) throw new Error('Missing row score');
      expect(state.score).toBe(
        mode === EnemyMode.Formation ? base : row === 0 ? CONFIG.flagshipDiveScore : base * 2,
      );
    }
  });

  it('adds an escort bonus for escorts destroyed in the diving flagship group', () => {
    const state = playing();
    const flagship = enemyAt(state, 0);
    const escorts = state.enemies.filter((enemy) => enemy.row === 1).slice(0, 2);
    for (const enemy of [flagship, ...escorts]) {
      enemy.mode = EnemyMode.Diving;
      enemy.diveGroup = 1;
      enemy.fireCooldown = 10_000;
    }
    for (const escort of escorts) {
      aimShot(state, escort);
      step(state, input());
      advance(state, CONFIG.hitStopTicks);
    }
    const before = state.score;
    aimShot(state, flagship);
    step(state, input());
    expect(state.score - before).toBe(CONFIG.flagshipDiveScore + CONFIG.escortBonus * 2);
  });

  it('grants the 5000-point bonus life once when crossing the threshold', () => {
    const state = playing();
    state.score = CONFIG.bonusLifeScore - 10;
    const first = enemyAt(state, 4);
    aimShot(state, first);
    const events = step(state, input());
    expect(state.lives).toBe(CONFIG.startingLives + 1);
    expect(state.bonusLifeAwarded).toBe(true);
    expect(events.filter((event) => event.kind === 'bonus')).toHaveLength(1);
    advance(state, CONFIG.hitStopTicks);
    const second = state.enemies.find((enemy) => enemy.row === 4 && enemy.mode !== EnemyMode.Dead);
    if (!second) throw new Error('Missing second target');
    aimShot(state, second);
    expect(step(state, input()).some((event) => event.kind === 'bonus')).toBe(false);
    expect(state.lives).toBe(CONFIG.startingLives + 1);
  });

  it('drains fuel in discrete chunks at the configured interval', () => {
    const state = playing();
    state.fuelTicks = 0;
    advance(state, CONFIG.fuelInterval - 1);
    expect(state.fuel).toBe(CONFIG.fuelCapacity);
    step(state, input());
    expect(state.fuel).toBe(CONFIG.fuelCapacity - CONFIG.fuelChunk);
    advance(state, CONFIG.fuelInterval);
    expect(state.fuel).toBe(CONFIG.fuelCapacity - CONFIG.fuelChunk * 2);
  });

  it('clears the final enemy, shows a banner, and refills fuel for a harder wave', () => {
    const state = playing();
    state.fuel = 40;
    const final = isolateEnemy(state);
    aimShot(state, final);
    step(state, input());
    expect(state.phase).toBe(GamePhase.WaveClear);
    advance(state, CONFIG.waveClearTicks);
    expect(state.phase).toBe(GamePhase.Playing);
    expect(state.wave).toBe(2);
    expect(state.fuel).toBe(CONFIG.fuelCapacity);
    expect(state.enemies.filter((enemy) => enemy.mode !== EnemyMode.Dead)).toHaveLength(36);
  });

  it('derives bounded increasing difficulty for arbitrary later waves', () => {
    const initial = getDifficulty(1);
    const later = getDifficulty(8);
    const endless = getDifficulty(1_000_000);
    expect(later.diveSpeed).toBeGreaterThan(initial.diveSpeed);
    expect(later.diveInterval).toBeLessThan(initial.diveInterval);
    expect(later.maxDivers).toBeGreaterThan(initial.maxDivers);
    expect(endless.maxDivers).toBeLessThanOrEqual(CONFIG.maximumDivers);
    expect(endless.diveInterval).toBeGreaterThanOrEqual(CONFIG.minimumDiveInterval);
    expect(endless.enemyFireInterval).toBeGreaterThanOrEqual(30);
    expect(Object.values(endless).every(Number.isFinite)).toBe(true);
  });
});

describe('enemy diving rules', () => {
  it('protects the player and prevents new dives for two seconds after respawn', () => {
    const state = playing();
    enemyShot(state);
    step(state, input());
    advance(state, CONFIG.respawnTicks);
    state.diveCooldown = 0;
    enemyShot(state);
    for (let tick = 0; tick < CONFIG.invulnerabilityTicks; tick += 1) {
      const events = step(state, input());
      expect(events.some((event) => event.kind === 'dive')).toBe(false);
      expect(state.lives).toBe(CONFIG.startingLives - 1);
    }
    expect(state.player.invulnerableTicks).toBe(0);
    step(state, input());
    expect(state.lives).toBe(CONFIG.startingLives - 2);
  });

  it('keeps all formation enemies synchronized and prevents formation shots', () => {
    const state = playing();
    const events = advance(state, 60);
    for (const enemy of state.enemies) {
      expect(enemy.x - enemy.homeX).toBeCloseTo(state.formationOffset);
      expect(enemy.y).toBe(enemy.homeY);
    }
    expect(events.some((event) => event.kind === 'shot' && event.owner === 'enemy')).toBe(false);
  });

  it('respects concurrency limits and only lets detached enemies fire', () => {
    const state = playing();
    state.diveCooldown = 0;
    const difficulty = getDifficulty(state.wave);
    const events = advance(state, 90, input({ debugInvulnerable: true }));
    expect(
      state.enemies.filter((enemy) => enemy.mode === EnemyMode.Diving).length,
    ).toBeLessThanOrEqual(difficulty.maxDivers);
    expect(events.some((event) => event.kind === 'dive')).toBe(true);
    expect(events.some((event) => event.kind === 'shot' && event.owner === 'enemy')).toBe(true);
  });

  it('shoots no faster than twice per second and steers at most once per second', () => {
    const state = playing();
    const diver = isolateEnemy(state);
    Object.assign(diver, {
      mode: EnemyMode.Diving,
      x: 160,
      y: 20,
      direction: 1,
      steerCooldown: 60,
      fireCooldown: 0,
    });
    const fireTicks: number[] = [];
    const switches: number[] = [];
    for (let tick = 0; tick < 150; tick += 1) {
      state.player.x = diver.direction === 1 ? 0 : CONFIG.width;
      const previousDirection = diver.direction;
      const events = step(state, input({ debugInvulnerable: true }));
      if (events.some((event) => event.kind === 'shot' && event.owner === 'enemy')) {
        fireTicks.push(tick);
      }
      if (diver.direction !== previousDirection) switches.push(tick);
      expect(diver.x).toBeGreaterThanOrEqual(CONFIG.enemyHalfWidth);
      expect(diver.x).toBeLessThanOrEqual(CONFIG.width - CONFIG.enemyHalfWidth);
    }
    expect(fireTicks.length).toBeGreaterThan(2);
    expect(switches.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < fireTicks.length; index += 1) {
      expect((fireTicks[index] ?? 0) - (fireTicks[index - 1] ?? 0)).toBeGreaterThanOrEqual(30);
    }
    for (let index = 1; index < switches.length; index += 1) {
      expect((switches[index] ?? 0) - (switches[index - 1] ?? 0)).toBeGreaterThanOrEqual(60);
    }
  });

  it.each([-1, 1])('clamps a diver steering outward at boundary %i', (direction) => {
    const state = playing();
    const diver = enemyAt(state);
    Object.assign(diver, {
      mode: EnemyMode.Diving,
      x: direction < 0 ? CONFIG.enemyHalfWidth : CONFIG.width - CONFIG.enemyHalfWidth,
      direction,
      steerCooldown: 60,
      fireCooldown: 10_000,
    });
    advance(state, 30, input({ debugInvulnerable: true }));
    expect(diver.x).toBeGreaterThanOrEqual(CONFIG.enemyHalfWidth);
    expect(diver.x).toBeLessThanOrEqual(CONFIG.width - CONFIG.enemyHalfWidth);
  });

  it('returns a diver below the screen to its original formation slot', () => {
    const state = playing();
    const diver = enemyAt(state);
    const original = { id: diver.id, row: diver.row, column: diver.column, homeX: diver.homeX };
    Object.assign(diver, {
      mode: EnemyMode.Diving,
      y: CONFIG.height + CONFIG.enemyHalfHeight + 10,
      x: 200,
      fireCooldown: 10_000,
    });
    step(state, input());
    expect(diver.mode).toBe(EnemyMode.Formation);
    expect(diver.id).toBe(original.id);
    expect(diver.row).toBe(original.row);
    expect(diver.column).toBe(original.column);
    expect(diver.x).toBeCloseTo(original.homeX + state.formationOffset);
    expect(diver.y).toBe(diver.homeY);
  });
});
