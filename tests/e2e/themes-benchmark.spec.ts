import { expect, test } from '@playwright/test';
import { GamePhase, type GameState } from '../../src/core/types';

test('theme changes preserve a paused run and benchmark leaves its save intact', async ({
  page,
}) => {
  await page.goto('?debug=1&seed=78');
  await page.waitForFunction('Boolean(window.__SPACE_ATTACK__)');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate<string>('window.__SPACE_ATTACK__.snapshot().phase'))
    .toBe(GamePhase.Playing);
  await page.keyboard.press('p');
  await expect
    .poll(() => page.evaluate<string>('window.__SPACE_ATTACK__.snapshot().phase'))
    .toBe(GamePhase.Paused);
  const paused = await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()');
  const initialBounds = await page.locator('canvas:visible').boundingBox();
  for (const theme of ['RETRO', 'MODERN', 'CLASSIC']) {
    const picker = page.getByRole('button', { name: theme, exact: true });
    await picker.focus();
    await page.keyboard.press('Enter');
    await expect(picker).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate<GameState>('window.__SPACE_ATTACK__.snapshot()')).toEqual(paused);
    expect(await page.locator('canvas:visible').boundingBox()).toEqual(initialBounds);
  }
  await expect(page.locator('canvas')).toHaveCount(3);
  const saved = await page.evaluate(() => localStorage.getItem('space-attack.run.v1'));
  await page.goto('?benchmark=1&seed=78&theme=modern');
  await page.waitForFunction('window.__SPACE_ATTACK_BENCHMARK__?.snapshot().sampleCount >= 30');
  const report = await page.evaluate<{
    seed: number;
    theme: string;
    renderer: string;
    width: number;
    height: number;
    averageMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    estimatedDroppedFrames: number;
  }>('window.__SPACE_ATTACK_BENCHMARK__.snapshot()');
  expect(report.seed).toBe(78);
  expect(report.theme).toBe('modern');
  expect(report.renderer).toBe('webgl2');
  expect(report.width).toBeGreaterThan(0);
  expect(report.height).toBeGreaterThan(0);
  expect(report.averageMs).toBeGreaterThan(0);
  expect(report.p95Ms).toBeGreaterThanOrEqual(report.p50Ms);
  expect(report.p99Ms).toBeGreaterThanOrEqual(report.p95Ms);
  expect(report.estimatedDroppedFrames).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => localStorage.getItem('space-attack.run.v1'))).toBe(saved);
});
