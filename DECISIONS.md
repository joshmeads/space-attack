# Decisions

| Decision                                                                         | Reason                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Use a 320 by 240 logical playfield and 60 Hz simulation.                         | It keeps deterministic geometry and desktop CRT proportions.                       |
| Keep a mutable, serializable core state behind deeply readonly theme interfaces. | Fixed pools avoid bullet churn while renderer types enforce ownership.             |
| Store the uint32 RNG and all simulation timers in each save.                     | Continuing a save must preserve the same future inputs and outcomes.               |
| Use localStorage only with independent run, preference and score entries.        | The user explicitly removed IndexedDB and prioritizes synchronous lifecycle saves. |
| Count lives as total ships remaining including the current ship.                 | Three starting lives therefore permit three deaths.                                |
| Award one extra life when the score first crosses 5000.                          | The request specifies a single bonus threshold.                                    |
| Initial release used 36 enemies; the current formation has 41.                   | The later reference-guided six-row pyramid supersedes the initial formation.       |
| Default fuel drains by three of 100 units every two active seconds.              | This creates visible retro chunks and about 68 seconds to clear a wave.            |
| Freeze core simulation for three ticks on a kill.                                | Hit-stop is deterministic and independent of theme.                                |
| Keep title and benchmark simulations separate from the player run.               | Attract play must never overwrite a save or produce a leaderboard result.          |
| Require WebGL 2 and leave WebGPU disabled behind a feature flag.                 | This follows the initial compatibility target.                                     |
| Gate each release tier before the next.                                          | Tier 1 must deploy before saves, audio or the modern theme can delay it.           |

## Tier gates

- Tier 1 acceptance requires retro gameplay, keyboard input, accurate HUD, progression, screens, CI and a working GitHub Pages deployment.
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

## Tier 1 verification

The integration build at e1345cd passed all 34 core tests, including frozen full-state/event replay digests and snapshot continuation. A natural seeded AI run destroyed 108 enemies across three formations, reached wave four and then game over through neutral input. This run used no debug skips or invulnerability.

Chromium browser QA verified the actual WebGL 2 context, keyboard movement and firing, accurate HUD, pause/continue, three debug wave transitions, game over and a fresh restart with no page exceptions. A separate browser playtest confirmed three shot kills, diving enemies, enemy fire and a real respawn that spent one life and refilled fuel. Formatting, lint, type checks and production build passed. Tier 1 remains active until GitHub CI and live deployment are confirmed.

## Tier 1 deployed; Tier 2 active

GitHub Actions run 37184689147 completed validation and deployment successfully. An independent public-site playtest confirmed HTTP 200 for the page and all nine assets, a real WebGL 2 context, keyboard play, 290 points from eight kills, enemy dives, three lives and no browser errors. The live URL is https://joshmeads.github.io/space-attack/. Tier 1 is accepted and Tier 2 is now active.

The requested tighter formation is approved at startX 83, horizontal spacing 22 and vertical spacing 15, retaining startY 42. Eight columns remain centered at x=160 and safely inside both edges throughout drift. The fuel strip will be continuous while core fuel still drains in chunks. This intentional gameplay geometry change requires reviewing and replacing the replay baseline. The public before image is retained outside the repository at /tmp/space-attack-playtest-live-before-playing.png.

## Classic default and common layout

The user expanded the scope to three themes and selected Classic as the default. This supersedes the original two-theme limit. The surrounding cabinet, header, footer and control captions will be removed for all themes; menus remain inside the bare 4:3 game.

Reference Photo 2 shows a complete pyramid of 41 enemies: 2 yellow flagships, 5 red enemies, 7 green enemies, then three rows of 9 red enemies. Every theme will use the same core slot layout, centered at x=160 with 18-pixel column spacing and 11-pixel row spacing. New art remains original and generated from source.

Legacy version-1 saves keep their existing 36-slot formation and positions until the next wave. Hydration accepts either complete slot layout, rather than changing collision positions during loading or theme switching. New preferences default to Classic; explicitly saved Retro or Modern choices remain valid.

## Player firing cadence

The user requested evenly spaced fire derived from the maximum of two active player shots. A shot starts at y=205.5 and leaves strictly below y=-3 at 4.5 pixels per simulation tick. The minimum exit tick is floor(208.5 / 4.5) + 1 = 47. Dividing that lifetime between two slots gives ceil(47 / 2) = 24 ticks, or 400 ms at 60 Hz. Hits and bullet cancellations free slots without bypassing that cooldown. This intentionally changes the replay baseline; presentation size and theme have no effect on cadence.

The user then requested an editable 400 ms setting. `CONFIG.playerFireIntervalMs` is authoritative; `PLAYER_FIRE_INTERVAL_TICKS = ceil(ms * tickRate / 1000)` derives the 24-tick default. This retains the approved default spacing while keeping tuning in one value. The user also removed all slogans and decorative wording; remaining copy identifies game state, controls or actions.

## Tier 2 accepted; Tier 3 integration

GitHub Actions run 37185374820 passed validation and Pages deployment. The public index and all eight preloaded assets matched the tested Tier 2 build byte for byte. The Tier 2 gate included 42 unit tests, three browser tests, exact save continuation, touch controls, high-score entry, gesture-only audio loading and desktop/mobile visual checks. Tier 3 is now active; its implementation is integrated while the expanded Classic scope undergoes final combined QA.

## Consolidated implementation decisions

