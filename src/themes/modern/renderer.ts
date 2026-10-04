import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { AdvancedBloomFilter, GlowFilter } from 'pixi-filters';
import { CONFIG } from '../../core/config';
import { getRendererPreference } from '../../render/backend';
import { HUD_LAYOUT } from '../../render/layout';
import { EnemyMode, GamePhase } from '../../core/types';
import type { DeepReadonly, GameState } from '../../core/types';
import { createVectorShip } from '../../render/modern-ships';
import type { ThemeRenderer } from '../types';
import { MODERN_EFFECTS, MODERN_SHIPS } from './design';
import { MODERN_ENEMY_COLORS, MODERN_PALETTE } from './palette';

interface Particle {
  sprite: Sprite;
  age: number;
  duration: number;
  vx: number;
  vy: number;
}

interface Ring {
  graphic: Graphics;
  age: number;
  duration: number;
}

interface Popup {
  text: Text;
  age: number;
}

interface Star {
  sprite: Sprite;
  phase: number;
  brightness: number;
}

export async function createModernRenderer(host: HTMLElement): Promise<ThemeRenderer> {
  const preference = getRendererPreference();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Space Attack neon playfield');
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  canvas.style.touchAction = 'none';
  const context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: false,
    stencil: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!context || !(context instanceof WebGL2RenderingContext)) {
    throw new Error('Space Attack requires a browser with WebGL 2 support.');
  }
  const app = new Application();
  await app.init({
    canvas,
    context,
    preference,
    preferWebGLVersion: 2,
    width: CONFIG.width,
    height: CONFIG.height,
    resolution: Math.max(1, window.devicePixelRatio),
    antialias: true,
    autoDensity: true,
    autoStart: false,
    sharedTicker: false,
    backgroundColor: MODERN_PALETTE.background,
    hello: false,
    eventMode: 'none',
    eventFeatures: { move: false, click: false, wheel: false, globalMove: false },
  });
  app.stop();
  host.appendChild(canvas);
  const scene = new Container();
  scene.eventMode = 'none';
  app.stage.addChild(scene);
  const background = new Container();
  const actors = new Container();
  const effects = new Container();
  const hud = new Container();
  const debug = new Graphics();
  scene.addChild(background, actors, effects, hud, debug);
  const bloom = new AdvancedBloomFilter({
    threshold: MODERN_EFFECTS.bloomThreshold,
    bloomScale: MODERN_EFFECTS.bloomStrength,
    brightness: 1,
    blur: 2,
    quality: 2,
  });
  const glow = new GlowFilter({
    distance: MODERN_EFFECTS.glowDistance,
    outerStrength: MODERN_EFFECTS.glowStrength,
    innerStrength: 0,
    color: MODERN_PALETTE.white,
    alpha: 0.18,
    quality: 0.15,
  });
  glow.resolution = 'inherit';
  bloom.resolution = 'inherit';
  actors.filters = [glow, bloom];
  const filterArea = new Rectangle(0, 0, CONFIG.width, CONFIG.height);
  actors.filterArea = filterArea;
  const sky = new Graphics();
  for (let band = 0; band < 24; band++) {
    sky
      .rect(0, band * 10, CONFIG.width, 10)
      .fill({ color: MODERN_PALETTE.violet, alpha: 0.014 + band * 0.0015 });
  }
  const grid = new Graphics();
  const horizon = 148;
  for (let line = -8; line <= 8; line++) {
    grid.moveTo(160 + line * 7, horizon).lineTo(160 + line * 38, 225);
  }
  for (const y of [148, 153, 162, 176, 196, 225]) grid.moveTo(0, y).lineTo(320, y);
  grid.stroke({ color: MODERN_PALETTE.grid, width: 0.5, alpha: MODERN_EFFECTS.gridAlpha });
  background.addChild(sky, grid);

  function sprite(parent: Container, width: number, height: number, color: number): Sprite {
    const item = new Sprite(Texture.WHITE);
    item.anchor.set(0.5);
    item.width = width;
    item.height = height;
    item.tint = color;
    item.eventMode = 'none';
    parent.addChild(item);
    return item;
  }

  let visualRng = 0x182ef31;
  function random(): number {
    visualRng = (Math.imul(visualRng, 1664525) + 1013904223) >>> 0;
    return visualRng / 4294967296;
  }
  const stars: Star[] = Array.from({ length: 82 }, () => {
    const item = sprite(
      background,
      0.5 + random() * 0.5,
      0.5 + random() * 0.5,
      MODERN_PALETTE.white,
    );
    item.position.set(random() * CONFIG.width, 30 + random() * 192);
    return { sprite: item, phase: random() * Math.PI * 2, brightness: 0.15 + random() * 0.35 };
  });
  const textItems: Text[] = [];
  function label(value: string, x: number, y: number, color: number, size = 7): Text {
    const item = new Text({
      text: value,
      style: { fontFamily: 'monospace', fontSize: size, fill: color, letterSpacing: 0.8 },
    });
    item.position.set(x, y);
    item.eventMode = 'none';
    textItems.push(item);
    hud.addChild(item);
    return item;
  }
  label('SCORE', HUD_LAYOUT.score.x, HUD_LAYOUT.score.labelY, MODERN_PALETTE.muted, 6);
  const score = label(
    '000000',
    HUD_LAYOUT.score.x,
    HUD_LAYOUT.score.valueY,
    MODERN_PALETTE.white,
    8,
  );
  const waveCaption = label(
    'WAVE',
    HUD_LAYOUT.wave.centerX,
    HUD_LAYOUT.wave.labelY,
    MODERN_PALETTE.muted,
    6,
  );
  waveCaption.anchor.set(0.5, 0);
  const wave = label('01', HUD_LAYOUT.wave.centerX, HUD_LAYOUT.wave.valueY, MODERN_PALETTE.cyan, 8);
  wave.anchor.set(0.5, 0);
  label('FUEL', HUD_LAYOUT.fuel.labelX, HUD_LAYOUT.fuel.labelY, MODERN_PALETTE.muted, 6);
  label('LIVES', HUD_LAYOUT.lives.labelX, HUD_LAYOUT.lives.labelY, MODERN_PALETTE.muted, 6);
  const fuelTrack = new Graphics();
  fuelTrack
    .roundRect(
      HUD_LAYOUT.fuel.x,
      HUD_LAYOUT.fuel.y,
      HUD_LAYOUT.fuel.width,
      HUD_LAYOUT.fuel.height,
      2,
    )
    .fill(MODERN_PALETTE.panel)
    .stroke({ color: MODERN_PALETTE.border, width: 0.4 });
  fuelTrack.moveTo(8, 225).lineTo(312, 225).stroke({ color: MODERN_PALETTE.border, width: 0.4 });
  hud.addChild(fuelTrack);
  const fuel = sprite(hud, HUD_LAYOUT.fuel.width, HUD_LAYOUT.fuel.height, MODERN_PALETTE.mint);
  fuel.anchor.set(0);
  fuel.position.set(HUD_LAYOUT.fuel.x, HUD_LAYOUT.fuel.y);
  const lives = Array.from({ length: 4 }, (_, index) => {
    const ship = createVectorShip(MODERN_SHIPS.player, MODERN_PALETTE.cyan);
    ship.position.set(
      HUD_LAYOUT.lives.firstX + index * HUD_LAYOUT.lives.spacing,
      HUD_LAYOUT.lives.y,
    );
    ship.scale.set(0.48);
    hud.addChild(ship);
    return ship;
  });
  const banner = label('', 160, 152, MODERN_PALETTE.amber, 10);
  banner.anchor.set(0.5);
  const player = createVectorShip(MODERN_SHIPS.player, MODERN_PALETTE.cyan);
  actors.addChild(player);
  const designs = [
    MODERN_SHIPS.flagship,
    MODERN_SHIPS.scout,
    MODERN_SHIPS.striker,
    MODERN_SHIPS.drone,
    MODERN_SHIPS.manta,
    MODERN_SHIPS.raider,
  ];
  const colors = [
    MODERN_ENEMY_COLORS.flagship,
    MODERN_ENEMY_COLORS.scout,
    MODERN_ENEMY_COLORS.striker,
    MODERN_ENEMY_COLORS.drone,
    MODERN_ENEMY_COLORS.manta,
    MODERN_ENEMY_COLORS.raider,
  ];
  const catalogue = designs.map((design, row) =>
    createVectorShip(design, colors[row] ?? MODERN_PALETTE.cyan),
  );
  const enemies = Array.from({ length: CONFIG.rows * CONFIG.columns }, () => {
    const ship = new Graphics({ context: catalogue[0]?.context });
    ship.eventMode = 'none';
    actors.addChild(ship);
    return ship;
  });
  const playerBullets = Array.from({ length: CONFIG.playerBulletCount }, () =>
    sprite(actors, 1.3, 5, MODERN_PALETTE.cyan),
  );
  const enemyBullets = Array.from({ length: CONFIG.enemyBulletCount }, () =>
    sprite(actors, 1.6, 4, MODERN_PALETTE.magenta),
  );
  const particles: Particle[] = Array.from({ length: 128 }, () => {
    const item = sprite(effects, 0.9, 0.9, MODERN_PALETTE.white);
    item.visible = false;
    return { sprite: item, age: 0, duration: 0, vx: 0, vy: 0 };
  });
  const rings: Ring[] = Array.from({ length: 20 }, () => {
    const graphic = new Graphics()
      .circle(0, 0, 4)
      .stroke({ color: MODERN_PALETTE.white, width: 0.7 });
    graphic.visible = false;
    effects.addChild(graphic);
    return { graphic, age: 0, duration: 0 };
  });
  const popups: Popup[] = Array.from({ length: 16 }, () => {
    const text = label('', 0, 0, MODERN_PALETTE.amber, 8);
    text.anchor.set(0.5);
    text.visible = false;
    return { text, age: 0 };
  });
  const flash = sprite(scene, CONFIG.width, CONFIG.height, MODERN_PALETTE.magenta);
  flash.position.set(CONFIG.width / 2, CONFIG.height / 2);
  flash.visible = false;
  let lastState: DeepReadonly<GameState> | undefined;
  let lastTick = 0;
  let lastScore = -1;
  let lastWave = -1;
  let shakeTicks = 0;
  let flashTicks = 0;

  function burst(x: number, y: number, death: boolean, reducedMotion: boolean): void {
    const ring = rings.find((item) => !item.graphic.visible) ?? rings[0];
    if (ring) {
      ring.graphic.position.set(x, y);
      ring.graphic.scale.set(0.5);
      ring.graphic.visible = true;
      ring.graphic.alpha = reducedMotion ? 0.4 : 0.75;
      ring.graphic.tint = death ? MODERN_PALETTE.magenta : MODERN_PALETTE.cyan;
      ring.age = 0;
      ring.duration = death ? 26 : MODERN_EFFECTS.explosionTicks;
    }
    const count = reducedMotion ? 3 : death ? 22 : 10;
    let spawned = 0;
    for (const particle of particles) {
      if (particle.sprite.visible) continue;
      const angle = random() * Math.PI * 2;
      const speed = 0.25 + random() * (death ? 2 : 1.2);
      particle.sprite.position.set(x, y);
      particle.sprite.tint =
        spawned % 2 ? MODERN_PALETTE.white : death ? MODERN_PALETTE.magenta : MODERN_PALETTE.cyan;
      particle.sprite.alpha = 1;
      particle.sprite.visible = true;
      particle.age = 0;
      particle.duration = 16 + random() * 18;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      if (++spawned >= count) break;
    }
  }

  function clearEffects(): void {
    for (const particle of particles) particle.sprite.visible = false;
    for (const ring of rings) ring.graphic.visible = false;
    for (const popup of popups) popup.text.visible = false;
    shakeTicks = 0;
    flashTicks = 0;
  }

  const renderer: ThemeRenderer = {
    id: 'modern',
    render(state, events, _alpha, options) {
      if (state !== lastState || state.tick < lastTick) clearEffects();
      const elapsed =
        state.phase === GamePhase.Paused || state.hitStopTicks > 0 || state !== lastState
          ? 0
          : Math.min(6, Math.max(0, state.tick - lastTick));
      lastState = state;
      lastTick = state.tick;
      scene.alpha = options.dimmed ? 0.38 : 1;
      for (const star of stars)
        star.sprite.alpha =
          star.brightness +
          (options.reducedMotion ? 0 : Math.sin(state.tick * 0.018 + star.phase) * 0.1);
      player.position.set(state.player.x, state.player.y);
      player.rotation = options.reducedMotion
        ? 0
        : state.player.direction * MODERN_EFFECTS.playerLeanRadians;
      player.visible = state.phase !== GamePhase.Respawning && state.phase !== GamePhase.GameOver;
      player.alpha =
        state.player.invulnerableTicks > 0
          ? options.reducedMotion
            ? 0.6
            : Math.floor(state.tick / 6) % 2
              ? 0.3
              : 1
          : 1;
      for (let index = 0; index < enemies.length; index++) {
        const ship = enemies[index];
        const enemy = state.enemies[index];
        if (!ship) continue;
        ship.visible = enemy !== undefined && enemy.mode !== EnemyMode.Dead;
        if (!enemy || !ship.visible) continue;
        const art = catalogue[enemy.row];
        if (art) ship.context = art.context;
        ship.position.set(enemy.x, enemy.y);
        ship.rotation = options.reducedMotion
          ? 0
          : enemy.mode === EnemyMode.Diving
            ? enemy.direction * 0.08
            : Math.sin(state.tick * 0.025 + enemy.column * 0.4) * 0.025;
        ship.alpha = enemy.mode === EnemyMode.Diving ? 1 : 0.92;
      }
      for (let index = 0; index < playerBullets.length; index++) {
        const item = playerBullets[index];
        const bullet = state.playerBullets[index];
        if (!item) continue;
        item.visible = bullet?.active ?? false;
        if (bullet?.active) item.position.set(bullet.x, bullet.y);
      }
      for (let index = 0; index < enemyBullets.length; index++) {
        const item = enemyBullets[index];
        const bullet = state.enemyBullets[index];
        if (!item) continue;
        item.visible = bullet?.active ?? false;
        if (bullet?.active) item.position.set(bullet.x, bullet.y);
      }
      for (const event of events) {
        if (event.kind === 'kill') {
          burst(event.x, event.y, false, options.reducedMotion);
          if (event.diving) {
            const popup = popups.find((item) => !item.text.visible);
            if (popup) {
              popup.text.text = `+${event.points}`;
              popup.text.position.set(event.x, event.y - 10);
              popup.text.visible = true;
              popup.text.alpha = 1;
              popup.age = 0;
            }
          }
        } else if (event.kind === 'hit') {
          burst(event.x, event.y, true, options.reducedMotion);
          shakeTicks = options.reducedMotion ? 0 : MODERN_EFFECTS.deathShakeTicks;
          flashTicks = options.reducedMotion ? 1 : 5;
        } else if (event.kind === 'cancel') burst(event.x, event.y, false, options.reducedMotion);
      }
      for (const particle of particles) {
        if (!particle.sprite.visible) continue;
        particle.age += elapsed;
        particle.sprite.visible = particle.age < particle.duration;
        particle.sprite.x += particle.vx * elapsed;
        particle.sprite.y += particle.vy * elapsed;
        particle.sprite.alpha = Math.max(0, 1 - particle.age / particle.duration);
      }
      for (const ring of rings) {
        if (!ring.graphic.visible) continue;
        ring.age += elapsed;
        ring.graphic.visible = ring.age < ring.duration;
        ring.graphic.scale.set(0.5 + ring.age * 0.1);
        ring.graphic.alpha =
          (options.reducedMotion ? 0.3 : 0.7) * Math.max(0, 1 - ring.age / ring.duration);
      }
      for (const popup of popups) {
        if (!popup.text.visible) continue;
        popup.age += elapsed;
        popup.text.y -= elapsed * 0.25;
        popup.text.visible = popup.age < 45;
        popup.text.alpha = Math.min(1, Math.max(0, (45 - popup.age) / 15));
      }
      shakeTicks = Math.max(0, shakeTicks - elapsed);
      flashTicks = Math.max(0, flashTicks - elapsed);
      actors.position.set(
        !options.reducedMotion && shakeTicks > 0
          ? Math.sin(state.tick * 2.7) * MODERN_EFFECTS.deathShakePixels
          : 0,
        !options.reducedMotion && shakeTicks > 0 ? Math.cos(state.tick * 3.4) : 0,
      );
      flash.visible = flashTicks > 0;
      flash.alpha = options.reducedMotion ? 0.015 : flashTicks * 0.015;
      if (lastScore !== state.score) {
        score.text = String(state.score).padStart(6, '0');
        lastScore = state.score;
      }
      if (lastWave !== state.wave) {
        wave.text = String(state.wave).padStart(2, '0');
        lastWave = state.wave;
      }
      fuel.width =
        Math.max(0, Math.min(1, state.fuel / CONFIG.fuelCapacity)) * HUD_LAYOUT.fuel.width;
      fuel.tint = state.fuel <= 25 ? MODERN_PALETTE.magenta : MODERN_PALETTE.mint;
      for (let index = 0; index < lives.length; index++) {
        const ship = lives[index];
        if (ship) ship.visible = index < state.lives;
      }
      banner.visible = state.phase === GamePhase.WaveClear || state.phase === GamePhase.Respawning;
      if (banner.visible)
        banner.text = state.phase === GamePhase.WaveClear ? 'WAVE CLEAR' : 'READY';
      debug.visible = options.debugHitboxes;
      if (options.debugHitboxes) {
        debug.clear();
        if (player.visible)
          debug
            .rect(
              state.player.x - CONFIG.playerHalfWidth,
              state.player.y - CONFIG.playerHalfHeight,
              CONFIG.playerHalfWidth * 2,
              CONFIG.playerHalfHeight * 2,
            )
            .stroke({ color: MODERN_PALETTE.mint, width: 0.5 });
        for (const enemy of state.enemies)
          if (enemy.mode !== EnemyMode.Dead)
            debug
              .rect(
                enemy.x - CONFIG.enemyHalfWidth,
                enemy.y - CONFIG.enemyHalfHeight,
                CONFIG.enemyHalfWidth * 2,
                CONFIG.enemyHalfHeight * 2,
              )
              .stroke({ color: MODERN_PALETTE.magenta, width: 0.5 });
        for (const bullet of state.playerBullets)
          if (bullet.active)
            debug
              .rect(
                bullet.x - CONFIG.bulletHalfWidth,
                bullet.y - CONFIG.bulletHalfHeight,
                CONFIG.bulletHalfWidth * 2,
                CONFIG.bulletHalfHeight * 2,
              )
              .stroke({ color: MODERN_PALETTE.cyan, width: 0.5 });
        for (const bullet of state.enemyBullets)
          if (bullet.active)
            debug
              .rect(
                bullet.x - CONFIG.bulletHalfWidth,
                bullet.y - CONFIG.bulletHalfHeight,
                CONFIG.bulletHalfWidth * 2,
                CONFIG.bulletHalfHeight * 2,
              )
              .stroke({ color: MODERN_PALETTE.amber, width: 0.5 });
      }
      app.render();
    },
    resize(width, height, pixelRatio) {
      const scale = Math.max(0.1, Math.min(width / CONFIG.width, height / CONFIG.height));
      const cssWidth = CONFIG.width * scale;
      const cssHeight = CONFIG.height * scale;
      const ratio = Number.isFinite(pixelRatio) ? Math.max(1, pixelRatio) : 1;
      app.renderer.resize(cssWidth, cssHeight, ratio);
      scene.scale.set(cssWidth / CONFIG.width, cssHeight / CONFIG.height);
      filterArea.width = cssWidth;
      filterArea.height = cssHeight;
      glow.distance = MODERN_EFFECTS.glowDistance * scale;
      bloom.blur = Math.max(1, 1.4 * scale);
      for (const text of textItems) text.resolution = Math.max(1, ratio * scale);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.dataset.logicalWidth = String(CONFIG.width);
      canvas.dataset.logicalHeight = String(CONFIG.height);
      canvas.dataset.scale = String(scale);
      canvas.dataset.theme = 'modern';
    },
    destroy() {
      app.destroy({ removeView: true }, { children: true });
      for (const art of catalogue) art.destroy();
      glow.destroy();
      bloom.destroy();
    },
  };
  const bounds = host.getBoundingClientRect();
  renderer.resize(
    bounds.width || CONFIG.width,
    bounds.height || CONFIG.height,
    window.devicePixelRatio,
  );
  return renderer;
}
