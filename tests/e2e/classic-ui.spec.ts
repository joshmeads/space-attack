import { expect, test } from '@playwright/test';
import { GamePhase, type GameState } from '../../src/core/types';

test('Classic starts with the shared pyramid and pause shortcuts use the compact pixel menu', async ({
  page,
}) => {
  await page.goto('?debug=1&seed=1982');
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await expect(page.getByRole('button', { name: 'CLASSIC', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move left', exact: true })).not.toBeVisible();
  await expect(page.locator('body')).not.toContainText('FLIGHT SYSTEM');
  await expect(page.locator('body')).not.toContainText('OWN THE SKY');
  const bounds = await page.locator('canvas:visible').boundingBox();
  if (!bounds) throw new Error('The playfield has no rendered bounds');
  expect(bounds.width / bounds.height).toBeCloseTo(4 / 3, 5);
  const initial = await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');
  expect(initial.enemies).toHaveLength(41);
  expect(
    Array.from(
      { length: 6 },
      (_, row) => initial.enemies.filter((enemy) => enemy.row === row).length,
    ),
  ).toEqual([2, 5, 7, 9, 9, 9]);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate<string>('window.__SPACE_ATTACK__.snapshot().phase'))
    .toBe(GamePhase.Playing);
  await page.evaluate('window.__SPACE_ATTACK__.invulnerable(true)');
  await page.evaluate('window.__SPACE_ATTACK__.advance(300)');
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'PAUSED', exact: true }).locator('svg'),
  ).toBeVisible();
  for (const name of ['CONTINUE', 'NEW GAME']) {
    await expect(page.getByRole('button', { name, exact: true }).locator('svg')).toBeVisible();
  }
  await expect(page.locator('.pause-menu')).not.toContainText('↗');
  const music = await page.getByTestId('music-hotkey').boundingBox();
  const sfx = await page.getByTestId('sfx-hotkey').boundingBox();
  if (!music || !sfx) throw new Error('Audio shortcuts have no rendered bounds');
  expect(music.x + music.width / 2).toBeCloseTo(sfx.x + sfx.width / 2, 1);
  const paused = await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: /sound fx off/i })).toBeVisible();
  expect(await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()')).toEqual(paused);
  await page.keyboard.press('r');
  await expect
    .poll(() => page.evaluate<string>('window.__SPACE_ATTACK__.snapshot().phase'))
    .toBe(GamePhase.Playing);
  const fresh = await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');
  expect(fresh.tick).toBeLessThan(paused.tick);
  expect(fresh.wave).toBe(1);
  expect(fresh.score).toBe(0);
  expect(fresh.lives).toBe(3);
});
