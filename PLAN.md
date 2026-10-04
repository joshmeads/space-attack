# Space Attack build contract

Ship Tier 1 first, deploy it, then add Tier 2 and Tier 3 without weakening the earlier gates. The default Classic theme and the retained Retro and Modern themes share a 4:3 arcade shooter with a 320 by 240 logical playfield. All art, fonts and sound are generated from source. Source files contain no code comments. Production code contains no console calls outside explicit benchmark mode.

## Ownership and parallel work

| Unit                     | Owner role                               | Allowed paths                                                                               | Dependencies                   |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| Contracts and acceptance | Astra orchestrator                       | PLAN.md, TASKS.md, DECISIONS.md, src/core/types.ts, src/core/config.ts, src/themes/types.ts | None                           |
| Toolchain and deployment | Sol 6.1                                  | package files, Vite configuration, CI, HTML, README                                         | Contracts                      |
| Simulation               | Sol 6.1                                  | src/core excluding contract files                                                           | Contracts                      |
| Retro art and renderer   | Astra design plus Sol 6.1 implementation | src/themes/retro, src/render                                                                | Contracts                      |
| App and controls         | Sol 6.1                                  | src/app, src/main.ts, src/style.css                                                         | Contracts and renderer         |
| Persistence and demo     | Sol 6.1                                  | src/platform, src/demo                                                                      | Contracts                      |
| Generated audio          | Sol 6.1                                  | src/audio, theme music and sfx files                                                        | Contracts                      |
| Core test suite          | Sol 6.1                                  | tests/core                                                                                  | Core API                       |
| Browser QA               | Astra                                    | tests/e2e, QA evidence                                                                      | Runnable integration           |
| Modern and benchmark     | Sol 6.1                                  | src/themes/modern, src/benchmark                                                            | Tier 1 deployed, Tier 2 stable |

Workers use isolated branches and worktrees. They record tradeoffs in their own decision fragment for integration into DECISIONS.md. Astra reviews each unit before it enters codex/integration. Main contains only runnable checkpoints. Tier 1 release requires lint, formatting, typecheck, core tests, build and a browser playthrough through at least three waves followed by game over.

## Module boundaries and exact interfaces

`src/core` imports no Pixi, DOM, browser APIs, Date or Math.random. `src/core/types.ts` and `config.ts` are the shared source of truth. Core exports `createGame(seed: number): GameState`, `step(state: GameState, input: InputFrame): readonly GameEvent[]`, and `getDifficulty(wave: number): Difficulty` from `src/core/index.ts`. A step advances exactly one 1/60-second tick. Core mutates its own state and returns only the events for that step. Callers consume events before the next step. New game always calls createGame and replaces the old object. Start moves the new object from title to playing.

The app owns requestAnimationFrame, the fixed-step accumulator, input sources, rendering, query parsing, persistence, audio unlock, lifecycle events and theme selection. It clamps elapsed time to 100 ms and limits catch-up to six ticks. Keyboard, touch and AI all produce InputFrame. Input contains actions and never identifies a device. The app can request pause but never directly changes collision or scoring fields. A debug input is explicit and only enabled through the debug query.

Themes receive DeepReadonly<GameState> and deeply readonly events through ThemeRenderer. They cannot mutate state or emit core events. Rendering randomness uses a separate visual seed. Themes cache generated textures and pool transient particles. Theme switching constructs or selects a renderer and keeps the exact current core state and RNG. Theme audio assets remain in each theme directory; shared playback code lives under src/audio.

## State and transitions

GamePhase is a plain enum. TRANSITIONS is the sole permitted transition table. Title idles into Screensaver after 600 ticks; activity returns Screensaver to Title. Title and Screensaver show the same menu and a separate silent demo core. Start enters Playing. A fatal collision or fuel exhaustion spends one life and enters Respawning if any lives remain, otherwise GameOver. Respawning lasts 60 ticks, refills fuel, then enters Playing with 120 invulnerability ticks. No new dives launch during invulnerability. Destroying the last enemy enters WaveClear for 120 ticks, then creates the next formation and refills fuel. Pause remembers the previous phase and its timer; Continue restores it without advancing simulation. Pause is available in Playing, Respawning and WaveClear. New game at any screen replaces the whole object in the app. GameOver clears the saved run.

