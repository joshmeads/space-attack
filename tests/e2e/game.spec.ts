import { expect, test, type Page } from '@playwright/test';
import { GamePhase, type GameState } from '../../src/core/types';

const snapshot = (page: Page) => page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');

async function phase(page: Page, expected: GamePhase, timeout = 10_000) {
  await expect.poll(async () => (await snapshot(page)).phase, { timeout }).toBe(expected);
}

test('keyboard controls, WebGL 2, three waves, and game over', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('?debug=1&seed=123');
  await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  expect(
    await page.locator('canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      return canvas.getContext('webgl2') instanceof WebGL2RenderingContext;
    }),
  ).toBe(true);
  await page.keyboard.press('Enter');
  await phase(page, GamePhase.Playing);
  await page.evaluate('window.__SPACE_ATTACK__.invulnerable(true)');
  const start = await snapshot(page);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.player.x - 10);
  await page.keyboard.up('ArrowLeft');
  const left = await snapshot(page);
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(left.player.x + 10);
  await page.keyboard.up('d');
  await page.keyboard.down('Space');
  await expect
    .poll(async () => (await snapshot(page)).playerBullets.filter((bullet) => bullet.active).length)
    .toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.keyboard.press('p');
  await phase(page, GamePhase.Paused);
  const paused = await snapshot(page);
  await page.waitForTimeout(150);
  const stillPaused = await snapshot(page);
  expect(stillPaused.player).toEqual(paused.player);
  expect(stillPaused.fuel).toBe(paused.fuel);
  expect(stillPaused.enemies).toEqual(paused.enemies);
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await phase(page, GamePhase.Playing);
  for (let wave = 2; wave <= 4; wave += 1) {
    await page.evaluate('window.__SPACE_ATTACK__.skipWave()');
    await expect.poll(async () => (await snapshot(page)).wave).toBe(wave);
    await phase(page, GamePhase.Playing);
  }
  await page.evaluate('window.__SPACE_ATTACK__.invulnerable(false)');
  await phase(page, GamePhase.GameOver, 140_000);
  expect((await snapshot(page)).lives).toBe(0);
  await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
  await page.keyboard.press('Enter');
  await phase(page, GamePhase.Playing);
  const fresh = await snapshot(page);
  expect(fresh.wave).toBe(1);
  expect(fresh.score).toBe(0);
  expect(fresh.lives).toBe(3);
  expect(errors).toEqual([]);
});
