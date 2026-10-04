import { createGame, step } from '../core';
import { CONFIG } from '../core/config';
import {
  Command,
  GamePhase,
  type DeepReadonly,
  type GameEvent,
  type GameState,
} from '../core/types';
import { createRetroRenderer } from '../themes/retro/renderer';
import type { ThemeRenderer } from '../themes/types';
import { InputController, type MenuAction } from './input';
import { GameUI } from './ui';

interface DebugAPI {
  snapshot(): DeepReadonly<GameState>;
  skipWave(): void;
  invulnerable(enabled: boolean): void;
  advance(ticks: number): void;
}

declare global {
  interface Window {
    __SPACE_ATTACK__?: DebugAPI;
  }
}

export async function bootGame(host: HTMLElement): Promise<void> {
  const query = new URLSearchParams(location.search);
  const debug = query.get('debug') === '1';
  const requestedSeed = Number(query.get('seed') ?? '1982');
  const seed = Number.isFinite(requestedSeed) ? requestedSeed >>> 0 : 1982;
  let state = createGame(seed);
  let pendingCommand = Command.None;
  let skipWave = false;
  let invulnerable = false;
  let music = true;
  let sfx = true;
  let frameEvents: GameEvent[] = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: ThemeRenderer;
  const action = (requested: MenuAction) => {
    if (requested === 'start') {
      if (state.phase === GamePhase.Paused) pendingCommand = Command.Continue;
      else if (state.phase === GamePhase.Title || state.phase === GamePhase.Screensaver)
        pendingCommand = Command.Start;
      else if (state.phase === GamePhase.GameOver) newGame();
    }
    if (requested === 'title') newGame();
    if (requested === 'pause') {
      if (state.phase === GamePhase.Paused) pendingCommand = Command.Continue;
      else if (isActive(state)) pendingCommand = Command.Pause;
    }
    if (requested === 'music') {
      music = !music;
      ui.refresh();
    }
    if (requested === 'sfx') {
      sfx = !sfx;
      ui.refresh();
    }
  };
  const ui = new GameUI(host, action);
  const input = new InputController(action, () => {});
  for (const button of host.querySelectorAll<HTMLElement>('[data-touch]')) {
    const control = button.dataset.touch;
    if (control) input.bindTouch(button, control);
  }
  function newGame(): void {
    state = createGame(seed);
    pendingCommand = Command.Start;
    input.clear();
    frameEvents = [];
    ui.refresh();
  }
  try {
    renderer = await createRetroRenderer(ui.stage);
  } catch {
    ui.error(
      'Space Attack needs WebGL 2. Enable hardware acceleration or try a supported browser.',
    );
    return;
  }
  const resize = () => {
    renderer.resize(ui.stage.clientWidth, ui.stage.clientHeight, devicePixelRatio);
    const canvas = ui.stage.querySelector('canvas');
    if (canvas) {
      host.style.setProperty('--field-width', `${canvas.clientWidth}px`);
      host.style.setProperty('--field-height', `${canvas.clientHeight}px`);
    }
  };
  new ResizeObserver(resize).observe(ui.stage);
  resize();
  let previousTime: number | null = null;
  let accumulator = 0;
  let debugFrameCount = 0;
  let debugElapsed = 0;
  let debugFPS = 0;
  const render = () => {
    renderer.render(state, frameEvents, accumulator / (1000 / CONFIG.tickRate), {
      reducedMotion,
      debugHitboxes: debug,
      dimmed:
        state.phase === GamePhase.Title ||
        state.phase === GamePhase.Screensaver ||
        state.phase === GamePhase.Paused,
    });
    ui.render(state, 0, music, sfx, false, false);
    if (debug) ui.debug(`${debugFPS.toFixed(0)} FPS · ${state.phase} · TICK ${state.tick}`);
    frameEvents = [];
  };
  const tick = () => {
    const actions = input.read();
    actions.command = pendingCommand;
    actions.debugInvulnerable = debug && invulnerable;
    actions.debugSkipWave = debug && skipWave;
    pendingCommand = Command.None;
    skipWave = false;
    frameEvents.push(...step(state, actions));
  };
  const pause = () => {
    input.clear();
    if (isActive(state))
      frameEvents.push(
        ...step(state, {
          move: 0,
          fire: false,
          command: Command.Pause,
          activity: false,
          debugInvulnerable: false,
          debugSkipWave: false,
        }),
      );
    previousTime = null;
    accumulator = 0;
    render();
  };
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('pagehide', pause);
  if (debug) {
    window.__SPACE_ATTACK__ = {
      snapshot: () => structuredClone(state),
      skipWave: () => {
        skipWave = true;
      },
      invulnerable: (enabled) => {
        invulnerable = enabled;
      },
      advance: (ticks) => {
        const count = Math.max(0, Math.min(60000, Math.trunc(ticks)));
        for (let index = 0; index < count; index += 1) {
          if (state.phase === GamePhase.GameOver) break;
          frameEvents.push(
            ...step(state, {
              move: 0,
              fire: false,
              command: Command.None,
              activity: false,
              debugInvulnerable: invulnerable,
              debugSkipWave: false,
            }),
          );
        }
        render();
      },
    };
  }
  const frame = (now: number) => {
    if (!document.hidden) {
      const elapsed = previousTime === null ? 0 : Math.max(0, now - previousTime);
      previousTime = now;
      accumulator += Math.min(elapsed, 100);
      let ticks = 0;
      while (accumulator >= 1000 / CONFIG.tickRate && ticks < 6) {
        tick();
        accumulator -= 1000 / CONFIG.tickRate;
        ticks += 1;
      }
      if (ticks === 6) accumulator = Math.min(accumulator, 1000 / CONFIG.tickRate);
      debugFrameCount += 1;
      debugElapsed += elapsed;
      if (debugElapsed >= 1000) {
        debugFPS = (debugFrameCount * 1000) / debugElapsed;
        debugElapsed = 0;
        debugFrameCount = 0;
      }
      render();
    }
    requestAnimationFrame(frame);
  };
  render();
  requestAnimationFrame(frame);
}

function isActive(state: GameState): boolean {
  return (
    state.phase === GamePhase.Playing ||
    state.phase === GamePhase.Respawning ||
    state.phase === GamePhase.WaveClear
  );
}
