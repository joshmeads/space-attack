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
import type { ThemeId, ThemeRenderer } from '../themes/types';
import { InputController, type MenuAction } from './input';
import { GameUI } from './ui';
import { createBenchmark, type BenchmarkSnapshot } from './benchmark';

const THEME_ORDER: readonly ThemeId[] = ['classic', 'retro', 'modern'];
const THEME_ACTIONS: Partial<Record<MenuAction, ThemeId>> = {
  'theme-classic': 'classic',
  'theme-retro': 'retro',
  'theme-modern': 'modern',
};
const RENDERER_FACTORIES: Record<ThemeId, (host: HTMLElement) => Promise<ThemeRenderer>> = {
  classic: async (host) => {
    const { createClassicRenderer } = await import('../themes/classic/renderer');
    return createClassicRenderer(host);
  },
  retro: createRetroRenderer,
  modern: async (host) => {
    const { createModernRenderer } = await import('../themes/modern/renderer');
    return createModernRenderer(host);
  },
};

interface DebugAPI {
  snapshot(): DeepReadonly<GameState>;
  skipWave(): void;
  invulnerable(enabled: boolean): void;
  advance(ticks: number): void;
}

declare global {
  interface Window {
    __SPACE_ATTACK__?: DebugAPI;
    __SPACE_ATTACK_BENCHMARK__?: { snapshot(): BenchmarkSnapshot };
  }
}

export async function bootGame(host: HTMLElement): Promise<void> {
  const query = new URLSearchParams(location.search);
  const debug = query.get('debug') === '1';
  const benchmarkEnabled = query.get('benchmark') === '1';
  const autonomous = query.get('demo') === '1' || benchmarkEnabled;
  const requestedSeed = Number(query.get('seed') ?? '1982');
  const seed = Number.isFinite(requestedSeed) ? requestedSeed >>> 0 : 1982;
  const preferences = loadPreferences();
  const queryTheme = query.get('theme');
  const initialTheme =
    queryTheme === 'classic' || queryTheme === 'retro' || queryTheme === 'modern'
      ? queryTheme
      : preferences.theme;
  preferences.theme = initialTheme;
  let desiredTheme: ThemeId = initialTheme;
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
  const benchmark = benchmarkEnabled ? createBenchmark(seed) : null;
  const surfaces = new Map<ThemeId, HTMLElement>();
  const renderers = new Map<ThemeId, Promise<ThemeRenderer>>();
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
    if (debug && !autonomous && requested === 'invulnerable') {
      invulnerable = !invulnerable;
      return;
    }
    if (debug && !autonomous && requested === 'skipwave') {
      skipWave = true;
      return;
    }
    const selectedTheme = THEME_ACTIONS[requested];
    if (selectedTheme) {
      desiredTheme = selectedTheme;
      void selectTheme(selectedTheme);
      return;
    }
    if (requested === 'theme') {
      desiredTheme =
        THEME_ORDER[(THEME_ORDER.indexOf(desiredTheme) + 1) % THEME_ORDER.length] ?? 'classic';
      void selectTheme(desiredTheme);
      return;
    }
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
    if (requested === 'restart' && state.phase === GamePhase.Paused) newGame();
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
  const makeSurface = (theme: ThemeId) => {
    const surface = document.createElement('div');
    surface.className = 'theme-surface';
    surface.dataset.theme = theme;
    surface.style.display = 'none';
    ui.stage.append(surface);
    surfaces.set(theme, surface);
    return surface;
  };
  try {
    const initialPromise = RENDERER_FACTORIES[initialTheme](makeSurface(initialTheme));
    renderers.set(initialTheme, initialPromise);
    renderer = await initialPromise;
    const surface = surfaces.get(initialTheme);
    if (surface) surface.style.display = 'flex';
  } catch {
    ui.error(
      'Space Attack needs WebGL 2. Enable hardware acceleration or try a supported browser.',
    );
    return;
  }
  const resize = () => {
    const display = ui.stage.parentElement;
    const controls = host.querySelector<HTMLElement>('.touch-controls');
    const controlsHeight = controls?.getBoundingClientRect().height ?? 0;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const fit = Math.min(
      viewportWidth / CONFIG.width,
      Math.max(1, viewportHeight - controlsHeight) / CONFIG.height,
    );
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    const width = CONFIG.width * scale;
    const height = CONFIG.height * scale;
    if (display) {
      display.style.width = `${width}px`;
      display.style.height = `${height}px`;
    }
    host.style.setProperty('--stage-width', `${width}px`);
    for (const cached of renderers.values())
      void cached
        .then((themeRenderer) =>
          themeRenderer.resize(ui.stage.clientWidth, ui.stage.clientHeight, devicePixelRatio),
        )
        .catch(() => {});
    renderer.resize(ui.stage.clientWidth, ui.stage.clientHeight, devicePixelRatio);
    const canvas = surfaces.get(preferences.theme)?.querySelector('canvas');
    if (canvas) {
      host.style.setProperty('--field-width', `${canvas.clientWidth}px`);
      host.style.setProperty('--field-height', `${canvas.clientHeight}px`);
    }
  };
  async function selectTheme(theme: ThemeId): Promise<void> {
    let pending = renderers.get(theme);
    if (!pending) {
      const surface = makeSurface(theme);
      pending = RENDERER_FACTORIES[theme](surface);
      renderers.set(theme, pending);
    }
    try {
      const selected = await pending;
      if (theme !== desiredTheme) return;
      renderer = selected;
      preferences.theme = theme;
      for (const [id, surface] of surfaces) surface.style.display = id === theme ? 'flex' : 'none';
      if (!autonomous) savePreferences(preferences);
      resize();
      ui.refresh();
    } catch {
      desiredTheme = preferences.theme;
      renderers.delete(theme);
      const surface = surfaces.get(theme);
      surface?.remove();
      surfaces.delete(theme);
    }
  }
  new ResizeObserver(resize).observe(ui.stage);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();
  let previousTime: number | null = null;
  let accumulator = 0;
  let debugFrameCount = 0;
  let debugElapsed = 0;
  let debugFPS = 0;
  let benchmarkDisplay = 'BENCHMARK · SAMPLING';
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
      true,
      true,
      preferences.theme,
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
      ui.debug(
        `${debugFPS.toFixed(0)} FPS · ${shownState.phase} · TICK ${shownState.tick}\n[I] SHIELD ${invulnerable ? 'ON' : 'OFF'} · [K] NEXT WAVE`,
      );
    if (benchmark) ui.debug(benchmarkDisplay);
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
  if (benchmark) {
    window.__SPACE_ATTACK_BENCHMARK__ = {
      snapshot: () => {
        const canvas = surfaces.get(preferences.theme)?.querySelector('canvas');
        return benchmark.snapshot({
          theme: preferences.theme,
          width: canvas?.width ?? CONFIG.width,
          height: canvas?.height ?? CONFIG.height,
          pixelRatio: devicePixelRatio,
          renderer: 'webgl2',
          wave: demo.wave,
          tick: demo.tick,
        });
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
      if (previousTime !== null) benchmark?.sample(elapsed);
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
        const report = window.__SPACE_ATTACK_BENCHMARK__?.snapshot();
        if (report)
          benchmarkDisplay = `BENCHMARK ${report.seed} · ${report.theme.toUpperCase()} · ${report.width}×${report.height}\nAVG ${report.averageMs.toFixed(2)} MS · P95 ${report.p95Ms.toFixed(2)} MS · DROP ${report.estimatedDroppedFrames}`;
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
