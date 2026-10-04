import { CONFIG } from './config';
import { EnemyKind, EnemyMode, type EnemyState } from './types';

const ROW_KINDS: readonly EnemyKind[] = [
  EnemyKind.Flagship,
  EnemyKind.Scout,
  EnemyKind.Striker,
  EnemyKind.Drone,
  EnemyKind.Drone,
];

export function createFormation(): EnemyState[] {
  const enemies: EnemyState[] = [];
  for (let row = 0; row < CONFIG.rows; row += 1) {
    for (let column = 0; column < CONFIG.columns; column += 1) {
      if (row === 0 && (column < 2 || column > 5)) continue;
      const x = CONFIG.formationStartX + column * CONFIG.formationSpacingX;
      const y = CONFIG.formationStartY + row * CONFIG.formationSpacingY;
      enemies.push({
        id: row * CONFIG.columns + column,
        row,
        column,
        kind: ROW_KINDS[row] ?? EnemyKind.Drone,
        mode: EnemyMode.Formation,
        homeX: x,
        homeY: y,
        x,
        y,
        direction: 0,
        steerCooldown: 0,
        fireCooldown: 0,
        diveGroup: 0,
      });
    }
  }
  return enemies;
}
