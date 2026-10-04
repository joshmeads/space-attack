# Space Attack

[Play on Codex Sites](https://space-attack.secretmoose.chatgpt.site) · [GitHub Pages mirror](https://joshmeads.github.io/space-attack/)

A browser arcade shooter inspired by Galaxian and the 1982 Emerson Arcadia 2001 game. All sprites, fonts, backgrounds, music and effects are generated from TypeScript. There are no binary assets or backend.

Clear the formation before fuel runs out. Detached enemies dive toward your ship and shoot while descending. Player shots hit enemies and cancel their bullets. Shots fire every **400 ms**, with at most two active; `CONFIG.playerFireIntervalMs` controls the interval independently of display size.

You start with three lives and earn one extra at 5,000 points. Hits, crashes and empty fuel cost a life. Respawning refills fuel and grants two seconds of protection. Every cleared wave refills fuel and increases difficulty. The continuous fuel strip depletes in discrete chunks.

| Action                | Keyboard                 |
| --------------------- | ------------------------ |
| Move                  | A/D or left/right arrows |
| Fire                  | W, up arrow or Space     |
| Start or continue     | Enter                    |
| Pause or resume       | P or Escape              |
| New game while paused | R                        |
| Switch theme          | T                        |
| Toggle music          | M                        |
| Toggle sound effects  | N                        |

Touch devices have movement, fire and pause controls. Menus also support keyboard focus.

**Classic** is the default, with reference-inspired colors and compact formation spacing. **Retro** has more detailed pixel sprites. **Modern** uses neon vectors and Pixi filters. Every theme shares the same 41-enemy formation, HUD, hitboxes and full-size 4:3 layout. Switching themes preserves the current round. Classic and Retro use a 320×240 nearest-pixel buffer scaled to the same display area as Modern.

The game pauses on lost focus or a hidden tab. The complete run, including seeded RNG state, saves at wave starts, on pause and page hide, and periodically during idle time. Refresh restores a paused run. New game creates a fresh state object; game over removes the saved run. Preferences and the top five scores use separate localStorage items. Qualifying scores accept three-character initials.

Generated audio loads after the first keyboard or touch gesture. Music and effects have separate toggles. The title has a silent demo on an independent core and enters screensaver mode after ten idle seconds.

## Modes

Open [demo mode](https://space-attack.secretmoose.chatgpt.site/?demo=1&seed=123), [benchmark mode](https://space-attack.secretmoose.chatgpt.site/?benchmark=1&seed=123), or [debug mode](https://space-attack.secretmoose.chatgpt.site/?debug=1&seed=123). You can also append these parameters to the Pages or local dev URL. Remove them to return to normal play.

| Query                                             | Behavior                                                  |
| ------------------------------------------------- | --------------------------------------------------------- |
| `?seed=123`                                       | Choose the seed for a new game and demo                   |
| `?demo=1&seed=123`                                | Repeatable autonomous demo                                |
| `?benchmark=1&seed=123`                           | Autonomous renderer frame timing report                   |
| `?debug=1`                                        | Hitboxes, FPS, I for invulnerability and K to skip a wave |
| `?theme=classic`, `?theme=retro`, `?theme=modern` | Select the initial theme                                  |

Demo plays automatically, restarts after game over and stays silent. Benchmark uses the same independent AI simulation and shows a timing overlay. Neither mode changes your saved run, preferences or high scores. Keep the tab visible while measuring.

Use the same seed, theme and window size when comparing benchmark runs, for example `?benchmark=1&seed=123&theme=retro`. The default seed is `1982`; a seed reproduces simulation decisions, while browser frame timing varies. A loaded save retains its own RNG state until you start a new game. Explicit `theme` parameters take precedence over the saved theme.

Benchmark reports average, p50/p95/p99 and maximum frame intervals, estimated dropped frames, seed, theme, render resolution, pixel ratio, wave and tick. After letting it run, inspect this object in the browser developer console:

```js
window.__SPACE_ATTACK_BENCHMARK__.snapshot();
```

Debug mode adds hitboxes and FPS. Start a game with Enter, press I to toggle invulnerability, and press K to skip a wave. These controls apply to the player run. The debug API also exposes `window.__SPACE_ATTACK__.snapshot()` for inspecting state.

## Develop

Use Bun 1.4.2 and Node 26.

```sh
bun install --frozen-lockfile
bun run dev
```

Open `http://localhost:5183/space-attack/`. The server binds `0.0.0.0` for LAN access.

```sh
bun run check
bun run test
bunx playwright install chromium
bun run test:e2e
bun run build
bun run build:sites
```

Bun and `bun.lock` are the tested default and remain the CI package manager. Other evaluators can use npm, pnpm or Yarn instead. npm is verified on Node 26:

```sh
npm install --no-package-lock
npm run dev
npm run check
npm run test
npm run build
```

pnpm and Yarn provide equivalent `run dev`, `run check`, `run test` and `run build` commands. Their installs are unverified here: translate the Vite/Vitest overrides into pnpm workspace overrides or Yarn resolutions, and adjust the Bun `packageManager` pin in your local copy if your manager enforces it. Follow [Vite Plus package-manager setup](https://viteplus.dev/guide/local-cli). Keep any alternate lockfile local when evaluating.

Vite Plus 1.0 handles development, builds, formatting, linting, type checks and unit tests. The normal build keeps `/space-attack/` for GitHub Pages; `build:sites` uses `/` for Codex Sites. GitHub Actions validates pull requests and main, then deploys passing main builds to the Pages mirror. Codex Sites publication uses the registered project in `.openai/hosting.json`.

## Architecture and verification

`src/core` owns the seeded 60 Hz simulation, transition table, collisions, scoring, lives, fuel, difficulty and hit stops. It has no DOM, Pixi, wall clock or unseeded randomness dependencies. `src/app` handles input, storage, the clamped animation loop and theme selection. Themes read state and events without changing the simulation.

Rendering requires WebGL 2. The shared WebGPU feature flag remains disabled. Tone.js generates music; ZZFX generates effects. Reduced motion disables shake and reduces flashes. Bullets and renderer effects use reusable pools.

The final verification covers 52 unit tests, including collisions, scoring, bonus lives, fuel, progression, save hydration, determinism and a checked-in replay digest. Six Playwright tests cover controls, menus, saves, touch emulation, all three themes, benchmark mode and state continuity. A natural seeded AI run clears three waves with 123 kills, then reaches game over. Chromium desktop and mobile emulation are verified. Physical iOS/Safari rendering and audio remain unverified.

Tier 1 and Tier 2 were deployed separately after passing CI. The final combined release includes all three tiers and the later Classic, pause menu and sizing changes. Contracts and choices are recorded in [PLAN.md](PLAN.md) and [DECISIONS.md](DECISIONS.md).