State stores schema version, seed, current uint32 RNG, tick, phase, prior phase, phase timer, wave, score, lives, the earned 5000-point life marker, fuel and its timer, hit-stop timer, player, formation drift, dive schedule, enemy array and fixed bullet pools. Enemy IDs remain stable for the current wave. Every enemy retains its formation slot and dive group. No presentation preferences or high scores belong in core state.

## Rules and events

The field is 320 by 240. Player stays at y=212 with a 7 by 7 hitbox inside its larger sprite. Player has at most two active bullets; inactive pool slots are reused immediately after a hit. Bullets move vertically. Player bullets collide with enemy bullets before enemies. Enemies use core hitboxes independent of their sprites. New formations use six shared rows with 2 flagships, then 5, 7, 9, 9 and 9 enemies. Classic follows the reference row colors; Retro and Modern preserve their own artwork and palettes.

Formation drifts as one unit. Divers steer toward the player's position, stay in horizontal bounds, switch horizontal direction at most once per 60 ticks, shoot only while diving and no faster than once per 30 ticks in wave one, and return to their original formation slot after passing the bottom. Difficulty is a bounded formula derived from wave plus exported configuration constants. Dive speed, launch frequency and concurrent count increase. A flagship can launch with two escorts. Diving kills score double; a diving flagship scores extra for escorts already destroyed in its dive group. A crossing of 5000 grants exactly one extra life.

Fuel drains in discrete chunks. Its configurable default is three units per 120 active ticks from a capacity of 100. Death always costs exactly one life, including fuel exhaustion. Initial lives are three. A kill causes three simulation ticks of hit-stop. Events are discriminated unions for shot, kill, hit, dive, wave, phase, bonus and bullet cancellation. Events carry the positions and points needed for visuals and sound. Core determines all points and timing.

## Persistence and modes

Use localStorage only, in separate versioned run, preferences and scores entries. The run includes every simulation field and RNG. Validate loaded unknown data before use. A valid run hydrates into Pause while preserving its resumable phase and timer. Save on pause, pagehide, loss of focus, visibility hide, wave start and at a short periodic interval scheduled by requestIdleCallback when available. Storage failures must not stop play. Scores and preferences also hydrate and persist independently. Store the top five scores and exactly three normalized initials for qualifying entries.

`?demo=1&seed=123` runs a separate unsaved AI core. `?benchmark=1&seed=123` enables the same deterministic input driver plus renderer frame statistics, average, percentiles and dropped-frame estimate. `?debug=1` enables hitboxes, FPS, invulnerability and wave skip. Demo never alters the player save or scores. The title background demo is silent. WebGL 2 is required initially; WebGPU stays behind a disabled feature flag.

Audio libraries load only after the first keyboard or touch gesture. A shared unlock promise resumes the Web Audio context inside that gesture. Generated SFX buffers and original theme music patterns are cached. Music and effects toggle independently. Pause silences audio; Classic and Retro stop immediately and Modern fades. Tempo derives from difficulty and enemies remaining. Reduced motion disables shake and reduces flashes.

## Verification and release

Core tests exercise deterministic replay and a checked-in replay digest, both collision directions, bullet cancellation, two-shot limit, row and dive scores, escort bonus, life loss, extra life, fuel, invulnerability, dive limits, return to formation, phase transitions and progression. Persistence tests cover resumed RNG and malformed saves. Playwright exercises actual keyboard flow, three waves, game over, pause/continue, reload, touch and theme continuity when available. Tests must test behavior and avoid unnecessary UI snapshots.

