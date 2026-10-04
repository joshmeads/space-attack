import { CONFIG } from "./config";
import type { Difficulty } from "./types";

const difficulties = new Map<number, Difficulty>();

export function getDifficulty(wave: number): Difficulty {
  const level = Math.min(99, Math.max(0, Math.floor(wave) - 1));
  const cached = difficulties.get(level);
  if (cached) return cached;
  const difficulty: Difficulty = Object.freeze({
    formationSpeed: Math.min(0.7, CONFIG.baseFormationSpeed + level * 0.025),
    diveSpeed: Math.min(2.8, CONFIG.baseDiveSpeed + level * 0.12),
    diveHorizontalSpeed: Math.min(1.8, CONFIG.baseDiveHorizontalSpeed + level * 0.055),
    diveInterval: Math.max(
      CONFIG.minimumDiveInterval,
      Math.round(CONFIG.baseDiveInterval * 0.91 ** level),
    ),
    maxDivers: Math.min(CONFIG.maximumDivers, CONFIG.baseMaxDivers + Math.floor(level / 2)),
    enemyFireInterval: Math.max(
      CONFIG.minimumEnemyFireInterval,
      CONFIG.baseEnemyFireInterval - level,
    ),
    enemyBulletSpeed: Math.min(3.6, CONFIG.baseEnemyBulletSpeed + level * 0.075),
  });
  difficulties.set(level, difficulty);
  return difficulty;
}
