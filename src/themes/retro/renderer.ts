import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { CONFIG } from '../../core/config';
import { getRendererPreference } from '../../render/backend';
import { HUD_LAYOUT } from '../../render/layout';
import { EnemyKind, EnemyMode, GamePhase } from '../../core/types';
import type { DeepReadonly, GameState } from '../../core/types';
import { createPixelFrames, createPixelTexture, PixelText } from '../../render/pixels';
import type { ThemeRenderer } from '../types';
import { RETRO_SPRITES } from './art';
import { FONT_WIDTH, PIXEL_FONT } from './font';
import { RETRO_ENEMY_PALETTES, RETRO_PALETTE, SPRITE_PALETTE } from './palette';

interface Explosion {
  sprite: Sprite;
  age: number;
  duration: number;
}

interface Particle {
  sprite: Sprite;
  age: number;
  duration: number;
  vx: number;
  vy: number;
}

interface Popup {
  text: PixelText;
  age: number;
}

interface Star {
  sprite: Sprite;
  phase: number;
  brightness: number;
}

function makeSprite(parent: Container, texture = Texture.EMPTY): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.roundPixels = true;
  sprite.eventMode = 'none';
  parent.addChild(sprite);
  return sprite;
}

export async function createRetroRenderer(host: HTMLElement): Promise<ThemeRenderer> {
  const preference = getRendererPreference();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Space Attack arcade playfield');
  canvas.style.imageRendering = 'pixelated';
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  canvas.style.touchAction = 'none';
  const context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
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
    resolution: 1,
    antialias: false,
    autoDensity: false,
    autoStart: false,
    sharedTicker: false,
    backgroundColor: RETRO_PALETTE.background,
    roundPixels: true,
    hello: false,
    eventMode: 'none',
    eventFeatures: { move: false, click: false, wheel: false, globalMove: false },
  });
  app.stop();
  host.appendChild(canvas);
  const scene = new Container();
  scene.eventMode = 'none';
  app.stage.addChild(scene);
  const starsLayer = new Container();
  const actors = new Container();
  const effects = new Container();
  const hud = new Container();
  const debug = new Graphics();
  scene.addChild(starsLayer, actors, effects, hud, debug);
  const crt = new CRTFilter({
    curvature: 0,
    lineWidth: 1,
    lineContrast: 0.055,
    noise: 0,
    vignetting: 0.1,
    vignettingAlpha: 0.12,
    vignettingBlur: 0.3,
  });
  scene.filterArea = new Rectangle(0, 0, CONFIG.width, CONFIG.height);
  scene.filters = [crt];
  const allTextures: Texture[] = [];
  function frames(source: Parameters<typeof createPixelFrames>[0], palette = SPRITE_PALETTE) {
    const textures = createPixelFrames(source, palette);
    allTextures.push(...textures);
    return textures;
  }
  const playerFrames = {
    center: frames(RETRO_SPRITES.player.center),
    left: frames(RETRO_SPRITES.player.left),
    right: frames(RETRO_SPRITES.player.right),
  };
  const enemyFrames = {
    [EnemyKind.Flagship]: frames(RETRO_SPRITES.flagship, RETRO_ENEMY_PALETTES.flagship),
    [EnemyKind.Scout]: frames(RETRO_SPRITES.scout, RETRO_ENEMY_PALETTES.scout),
    [EnemyKind.Striker]: frames(RETRO_SPRITES.striker, RETRO_ENEMY_PALETTES.striker),
    [EnemyKind.Drone]: frames(RETRO_SPRITES.drone, RETRO_ENEMY_PALETTES.drone),
  };
  const mantaFrames = frames(RETRO_SPRITES.manta, RETRO_ENEMY_PALETTES.manta);
  const raiderFrames = frames(RETRO_SPRITES.raider, RETRO_ENEMY_PALETTES.raider);
  const playerBulletTexture = createPixelTexture(RETRO_SPRITES.playerBullet, SPRITE_PALETTE);
  const enemyBulletTexture = createPixelTexture(RETRO_SPRITES.enemyBullet, SPRITE_PALETTE);
  allTextures.push(playerBulletTexture, enemyBulletTexture);
  const explosionFrames = frames(RETRO_SPRITES.explosion);
  const font: Record<string, Texture> = {};
  for (const [character, grid] of Object.entries(PIXEL_FONT)) {
    const texture = createPixelTexture(grid, { '#': 0xffffff });
    font[character] = texture;
    allTextures.push(texture);
  }
  function label(text: string, x: number, y: number, color: number): PixelText {
    const item = new PixelText(font, FONT_WIDTH);
    item.position.set(x, y);
    item.setText(text, color);
    hud.addChild(item);
    return item;
  }
  label('SCORE', HUD_LAYOUT.score.x, HUD_LAYOUT.score.labelY, RETRO_PALETTE.amber);
  const scoreText = label(
    '000000',
    HUD_LAYOUT.score.x,
    HUD_LAYOUT.score.valueY,
    RETRO_PALETTE.white,
  );
  const waveLabel = label('WAVE', 0, HUD_LAYOUT.wave.labelY, RETRO_PALETTE.muted);
  waveLabel.x = Math.round(HUD_LAYOUT.wave.centerX - waveLabel.textWidth / 2);
  const waveText = label('01', 0, HUD_LAYOUT.wave.valueY, RETRO_PALETTE.white);
  label('FUEL', HUD_LAYOUT.fuel.labelX, HUD_LAYOUT.fuel.labelY, RETRO_PALETTE.muted);
  label('LIVES', HUD_LAYOUT.lives.labelX, HUD_LAYOUT.lives.labelY, RETRO_PALETTE.muted);
  const fuel = new Graphics();
  hud.addChild(fuel);
  const separator = new Graphics();
  separator.rect(8, 225, 304, 1).fill({ color: RETRO_PALETTE.border, alpha: 0.8 });
  hud.addChild(separator);
  const lives = Array.from({ length: 4 }, (_, index) => {
    const sprite = makeSprite(hud, playerFrames.center[0]);
    sprite.scale.set(0.5);
    sprite.position.set(
      HUD_LAYOUT.lives.firstX + index * HUD_LAYOUT.lives.spacing,
      HUD_LAYOUT.lives.y,
    );
    return sprite;
  });
  const banner = new PixelText(font, FONT_WIDTH);
  banner.y = 155;
  effects.addChild(banner);
  const player = makeSprite(actors, playerFrames.center[0]);
  const enemies = Array.from({ length: CONFIG.rows * CONFIG.columns }, () => makeSprite(actors));
  const playerBullets = Array.from({ length: CONFIG.playerBulletCount }, () =>
    makeSprite(actors, playerBulletTexture),
  );
  const enemyBullets = Array.from({ length: CONFIG.enemyBulletCount }, () =>
    makeSprite(actors, enemyBulletTexture),
  );
  const explosions: Explosion[] = Array.from({ length: 24 }, () => {
    const sprite = makeSprite(effects, explosionFrames[0]);
    sprite.visible = false;
    return { sprite, age: 0, duration: 0 };
  });
  const particles: Particle[] = Array.from({ length: 128 }, () => {
    const sprite = makeSprite(effects, Texture.WHITE);
    sprite.width = 1;
    sprite.height = 1;
    sprite.visible = false;
    return { sprite, age: 0, duration: 0, vx: 0, vy: 0 };
  });
  const popups: Popup[] = Array.from({ length: 16 }, () => {
    const text = new PixelText(font, FONT_WIDTH, 8);
    text.visible = false;
    effects.addChild(text);
    return { text, age: 0 };
  });
  let visualRng = 0x5a4e21;
  function visualRandom(): number {
    visualRng = (Math.imul(visualRng, 1664525) + 1013904223) >>> 0;
    return visualRng / 4294967296;
  }
  const starColors = [RETRO_PALETTE.muted, RETRO_PALETTE.cyan, RETRO_PALETTE.amber];
  const stars: Star[] = Array.from({ length: 70 }, () => {
    const sprite = makeSprite(starsLayer, Texture.WHITE);
    sprite.width = 1;
    sprite.height = 1;
    sprite.position.set(
      Math.floor(visualRandom() * CONFIG.width),
      30 + Math.floor(visualRandom() * 193),
    );
    sprite.tint = starColors[Math.floor(visualRandom() * starColors.length)] ?? RETRO_PALETTE.muted;
    return { sprite, phase: visualRandom() * Math.PI * 2, brightness: 0.3 + visualRandom() * 0.4 };
  });
  let lastState: DeepReadonly<GameState> | undefined;
  let lastTick = 0;
  let lastScore = -1;
  let lastWave = -1;
  let lastFuel = -1;
  let shakeTicks = 0;
  let flashTicks = 0;
  const flash = new Sprite(Texture.WHITE);
  flash.width = CONFIG.width;
  flash.height = CONFIG.height;
  flash.tint = RETRO_PALETTE.red;
  flash.visible = false;
  scene.addChild(flash);

  function spawnExplosion(x: number, y: number, death: boolean, reducedMotion: boolean): void {
    const slot = explosions.find((effect) => !effect.sprite.visible) ?? explosions[0];
    if (slot) {
      slot.sprite.position.set(Math.round(x), Math.round(y));
      slot.sprite.scale.set(death ? 1.4 : 1);
      slot.age = 0;
      slot.duration = death ? 28 : 20;
      slot.sprite.visible = true;
      slot.sprite.texture = explosionFrames[0] ?? Texture.EMPTY;
    }
    const count = reducedMotion ? 4 : death ? 18 : 8;
    let spawned = 0;
    for (const particle of particles) {
      if (particle.sprite.visible) continue;
      const angle = visualRandom() * Math.PI * 2;
      const speed = 0.3 + visualRandom() * (death ? 1.8 : 1.2);
      particle.sprite.position.set(x, y);
      particle.sprite.tint = spawned % 2 === 0 ? RETRO_PALETTE.amber : RETRO_PALETTE.white;
      particle.sprite.alpha = 1;
      particle.sprite.visible = true;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.age = 0;
      particle.duration = 16 + Math.floor(visualRandom() * 14);
      spawned++;
      if (spawned >= count) break;
    }
  }

  function resetEffects(): void {
    for (const effect of explosions) effect.sprite.visible = false;
    for (const particle of particles) particle.sprite.visible = false;
    for (const popup of popups) popup.text.visible = false;
    shakeTicks = 0;
    flashTicks = 0;
  }

  const renderer: ThemeRenderer = {
    id: 'retro',
    render(state, events, _alpha, options) {
      if (state !== lastState || state.tick < lastTick) resetEffects();
      const frozen = state.phase === GamePhase.Paused || state.hitStopTicks > 0;
      const elapsed =
        frozen || state !== lastState ? 0 : Math.min(6, Math.max(0, state.tick - lastTick));
      lastState = state;
      lastTick = state.tick;
      scene.alpha = options.dimmed ? 0.38 : 1;
      for (const star of stars) {
        star.sprite.alpha = options.reducedMotion
          ? star.brightness
          : star.brightness + Math.sin(state.tick * 0.022 + star.phase) * 0.17;
      }
      const frame = Math.floor(state.tick / 18) % 2;
      const lean =
        state.player.direction < 0
          ? playerFrames.left
          : state.player.direction > 0
            ? playerFrames.right
            : playerFrames.center;
      player.texture = lean[frame] ?? Texture.EMPTY;
      player.position.set(Math.round(state.player.x), Math.round(state.player.y));
      player.visible = state.phase !== GamePhase.Respawning && state.phase !== GamePhase.GameOver;
      if (state.player.invulnerableTicks > 0 && !options.reducedMotion) {
        player.visible &&= Math.floor(state.tick / 6) % 2 === 0;
      }
      player.alpha = state.player.invulnerableTicks > 0 && options.reducedMotion ? 0.6 : 1;
      for (let index = 0; index < enemies.length; index++) {
        const sprite = enemies[index];
        const enemy = state.enemies[index];
        if (!sprite) continue;
        sprite.visible = enemy !== undefined && enemy.mode !== EnemyMode.Dead;
        if (!enemy || !sprite.visible) continue;
        sprite.texture =
          (enemy.row === 5
            ? raiderFrames
            : enemy.row === 4
              ? mantaFrames
              : enemyFrames[enemy.kind])[frame] ?? Texture.EMPTY;
        sprite.position.set(Math.round(enemy.x), Math.round(enemy.y));
        sprite.alpha = 1;
      }
      for (let index = 0; index < playerBullets.length; index++) {
        const sprite = playerBullets[index];
        const bullet = state.playerBullets[index];
        if (!sprite) continue;
        sprite.visible = bullet?.active ?? false;
        if (bullet?.active) sprite.position.set(Math.round(bullet.x), Math.round(bullet.y));
      }
      for (let index = 0; index < enemyBullets.length; index++) {
        const sprite = enemyBullets[index];
        const bullet = state.enemyBullets[index];
        if (!sprite) continue;
        sprite.visible = bullet?.active ?? false;
        if (bullet?.active) sprite.position.set(Math.round(bullet.x), Math.round(bullet.y));
      }
      for (const event of events) {
        if (event.kind === 'kill') {
          spawnExplosion(event.x, event.y, false, options.reducedMotion);
          if (event.diving) {
            const popup = popups.find((item) => !item.text.visible);
            if (popup) {
              popup.text.setText(`+${event.points}`, RETRO_PALETTE.amber);
              popup.text.position.set(
                Math.round(event.x - popup.text.textWidth / 2),
                Math.round(event.y - 12),
              );
              popup.text.visible = true;
              popup.text.alpha = 1;
              popup.age = 0;
            }
          }
        } else if (event.kind === 'hit') {
          spawnExplosion(event.x, event.y, true, options.reducedMotion);
          shakeTicks = options.reducedMotion ? 0 : 14;
          flashTicks = options.reducedMotion ? 0 : 3;
        } else if (event.kind === 'cancel') {
          spawnExplosion(event.x, event.y, false, options.reducedMotion);
        }
      }
      for (const effect of explosions) {
        if (!effect.sprite.visible) continue;
        effect.age += elapsed;
        effect.sprite.visible = effect.age < effect.duration;
        const index = Math.min(
          explosionFrames.length - 1,
          Math.floor((effect.age / effect.duration) * explosionFrames.length),
        );
        effect.sprite.texture = explosionFrames[index] ?? Texture.EMPTY;
      }
      for (const particle of particles) {
        if (!particle.sprite.visible) continue;
        particle.age += elapsed;
        particle.sprite.visible = particle.age < particle.duration;
        particle.sprite.x += particle.vx * elapsed;
        particle.sprite.y += particle.vy * elapsed;
        particle.sprite.alpha = 1 - particle.age / particle.duration;
      }
      for (const popup of popups) {
        if (!popup.text.visible) continue;
        popup.age += elapsed;
        popup.text.y -= elapsed * 0.28;
        popup.text.visible = popup.age < 45;
        popup.text.alpha = Math.min(1, (45 - popup.age) / 15);
      }
      shakeTicks = Math.max(0, shakeTicks - elapsed);
      flashTicks = Math.max(0, flashTicks - elapsed);
      actors.position.set(
        !options.reducedMotion && shakeTicks > 0 ? Math.round(Math.sin(state.tick * 2.7) * 2) : 0,
        !options.reducedMotion && shakeTicks > 0 ? Math.round(Math.cos(state.tick * 3.4)) : 0,
      );
      flash.visible = !options.reducedMotion && flashTicks > 0;
      flash.alpha = 0.08;
      if (lastScore !== state.score) {
        scoreText.setText(String(state.score).padStart(6, '0'), RETRO_PALETTE.white);
        lastScore = state.score;
      }
      if (lastWave !== state.wave) {
        waveText.setText(String(state.wave).padStart(2, '0'), RETRO_PALETTE.white);
        waveText.x = Math.round(HUD_LAYOUT.wave.centerX - waveText.textWidth / 2);
        lastWave = state.wave;
      }
      if (lastFuel !== state.fuel) {
        fuel
          .clear()
          .rect(HUD_LAYOUT.fuel.x, HUD_LAYOUT.fuel.y, HUD_LAYOUT.fuel.width, HUD_LAYOUT.fuel.height)
          .fill(RETRO_PALETTE.panel);
        const filled = Math.round(
          (HUD_LAYOUT.fuel.width * Math.max(0, state.fuel)) / CONFIG.fuelCapacity,
        );
        if (filled > 0)
          fuel
            .rect(HUD_LAYOUT.fuel.x, HUD_LAYOUT.fuel.y, filled, HUD_LAYOUT.fuel.height)
            .fill(state.fuel <= 25 ? RETRO_PALETTE.red : RETRO_PALETTE.mint);
        lastFuel = state.fuel;
      }
      for (let index = 0; index < lives.length; index++) {
        const sprite = lives[index];
        if (sprite) sprite.visible = index < state.lives;
      }
      banner.visible = state.phase === GamePhase.WaveClear || state.phase === GamePhase.Respawning;
      if (banner.visible) {
        banner.setText(
          state.phase === GamePhase.WaveClear ? 'WAVE CLEAR' : 'READY',
          RETRO_PALETTE.amber,
        );
        banner.x = Math.round((CONFIG.width - banner.textWidth) / 2);
      }
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
            .stroke({ color: RETRO_PALETTE.mint, width: 1 });
        for (const enemy of state.enemies) {
          if (enemy.mode !== EnemyMode.Dead)
            debug
              .rect(
                enemy.x - CONFIG.enemyHalfWidth,
                enemy.y - CONFIG.enemyHalfHeight,
                CONFIG.enemyHalfWidth * 2,
                CONFIG.enemyHalfHeight * 2,
              )
              .stroke({ color: RETRO_PALETTE.red, width: 1 });
        }
        for (const bullet of state.playerBullets) {
          if (bullet.active)
            debug
              .rect(
                bullet.x - CONFIG.bulletHalfWidth,
                bullet.y - CONFIG.bulletHalfHeight,
                CONFIG.bulletHalfWidth * 2,
                CONFIG.bulletHalfHeight * 2,
              )
              .stroke({ color: RETRO_PALETTE.cyan, width: 1 });
        }
        for (const bullet of state.enemyBullets) {
          if (bullet.active)
            debug
              .rect(
                bullet.x - CONFIG.bulletHalfWidth,
                bullet.y - CONFIG.bulletHalfHeight,
                CONFIG.bulletHalfWidth * 2,
                CONFIG.bulletHalfHeight * 2,
              )
              .stroke({ color: RETRO_PALETTE.amber, width: 1 });
        }
      }
      app.render();
    },
    resize(width, height, _pixelRatio) {
      const scale = Math.max(0.1, Math.min(width / CONFIG.width, height / CONFIG.height));
      canvas.style.width = `${CONFIG.width * scale}px`;
      canvas.style.height = `${CONFIG.height * scale}px`;
      canvas.dataset.logicalWidth = String(CONFIG.width);
      canvas.dataset.logicalHeight = String(CONFIG.height);
      canvas.dataset.scale = String(scale);
    },
    destroy() {
      app.destroy({ removeView: true }, { children: true });
      crt.destroy();
      for (const texture of allTextures) texture.destroy(true);
    },
  };
  const bounds = host.getBoundingClientRect();
  renderer.resize(bounds.width || CONFIG.width, bounds.height || CONFIG.height, 1);
  return renderer;
}