Use Bun and current Vite Plus documentation for installation and commands. Pixi and filters use compatible current versions. CI keeps one verification job and one GitHub Pages deployment job. Tier 1 deploys immediately after acceptance. README includes the live URL, controls, commands and verified limitations. Unfinished higher-tier features are hidden behind flags.

## Updated reference and shared layout contract

The latest user instructions replace the original two-theme limit. ThemeId is now `classic | retro | modern`, and Classic is the default for new preferences. Retro preserves the existing art style; Modern retains its neon treatment. All three use the same bare 4:3 game layout. Remove the outer cabinet, masthead, footer, status strips and control captions. Title, pause and game-over menus remain inside the game. Touch controls sit below the playfield without adding decorative framing.

All themes share the core's positions and occupied formation slots. Photo 2 shows a complete 41-enemy pyramid with row counts 2, 5, 7, 9, 9, 9. `FORMATION_COLUMNS` in core/config.ts defines the exact occupied columns. The core uses 6 rows, 9 columns, startX 88, startY 42, spacingX 18 and spacingY 11. New enemy IDs are row * 9 + column; legacy IDs remain unchanged. The player stays at y=212. Theme renderers may not reposition or scale actors independently of these logical coordinates.

The new row scores are 60, 50, 40, 30, 20, 20. Kinds are Flagship, Scout, Striker, Drone, Drone, Drone. All renderer catalogues must cover the sixth row. Classic uses original generated pixel art, black background, a cyan player, yellow flagships, a green third row and red remaining rows, with sparse yellow stars and a solid green fuel strip. Reference images guide composition and color; no image, sprite or sound file is copied into the repository.

Keep shared HUD anchors across all themes: score at top left, wave at top center, previous high score at top right, fuel at bottom left and lives at bottom right. The fuel strip remains continuous and core depletion remains chunky. Theme switching changes artwork, palette and sound while preserving the complete core state, RNG and positions.

Saved version-1 runs may contain the earlier 36-slot formation. Hydration must accept either the exact legacy slot set (`LEGACY_FORMATION_COLUMNS`) or the new 41-slot set, preserve every saved position and timer, and resume paused. A legacy run adopts the new formation only at its next wave or new game. Reject missing/duplicate/mixed slots. Theme preferences validate all three theme IDs, default missing/invalid preferences to Classic, and preserve valid explicit Retro/Modern choices. Refresh the deterministic baseline deliberately for the shared geometry change and verify save continuity, collisions, scoring and three complete waves again.

Player firing cadence is derived from missed-shot lifetime and the two-slot pool. At the shared geometry, a shot starts at y=205.5 and exits strictly below y=-3 at 4.5 pixels per tick, occupying a slot for 47 ticks. Fire every 24 ticks, or 400 ms at 60 Hz. A collision or cancellation frees a slot but does not bypass the remaining fire cooldown.

`CONFIG.playerFireIntervalMs = 400` is the single editable cadence option. `PLAYER_FIRE_INTERVAL_TICKS` derives from that value and `CONFIG.tickRate`; simulation, storage validation and tests use the derived ticks. Do not maintain a second editable tick interval. All menus use functional labels only; remove slogans, decorative status wording and promotional copy as requested.

The latest sizing instruction uses the maximum available 4:3 display area for all three themes. Classic and Retro retain a 320 by 240 raster with nearest-neighbor filtering, including fractional CSS scaling when needed. Modern renders at the same CSS bounds with a full-resolution backing buffer. This supersedes whole-number-only CSS scaling. R starts a new game only while paused. Pause headings and action labels use generated pixel glyphs; M and N hints share aligned settings columns.

Codex Sites is the requested primary host; GitHub Pages remains available. Both deployments must serve the verified build with the appropriate asset base. Sites publication requires a terminal successful native deployment result and its returned URL. Verify the built artifact locally before publication; retain the independent public browser smoke check for GitHub Pages.
