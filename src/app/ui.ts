import { CONFIG } from '../core/config';
import { HUD_LAYOUT } from '../render/layout';
import { PIXEL_FONT as CLASSIC_PIXEL_FONT } from '../themes/classic/font';
import { FONT_HEIGHT, FONT_SPACING, FONT_WIDTH, PIXEL_FONT } from '../themes/retro/font';
import { GamePhase, type GameState } from '../core/types';
import type { ThemeId } from '../themes/types';
import type { HighScore } from '../platform/storage';
import type { MenuAction } from './input';

const BEST_FONTS: Readonly<Record<ThemeId, typeof PIXEL_FONT>> = {
  classic: CLASSIC_PIXEL_FONT,
  retro: PIXEL_FONT,
  modern: PIXEL_FONT,
};

const PIXEL_LABELS = new Map<string, string>();

function pixelLabel(text: string, theme: ThemeId): string {
  const key = `${theme}:${text}`;
  const cached = PIXEL_LABELS.get(key);
  if (cached) return cached;
  const width = text.length * (FONT_WIDTH + FONT_SPACING) - FONT_SPACING;
  const pixels: string[] = [];
  for (const [index, character] of text.split('').entries()) {
    const grid = BEST_FONTS[theme][character];
    if (!grid) continue;
    for (const [y, row] of grid.entries())
      for (const [x, pixel] of row.split('').entries())
        if (pixel === '#')
          pixels.push(
            `<rect x="${index * (FONT_WIDTH + FONT_SPACING) + x}" y="${y}" width="1" height="1"/>`,
          );
  }
  const label = `<svg class="pixel-label" viewBox="0 0 ${width} ${FONT_HEIGHT}" aria-hidden="true" focusable="false" shape-rendering="crispEdges" style="--glyph-width:${width};--glyph-height:${FONT_HEIGHT}"><g fill="currentColor">${pixels.join('')}</g></svg>`;
  PIXEL_LABELS.set(key, label);
  return label;
}

export class GameUI {
  readonly stage: HTMLElement;
  readonly overlay: HTMLElement;
  private readonly score: HTMLElement;
  private readonly best: HTMLElement;
  private readonly wave: HTMLElement;
  private readonly fuel: HTMLElement;
  private readonly lives: HTMLElement;
  private readonly status: HTMLElement;
  private lastPhase: GamePhase | null = null;
  private lastBest = -1;
  private lastBestTheme: ThemeId | null = null;
  private currentTheme: ThemeId = 'classic';

