import type { DeepReadonly, GameEvent, GameState } from '../core/types';

export type ThemeId = 'retro' | 'modern';

export interface RenderOptions {
  reducedMotion: boolean;
  debugHitboxes: boolean;
  dimmed: boolean;
}

export interface ThemeRenderer {
  readonly id: ThemeId;
  render(
    state: DeepReadonly<GameState>,
    events: readonly GameEvent[],
    alpha: number,
    options: RenderOptions,
  ): void;
  resize(width: number, height: number, pixelRatio: number): void;
  destroy(): void;
}

export interface ThemePalette {
  background: number;
  foreground: number;
  accent: number;
  danger: number;
  fuel: number;
}
