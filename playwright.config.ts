import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173/space-attack/',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: [
        '--enable-webgl',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://127.0.0.1:5173/space-attack/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
