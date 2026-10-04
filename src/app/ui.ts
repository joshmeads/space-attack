import { GamePhase, type GameState } from '../core/types';
import type { ThemeId } from '../themes/types';
import type { HighScore } from '../platform/storage';
import type { MenuAction } from './input';

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

  constructor(host: HTMLElement, onAction: (action: MenuAction) => void) {
    host.innerHTML = `<main class="cabinet"><header class="masthead"><a class="brand" href="./" aria-label="Space Attack home"><span class="brand-mark">✦</span> SPACE ATTACK</a><span class="edition">ORIGINAL ARCADE · 01</span></header><section class="machine" aria-label="Space Attack arcade game"><div class="machine-top"><span class="ready-light"></span><span>FLIGHT SYSTEM ONLINE</span><span class="machine-label">SA—1982 / REIMAGINED</span></div><div class="display"><div class="stage" id="game-stage"></div><div class="hud-top"><div><span class="hud-label">SCORE</span><strong id="score" data-testid="score">000000</strong></div><div class="hud-wave"><span class="hud-label">WAVE</span><strong id="wave" data-testid="wave">01</strong></div><div class="hud-best"><span class="hud-label">HI SCORE</span><strong id="best">000000</strong></div></div><div class="hud-bottom"><div class="fuel-group"><span class="hud-label">FUEL</span><div class="fuel-track"><div id="fuel" data-testid="fuel"></div></div></div><div class="lives-group"><span class="hud-label">SHIPS</span><strong id="lives" data-testid="lives">▲ ▲ ▲</strong></div></div><div class="screen-overlay" id="screen-overlay"></div><div class="scanlines" aria-hidden="true"></div><div class="debug-status" id="debug-status"></div></div><div class="touch-controls"><div class="touch-steering"><button class="touch-button" data-touch="left" aria-label="Move left">◀</button><button class="touch-button" data-touch="right" aria-label="Move right">▶</button></div><button class="touch-button touch-pause" data-action="pause" aria-label="Pause">Ⅱ</button><button class="touch-button touch-fire" data-touch="fire" aria-label="Fire">FIRE</button></div><div class="machine-bottom"><span>AD / ← → MOVE</span><span>W / ↑ / SPACE FIRE</span><span>P / ESC PAUSE</span></div></section><footer class="footer"><span>ONE SHIP. AN ENTIRE SKY.</span><span>NO COINS REQUIRED <span class="footer-star">✦</span></span></footer></main>`;
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
        action === 'theme'
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
    modernAvailable: boolean,
    audioAvailable = false,
    theme: ThemeId = 'retro',
  ): void {
    this.score.textContent = String(state.score).padStart(6, '0');
    this.best.textContent = String(previousBest).padStart(6, '0');
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
    switch (state.phase) {
      case GamePhase.Title:
      case GamePhase.Screensaver:
        this.overlay.innerHTML = `<div class="menu title-menu"><div class="eyebrow">YOUR NEXT HIGH SCORE STARTS HERE</div><h1><span>SPACE</span><span>ATTACK<span class="title-star">✦</span></span></h1><p class="tagline">BREAK THE FORMATION. OWN THE SKY.</p><div class="menu-actions"><button class="primary-button" data-action="start">${hasSave ? 'CONTINUE FLIGHT' : 'NEW GAME'} <span>↗</span></button>${hasSave ? '<button class="secondary-button" data-action="title">NEW GAME</button>' : ''}</div><div class="menu-controls"><span><b>← →</b> MOVE</span><span><b>SPACE</b> FIRE</span><span><b>ENTER</b> START</span></div>${modernAvailable ? `<div class="theme-picker"><button data-action="theme">THEME <strong>${theme.toUpperCase()}</strong> <kbd>T</kbd></button></div>` : ''}<div class="menu-footnote">3 SHIPS · BONUS SHIP AT 5,000 · ENDLESS WAVES</div></div>`;
        break;
      case GamePhase.Paused:
        this.overlay.innerHTML = `<div class="menu pause-menu"><div class="eyebrow">FLIGHT ON HOLD</div><h2>PAUSED<span class="title-star">Ⅱ</span></h2><p class="tagline">TAKE A BREATH. THE SKY CAN WAIT.</p><div class="menu-actions"><button class="primary-button" data-action="start">CONTINUE <span>↗</span></button><button class="secondary-button" data-action="title">NEW GAME</button></div>${audioAvailable ? `<div class="settings"><button data-action="music">MUSIC <strong>${music ? 'ON' : 'OFF'}</strong><kbd>M</kbd></button><button data-action="sfx">SOUND FX <strong>${sfx ? 'ON' : 'OFF'}</strong><kbd>N</kbd></button>${modernAvailable ? `<button data-action="theme">THEME <strong>${theme.toUpperCase()}</strong><kbd>T</kbd></button>` : ''}</div>` : ''}<div class="menu-footnote">ENTER TO CONTINUE · P / ESC TO RESUME</div></div>`;
        break;
      case GamePhase.WaveClear:
        this.overlay.innerHTML = `<div class="wave-banner"><div class="eyebrow">FORMATION DESTROYED</div><h2>WAVE ${String(state.wave).padStart(2, '0')} CLEAR</h2><p>REFUELING · NEXT WAVE INBOUND</p></div>`;
        break;
      case GamePhase.GameOver:
        this.overlay.innerHTML = `<div class="menu gameover-menu"><div class="eyebrow">FLIGHT COMPLETE</div><h2>GAME OVER</h2><div class="final-score"><span>YOUR SCORE</span><strong>${String(state.score).padStart(6, '0')}</strong></div><p class="tagline">${state.score > previousBest ? 'A NEW HIGH SCORE. MAKE IT YOURS.' : `PREVIOUS BEST ${String(previousBest).padStart(6, '0')}`}</p><div id="score-entry"></div><div class="menu-actions"><button class="primary-button" data-action="title">PLAY AGAIN <span>↗</span></button></div><div class="menu-footnote">ENTER TO RETURN TO FLIGHT</div></div>`;
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
      label.textContent = 'TOP 5 PILOT · ENTER INITIALS';
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
      button.textContent = 'SAVE SCORE';
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
    this.overlay.innerHTML = `<div class="menu"><div class="eyebrow">FLIGHT SYSTEM</div><h2>DISPLAY UNAVAILABLE</h2><p class="tagline"></p></div>`;
    const text = this.overlay.querySelector('.tagline');
    if (text) text.textContent = message;
  }
}

function required(host: HTMLElement, selector: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing interface element ${selector}`);
  return element;
}
