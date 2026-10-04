import { defineConfig } from 'vite-plus';

export default defineConfig({
  base: '/space-attack/',
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { target: 'es2022' },
  test: {
    include: ['src/**/*.test.ts', 'tests/core/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'playwright-report/**', 'test-results/**'],
    options: { typeAware: true, typeCheck: true },
    rules: { 'no-console': 'error' },
    overrides: [
      {
        files: ['src/core/**/*.ts'],
        rules: {
          'no-restricted-globals': ['error', 'Date', 'window', 'document', 'performance'],
          'no-restricted-properties': ['error', { object: 'Math', property: 'random' }],
          'no-restricted-imports': [
            'error',
            { patterns: ['pixi.js', 'pixi-filters', 'tone', 'zzfx', 'node:*'] },
          ],
        },
      },
      { files: ['src/app/benchmark.ts'], rules: { 'no-console': 'off' } },
    ],
  },
  fmt: {
    singleQuote: true,
    ignorePatterns: ['dist/**', 'playwright-report/**', 'test-results/**', 'bun.lock'],
  },
});