  constructor(host: HTMLElement, onAction: (action: MenuAction) => void) {
    host.style.setProperty('--hud-best-right', `${(HUD_LAYOUT.best.right / CONFIG.width) * 100}%`);
    host.style.setProperty('--hud-label-top', `${(HUD_LAYOUT.best.labelY / CONFIG.height) * 100}%`);
    host.style.setProperty('--hud-value-top', `${(HUD_LAYOUT.best.valueY / CONFIG.height) * 100}%`);
    host.innerHTML = `<main class="game-view" data-theme="classic" aria-label="Space Attack"><section class="display" aria-label="Game playfield"><div class="stage" id="game-stage"></div><div class="hud-telemetry"><span id="score" data-testid="score">000000</span><span id="wave" data-testid="wave">01</span><span id="fuel" data-testid="fuel"></span><span id="lives" data-testid="lives">3</span></div><div class="hud-best"><span class="hud-label">BEST</span><strong id="best">000000</strong></div><div class="screen-overlay" id="screen-overlay"></div><div class="debug-status" id="debug-status"></div></section><div class="touch-controls" aria-label="Touch controls"><div class="touch-steering"><button class="touch-button" data-touch="left" aria-label="Move left">◀</button><button class="touch-button" data-touch="right" aria-label="Move right">▶</button></div><button class="touch-button touch-pause" data-action="pause" aria-label="Pause">Ⅱ</button><button class="touch-button touch-fire" data-touch="fire" aria-label="Fire">FIRE</button></div></main>`;
    this.stage = required(host, '#game-stage');
    this.overlay = required(host, '#screen-overlay');
    this.score = required(host, '#score');
    this.best = required(host, '#best');
    this.wave = required(host, '#wave');
    this.fuel = required(host, '#fuel');
    this.lives = required(host, '#lives');
    this.status = required(host, '#debug-status');
    host.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>('[data-action]');
      const action = button?.dataset.action;
      if (
        action === 'start' ||
        action === 'pause' ||
        action === 'title' ||
        action === 'music' ||
        action === 'sfx' ||
        action === 'theme' ||
        action === 'theme-classic' ||
        action === 'theme-retro' ||
        action === 'theme-modern'
      )
        onAction(action);
    });
  }

  render(
    state: GameState,
    previousBest: number,
    music: boolean,
    sfx: boolean,
    hasSave: boolean,
    themesAvailable: boolean,
    audioAvailable = false,
    theme: ThemeId = 'classic',
  ): void {
    this.currentTheme = theme;
    const view = this.stage.closest<HTMLElement>('.game-view');
    if (view && view.dataset.theme !== theme) view.dataset.theme = theme;
    this.score.textContent = String(state.score).padStart(6, '0');
    if (this.lastBest !== previousBest || this.lastBestTheme !== theme) {
      this.lastBest = previousBest;
      this.lastBestTheme = theme;
      const text = String(previousBest).padStart(6, '0');
      const width = text.length * (FONT_WIDTH + FONT_SPACING) - FONT_SPACING;
      this.best.innerHTML = pixelLabel(text, theme);
      this.best.setAttribute('aria-label', `Previous high score ${text}`);
      this.best.style.width = `calc(var(--field-width, 640px) * ${width / CONFIG.width})`;
      this.best.style.height = `calc(var(--field-height, 480px) * ${FONT_HEIGHT / CONFIG.height})`;
    }
    this.wave.textContent = String(state.wave).padStart(2, '0');
    this.fuel.style.width = `${state.fuel}%`;
    this.fuel.setAttribute('aria-valuenow', String(state.fuel));
    this.fuel.dataset.value = String(state.fuel);
    this.fuel.classList.toggle('low-fuel', state.fuel < 25);
    this.lives.textContent = '▲ '.repeat(Math.max(0, state.lives)).trim();
    if (this.lastPhase === state.phase) return;
    this.lastPhase = state.phase;
    this.overlay.classList.toggle(
      'visible',
      state.phase !== GamePhase.Playing && state.phase !== GamePhase.Respawning,
    );
    const themePicker = themesAvailable
      ? `<div class="theme-picker" aria-label="Theme"><span>THEME</span>${(['classic', 'retro', 'modern'] satisfies ThemeId[]).map((id) => `<button data-action="theme-${id}" aria-pressed="${theme === id}">${id.toUpperCase()}</button>`).join('')}</div>`
      : '';
    switch (state.phase) {
      case GamePhase.Title:
      case GamePhase.Screensaver:
        this.overlay.innerHTML = `<div class="menu title-menu"><h1 aria-label="SPACE ATTACK">${pixelLabel('SPACE ATTACK', theme)}</h1><div class="menu-actions"><button class="primary-button arcade-action" data-action="start" aria-label="${hasSave ? 'CONTINUE' : 'NEW GAME'}">${pixelLabel(hasSave ? 'CONTINUE' : 'NEW GAME', theme)}</button>${hasSave ? `<button class="secondary-button arcade-action" data-action="title" aria-label="NEW GAME">${pixelLabel('NEW GAME', theme)}</button>` : ''}</div><div class="menu-controls"><span>AD / ← → MOVE</span><span>W / ↑ / SPACE FIRE</span><span>ENTER START · P / ESC PAUSE</span></div>${themePicker}</div>`;
        break;
      case GamePhase.Paused:
        this.overlay.innerHTML = `<div class="menu pause-menu"><h2 aria-label="PAUSED">${pixelLabel('PAUSED', theme)}</h2><div class="menu-actions"><button class="primary-button arcade-action" data-action="start" aria-label="CONTINUE">${pixelLabel('CONTINUE', theme)}<kbd>ENTER</kbd></button><button class="secondary-button arcade-action" data-action="title" aria-label="NEW GAME">${pixelLabel('NEW GAME', theme)}<kbd>R</kbd></button></div>${audioAvailable ? `<div class="settings"><button data-action="music" aria-label="MUSIC ${music ? 'ON' : 'OFF'}"><span>${pixelLabel('MUSIC', theme)}</span><strong>${pixelLabel(music ? 'ON' : 'OFF', theme)}</strong><kbd data-testid="music-hotkey">${pixelLabel('M', theme)}</kbd></button><button data-action="sfx" aria-label="SOUND FX ${sfx ? 'ON' : 'OFF'}"><span>${pixelLabel('SOUND FX', theme)}</span><strong>${pixelLabel(sfx ? 'ON' : 'OFF', theme)}</strong><kbd data-testid="sfx-hotkey">${pixelLabel('N', theme)}</kbd></button></div>` : ''}${themePicker}</div>`;
        break;
      case GamePhase.WaveClear:
        this.overlay.innerHTML = `<div class="wave-banner"><h2>WAVE ${String(state.wave).padStart(2, '0')} CLEAR</h2></div>`;
        break;
      case GamePhase.GameOver:
        this.overlay.innerHTML = `<div class="menu gameover-menu"><h2 aria-label="GAME OVER">${pixelLabel('GAME OVER', theme)}</h2><div class="final-score"><span>SCORE</span><strong>${String(state.score).padStart(6, '0')}</strong></div><p class="score-comparison">${state.score > previousBest ? 'NEW HIGH SCORE' : `PREVIOUS BEST ${String(previousBest).padStart(6, '0')}`}</p><div id="score-entry"></div><div class="menu-actions"><button class="primary-button arcade-action" data-action="title" aria-label="PLAY AGAIN">${pixelLabel('PLAY AGAIN', theme)}</button></div></div>`;
        break;
      case GamePhase.Playing:
      case GamePhase.Respawning:
        this.overlay.innerHTML = '';
        break;
    }
  }

  initials(): string {
    const input = this.overlay.querySelector<HTMLInputElement>('#initials');
    return (input?.value ?? 'AAA')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .padEnd(3, 'A')
      .slice(0, 3);
  }

  showScores(
    scores: readonly HighScore[],
    qualifies: boolean,
    submit: (initials: string) => void,
  ): void {
    const entry = this.overlay.querySelector<HTMLElement>('#score-entry');
    if (!entry) return;
    entry.replaceChildren();
    if (qualifies) {
      const form = document.createElement('form');
      const label = document.createElement('label');
      label.htmlFor = 'initials';
      label.textContent = 'ENTER INITIALS';
      const input = document.createElement('input');
      input.id = 'initials';
      input.name = 'initials';
      input.maxLength = 3;
      input.value = 'AAA';
      input.autocomplete = 'off';
      input.autocapitalize = 'characters';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Three letter initials');
      input.addEventListener('input', () => {
        input.value = input.value
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 3);
      });
      const button = document.createElement('button');
      button.className = 'secondary-button';
      button.type = 'submit';
      button.setAttribute('aria-label', 'SAVE SCORE');
      button.innerHTML = pixelLabel('SAVE SCORE', this.currentTheme);
      form.append(label, input, button);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit(this.initials());
      });
      entry.append(form);
    }
    const table = document.createElement('div');
    table.className = 'score-table';
    table.setAttribute('aria-label', 'Local top five scores');
    for (const [index, score] of scores.entries()) {
      const name = document.createElement('span');
      name.textContent = `${index + 1}. ${score.initials}`;
      const value = document.createElement('strong');
      value.textContent = String(score.score).padStart(6, '0');
      table.append(name, value);
    }
    entry.append(table);
  }

  refresh(): void {
    this.lastPhase = null;
  }

  debug(text: string): void {
    this.status.textContent = text;
  }

  error(message: string): void {
    this.overlay.classList.add('visible');
    this.overlay.innerHTML = `<div class="menu"><h2>DISPLAY UNAVAILABLE</h2><p class="display-error"></p></div>`;
    const text = this.overlay.querySelector('.display-error');
    if (text) text.textContent = message;
  }
}

function required(host: HTMLElement, selector: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing interface element ${selector}`);
  return element;
}
