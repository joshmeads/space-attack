# Space Attack

An original browser arcade shooter inspired by formation shooters of the early 1980s. All game visuals and audio are generated from source.

## Development

Install Bun 1.4.2 and Node 26, then run:

```sh
bun install
bun run dev
```

Open `http://localhost:5173/space-attack/`.

```sh
bun run check
bun run test
bunx playwright install chromium
bun run test:e2e
bun run build
```

Vite+ 1.0 owns development, build, formatting, linting, type checking and unit tests. Playwright exercises the browser with WebGL enabled. Dependencies are pinned in `package.json` and `bun.lock`.

## Deployment

The GitHub Actions workflow validates pushes to `main`, uploads `dist`, and deploys through GitHub Pages. Set the repository's Pages source to **GitHub Actions**. Production paths use `/space-attack/`.

Expected Pages URL: https://joshmeads.github.io/space-attack/.
