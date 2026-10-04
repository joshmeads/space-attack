import { AudioController } from '../audio';
import { createGame, step } from '../core';
import { CONFIG } from '../core/config';
import {
  Command,
  GamePhase,
  type DeepReadonly,
  type GameEvent,
  type GameState,
} from '../core/types';
import { chooseDemoInput } from '../demo/ai';
import {
  addScore,
  clearRun,
  loadPreferences,
  loadRun,
  loadScores,
  savePreferences,
  saveRun,
} from '../platform/storage';
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
  const autonomous = query.get('demo') === '1';
  const requestedSeed = Number(query.get('seed') ?? '1982');
  const seed = Number.isFinite(requestedSeed) ? requestedSeed >>> 0 : 1982;
  const preferences = loadPreferences();
  preferences.theme = 'retro';
  let scores = loadScores();
  let previousBest = scores[0]?.score ?? 0;
  let state = (!autonomous && loadRun()) || createGame(seed);
  let demo = createGame(seed);
  let pendingCommand = Command.None;
  let skipWave = false;
  let invulnerable = false;
  let frameEvents: GameEvent[] = [];
  let demoEvents: GameEvent[] = [];
  let scorePrompted = false;
  let scoreSubmitted = false;
  let lastPeriodicSave = 0;
  let idleSavePending = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const audio = new AudioController();
  let renderer: ThemeRenderer;
  const unlock = () => {
    if (!autonomous) void audio.unlock().catch(() => {});
  };
  const persist = () => {
    if (!autonomous) saveRun(state);
  };
  const submitScore = (initials: string) => {
    if (autonomous || scoreSubmitted || state.phase !== GamePhase.GameOver) return;
    const qualifies = scores.length < 5 || state.score > (scores[4]?.score ?? 0);
    if (qualifies) scores = addScore({ initials, score: state.score, wave: state.wave });
    scoreSubmitted = true;
    ui.showScores(scores, false, submitScore);
  };
  const action = (requested: MenuAction) => {
    unlock();
    if (requested === 'music' || requested === 'sfx') {
      if (requested === 'music') preferences.music = !preferences.music;
      else preferences.sfx = !preferences.sfx;
      if (!autonomous) savePreferences(preferences);
      ui.refresh();
      if (state.phase === GamePhase.GameOver) scorePrompted = false;
      return;
    }
    if (autonomous) return;
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
  };
  const ui = new GameUI(host, action);
  const input = new InputController(action, unlock);
  for (const button of host.querySelectorAll<HTMLElement>('[data-touch]')) {
    const control = button.dataset.touch;
    if (control) input.bindTouch(button, control);
  }
  function newGame(): void {
    submitScore(ui.initials());
    clearRun();
    previousBest = scores[0]?.score ?? 0;
    state = createGame(seed);
    pendingCommand = Command.Start;
    scorePrompted = false;
    scoreSubmitted = false;
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
    const attract = state.phase === GamePhase.Title || state.phase === GamePhase.Screensaver;
    const shownState = autonomous || attract ? demo : state;
    renderer.render(
      shownState,
      autonomous || attract ? demoEvents : frameEvents,
      accumulator / (1000 / CONFIG.tickRate),
      {
        reducedMotion,
        debugHitboxes: debug,
        dimmed: (!autonomous && attract) || state.phase === GamePhase.Paused,
      },
    );
    ui.render(
      autonomous ? demo : state,
      previousBest,
      preferences.music,
      preferences.sfx,
      false,
      false,
      true,
    );
    if (!autonomous && state.phase === GamePhase.GameOver && !scorePrompted) {
      scorePrompted = true;
      ui.showScores(
        scores,
        !scoreSubmitted && (scores.length < 5 || state.score > (scores[4]?.score ?? 0)),
        submitScore,
      );
    }
    if (!autonomous && !attract) audio.update(state, frameEvents, preferences);
    else audio.pause();
    if (debug)
      ui.debug(`${debugFPS.toFixed(0)} FPS · ${shownState.phase} · TICK ${shownState.tick}`);
    frameEvents = [];
    demoEvents = [];
  };
  const consumeEvents = (events: readonly GameEvent[]) => {
    frameEvents.push(...events);
    for (const event of events) {
      if (
        event.kind === 'wave' ||
        (event.kind === 'phase' &&
          (event.to === GamePhase.Paused || event.to === GamePhase.Playing))
      )
        persist();
      if (event.kind === 'phase' && event.to === GamePhase.GameOver) clearRun();
    }
  };
  const tick = () => {
    if (autonomous || state.phase === GamePhase.Title || state.phase === GamePhase.Screensaver) {
      if (demo.phase === GamePhase.GameOver) demo = createGame(seed);
      demoEvents.push(...step(demo, chooseDemoInput(demo)));
    }
    if (autonomous) return;
    const actions = input.read();
    actions.command = pendingCommand;
    actions.debugInvulnerable = debug && invulnerable;
    actions.debugSkipWave = debug && skipWave;
    pendingCommand = Command.None;
    skipWave = false;
    consumeEvents(step(state, actions));
  };
  const pause = () => {
    input.clear();
    pendingCommand = Command.None;
    if (!autonomous && isActive(state))
      consumeEvents(
        step(state, {
          move: 0,
          fire: false,
          command: Command.Pause,
          activity: false,
          debugInvulnerable: false,
          debugSkipWave: false,
        }),
      );
    persist();
    audio.pause();
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
      snapshot: () => structuredClone(autonomous ? demo : state),
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
          consumeEvents(
            step(state, {
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
  const scheduleSave = (now: number) => {
    if (autonomous || idleSavePending || now - lastPeriodicSave < 4000 || !isActive(state)) return;
    lastPeriodicSave = now;
    idleSavePending = true;
    const save = () => {
      idleSavePending = false;
      persist();
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(save, { timeout: 1000 });
    else setTimeout(save, 0);
  };
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
      scheduleSave(now);
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
