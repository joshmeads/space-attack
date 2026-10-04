import { expect, test, type Page } from '@playwright/test';
import { GamePhase, type GameState } from '../../src/core/types';

const snapshot = (page: Page) => page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');
const runKey = 'space-attack.run.v1';

test('resume preserves the run and preferences while demo stays separate', async ({ page }) => {
  await page.goto('?debug=1&seed=1982');
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Playing);
  await page.keyboard.down('a');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(145);
  await page.keyboard.up('a');
  await page.keyboard.press('p');
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Paused);
  await page.keyboard.press('m');
  await page.keyboard.press('n');
  const saved = await snapshot(page);
  await page.reload();
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Paused);
  expect(await snapshot(page)).toEqual(saved);
  await expect(page.getByRole('button', { name: /music off/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /sound fx off/i })).toBeVisible();
  const beforeDemo = await page.evaluate((key) => localStorage.getItem(key), runKey);
  await page.goto('?demo=1&debug=1&seed=87');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await page.evaluate((key) => localStorage.getItem(key), runKey)).toBe(beforeDemo);
  await page.goto('?debug=1');
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Paused);
  expect(await snapshot(page)).toEqual(saved);
  const newGame = page.getByRole('button', { name: /new game/i });
  await newGame.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Playing);
  expect((await snapshot(page)).wave).toBe(1);
  expect((await snapshot(page)).score).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Paused);
});

test('touch controls and the full cabinet fit on a narrow mobile screen', async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('?debug=1&seed=1982');
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await page.getByRole('button', { name: /new game/i }).tap();
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Playing);
  const left = page.getByRole('button', { name: 'Move left', exact: true });
  const fire = page.getByRole('button', { name: 'Fire', exact: true });
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  for (const control of [left, fire, pause]) await expect(control).toBeInViewport();
  const box = await left.boundingBox();
  if (!box) throw new Error('Touch control has no rendered bounds');
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(140);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause.tap();
  await expect.poll(async () => (await snapshot(page)).phase).toBe(GamePhase.Paused);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('mobile-pause.png') });
  await context.close();
});
