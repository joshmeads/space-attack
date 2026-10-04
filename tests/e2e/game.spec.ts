import { expect, test, type Page } from '@playwright/test';
import { GamePhase, type GameState } from '../../src/core/types';

const snapshot = (page: Page) => page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');

async function phase(page: Page, expected: GamePhase, timeout = 10_000) {
  await expect.poll(async () => (await snapshot(page)).phase, { timeout }).toBe(expected);
}

test('keyboard controls, WebGL 2, three waves, and game over', async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('?debug=1&seed=123');
  await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  expect(
    await page.locator('canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext('webgl2');
      return (
        context instanceof WebGL2RenderingContext &&
        String(context.getParameter(context.VERSION)).startsWith('WebGL 2.0')
      );
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
  await expect(page.getByTestId('score')).toHaveText(String(paused.score).padStart(6, '0'));
  await expect(page.getByTestId('wave')).toHaveText(String(paused.wave).padStart(2, '0'));
  await expect(page.getByTestId('fuel')).toHaveAttribute('aria-valuenow', String(paused.fuel));
  await expect(page.getByTestId('lives')).toHaveText('▲ '.repeat(paused.lives).trim());
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await phase(page, GamePhase.Playing);
  for (let wave = 2; wave <= 4; wave += 1) {
    await page.evaluate('window.__SPACE_ATTACK__.skipWave()');
    await expect.poll(async () => (await snapshot(page)).wave).toBe(wave);
    await phase(page, GamePhase.Playing);
  }
  await page.evaluate('window.__SPACE_ATTACK__.invulnerable(false)');
  await page.evaluate('window.__SPACE_ATTACK__.advance(18_000)');
  await phase(page, GamePhase.GameOver);
  expect((await snapshot(page)).lives).toBe(0);
  const playAgain = page.getByRole('button', { name: /play again/i });
  await expect(playAgain).toBeVisible();
  await playAgain.focus();
  await page.keyboard.press('Enter');
  await phase(page, GamePhase.Playing);
  const fresh = await snapshot(page);
  expect(fresh.wave).toBe(1);
  expect(fresh.score).toBe(0);
  expect(fresh.lives).toBe(3);
  expect(errors).toEqual([]);
});