- Core uses xorshift32 and stores its RNG state. Bullet pools and event buffers are reused. Death clears bullets and returns surviving divers to their stored formation slots. Wave-one flagship groups respect the smaller concurrency limit; later waves permit both escorts. Final-wave kills enter the banner before fuel depletion can take another life.
- Hydration accepts only complete supported formations and validates IDs, home positions, finite coordinates, bounded timers, lives and bullet pools. Both original and compact 36-enemy saves retain their exact state until the next wave creates 41 enemies. Preferences and top-five scores use independent entries, and storage errors do not stop play.
- Classic uses original generated monochrome grids and angular glyphs. Retro and Modern retain distinct six-row catalogues, including the added blue Raider. All themes use shared core positions and HUD anchors. The disabled WebGPU flag fails explicitly before canvas allocation if enabled; every shipped renderer requires an actual WebGL 2 context.
- Tone and ZZFX load after a gesture unlocks a shared native AudioContext. Original loops are Signal Watch, Orbital Patrol and Afterburn Horizon. Synth sets and zero-randomness effect buffers are cached. Music and effects have separate buses; Classic and Retro pause immediately, Modern fades over 120 ms. Demo events never enter player audio.
- Benchmark measures visible RAF intervals, not renderer CPU duration. A 3600-sample ring provides recent mean and percentiles; totals and estimated dropped frames span the run. Hidden-tab gaps are excluded. Dropped frames are an estimate against 60 Hz, not a hardware measurement.
- The final 400 ms cadence intentionally changes the replay digest. The frozen seed-1982 replay ends with 890 points and 27 kills. A natural AI run with seed 123 destroyed 123 enemies across three complete waves, entered wave four at input tick 8237 with 5050 points and four lives, then reached game over after 1415 idle ticks. Seed 1982 now dies during wave three; no other balance setting was changed to conceal that result. All 41 core tests passed before final combined verification.

## Latest presentation and hosting instructions

All themes fill the same maximum available 4:3 area. Classic and Retro keep their 320 by 240 nearest-neighbor raster and may scale by a fractional CSS factor; Modern uses a full-resolution buffer inside identical bounds. This user instruction supersedes the earlier whole-number-only display rule. Outer chrome and slogans are removed. Generated pixel labels identify pause actions, M/N hints align in settings rows, and R starts a fresh state only while paused.

Codex Sites is now the requested primary host, with GitHub Pages retained. Final publication remains a release gate. Sites verification uses the terminal successful native deployment result and returned URL, following its hosting workflow; GitHub Pages retains public browser verification. Chromium rendering and generated audio have runtime evidence. WebKit could not launch on this Arch host because required system libraries were absent; physical iOS Safari playback remains unverified.

The Sites build uses `bun run build:sites`, which overrides the asset base to `/`. The ordinary build retains `/space-attack/` for GitHub Pages. Both produce `dist`; deployment must build for its target immediately before upload. The Sites project is registered at https://space-attack.secretmoose.chatgpt.site; registration alone is not proof of a working deployment.

## Final combined acceptance

The combined integration passes 52 unit tests and six Playwright tests. Browser checks verify the maximum fitted 4:3 bounds, including 390 by 292.5 on mobile, equal bounds across all three cached renderers, exact paused-state continuity, the shared 41-enemy pyramid, functional pixel menus, aligned M/N hints and pause-only R restart. The fuel strip has no separators. The natural seed-123 progression and 123 kills are separate core evidence; browser wave-transition checks use explicit debug inputs to keep the release gate short.

Periodic player saves use a four-second interval scheduled during browser idle. A qualifying unfinished initials entry defaults to AAA if a new run begins. Query-selected themes override preferences. Renderer creation is cached; a failure during a theme switch retains the active renderer. Debug snapshots are clones, and neutral tick advancement calls the core without directly mutating its fields.

The checked-in replay fixture stores SHA-256 full-state and event digests at five checkpoints across 3600 seed-1982 input frames. Geometry and cadence changes deliberately refreshed these reviewed checkpoints. Earlier worker fragments describe superseded sizing and formation choices; their material decisions are consolidated here and their redundant files are removed. Temporary screenshots and traces remain outside the repository.

Codex Sites reported terminal deployment success for source 24246a3, version 1, deployment appgdep_6ac2078d08f88191956ea960d0c791fc, at https://space-attack.secretmoose.chatgpt.site. The archive SHA-256 is f2a329b2810ad412c8757d01ef1c5f821cb4ffdbb9ff2874738777592c7c0edb. This is native publication evidence; no deployed-site fetch was performed. This Sites source and the final Pages source contain the same application code.

The immutable production build from 24246a3 passed all six browser tests in 10.9 seconds. Normal play, all three themes, pause, audio toggles, resume, R restart, game over and initials entry produced zero console messages, warnings or errors. The audit confirmed three cached canvases, a cleared finished save, continuous fuel, shared full-fit menus, and 24-tick minimum firing without hit-reset bypass. The independent natural run entered wave four at tick 8237 and game over at tick 9652 after 123 kills. The root-base production index SHA-256 was 2d8ae3607c3b1f1baf906ec7033d06df80cb3765b47f1998d25832ca701f927c. The later final-main and public Pages results are recorded below.

Final main CI run 37187754244 succeeded at 6472e8b. Public GitHub Pages QA confirmed actual WebGL 2, Classic's 41-enemy formation, shot gaps of at least 24 simulation ticks, exact state preservation and equal bounds across all themes, a 390 by 292.5 mobile field, pause-only R restart and zero console errors. The user's later README request adds direct demo, benchmark and debug links, query examples, seed behavior and the developer-console snapshot APIs. This documentation-only update does not change gameplay. The reported title-action alignment was assessed without a UI edit, as requested by the assessment-only task boundary.

All three tiers and the expanded Classic scope are accepted. Sites source 24246a3 and Pages source 6472e8b contain identical application code, with native Sites success and passing Pages CI/public QA. Documentation updates do not require reopening the gameplay acceptance gate.
