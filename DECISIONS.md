# Decisions

| Decision                                                                         | Reason                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Use a 320 by 240 logical playfield and 60 Hz simulation.                         | It supports crisp integer scaling and a desktop CRT proportions.                   |
| Keep a mutable, serializable core state behind deeply readonly theme interfaces. | Fixed pools avoid bullet churn while renderer types enforce ownership.             |
| Store the uint32 RNG and all simulation timers in each save.                     | Continuing a save must preserve the same future inputs and outcomes.               |
| Use localStorage only with independent run, preference and score entries.        | The user explicitly removed IndexedDB and prioritizes synchronous lifecycle saves. |
| Count lives as total ships remaining including the current ship.                 | Three starting lives therefore permit three deaths.                                |
| Award one extra life when the score first crosses 5000.                          | The request specifies a single bonus threshold.                                    |
| Start with 36 enemies: four central flagships and four rows of eight.            | This fits the 4:3 playfield and keeps flagship groups distinct.                    |
| Default fuel drains by three of 100 units every two active seconds.              | This creates visible retro chunks and about 68 seconds to clear a wave.            |
| Freeze core simulation for three ticks on a kill.                                | Hit-stop is deterministic and independent of theme.                                |
| Keep title and benchmark simulations separate from the player run.               | Attract play must never overwrite a save or produce a leaderboard result.          |
| Require WebGL 2 and leave WebGPU disabled behind a feature flag.                 | This follows the initial compatibility target.                                     |
| Gate each release tier before the next.                                          | Tier 1 must deploy before saves, audio or the modern theme can delay it.           |

## Tier gates

- Tier 1 is active. Acceptance requires retro gameplay, keyboard input, accurate HUD, progression, screens, CI and a working GitHub Pages deployment.
- Tier 2 begins after Tier 1 acceptance. Its gate covers saves, touch, audio, high scores, visual feedback and the title demo.
- Tier 3 begins after Tier 2 acceptance. Its gate covers benchmark reporting and the modern theme without regressions in earlier tiers.

- Pin Vite+ 1.0.0 and its Bun-compatible direct Vite alias together; pin bundled Vitest 5.0.1 through overrides so tool internals share one instance.
- Use Bun 1.4.2 for dependency installation and scripts, Node 26 for the Vite+ toolchain and CI runtime.
- Keep formatting, linting, type checking and unit-test configuration in vite.config.ts. Enable type-aware linting and type checking in vp check.
- Use a strict TypeScript configuration with noUncheckedIndexedAccess to catch pooled-state and sprite-grid indexing mistakes.
- Build with /space-attack/ as the GitHub Pages base. CI validates pull requests and main before deploying main through the standard Pages artifact actions.
- Playwright uses Chromium with ANGLE SwiftShader to exercise WebGL 2 consistently on headless CI.
- Manually author the small Vite+ application configuration rather than scaffold into the existing repository because parallel workers own the original application and architecture files.
- Pin current verified package releases: pixi.js 8.22.0, pixi-filters 6.1.5, Tone.js 15.1.22, ZZFX 1.4.0, Playwright 1.63.0, TypeScript 7.0.2 and Node types 26.6.4.

# Retro art decisions

- All sprites and the 5 by 7 uppercase font are original TypeScript character grids. No image, font, or audio files are added.
- A 320 by 240 logical canvas uses 13 by 11 ship and enemy cells, with a 15 by 11 flagship. Transparent padding keeps animation anchors stable.
- Enemy silhouettes and palettes both identify rows. The red flagship has a crown shape, the violet scout has antennae, the cyan striker has swept wings, and the mint drone has a rounded body.
- Enemy grids share P, S, and H color keys so each row palette can be swapped without generating different geometry. Each enemy and ship direction has two idle frames.
- Player lean frames redraw the ship on a fixed grid. The renderer must not rotate the sprite or alter core hitboxes and firing direction.
- The restrained palette uses an ink background, amber titles, cream text and player hull, and cyan exhaust. Font pixels use # and transparent pixels use a period.
- The fifth formation row uses an amber manta with upward-curving wings and a narrow tail. It keeps the core drone kind; row 4 selects its separate visual catalog entry.

## Repository publication

GitHub returned HTTP 422 when enabling Pages on the private repository because the account plan does not support it. Applied the user-approved public repository fallback and enabled workflow-based Pages. GitHub blocked the first push under email privacy protection; all unpublished initial commits were rewritten with the account noreply address before publication.
