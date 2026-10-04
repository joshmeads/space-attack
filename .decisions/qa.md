# Browser verification decisions

- The release browser gate drives real keyboard controls and checks the canvas owns a WebGL 2 context. It records browser exceptions.
- Three wave transitions use the explicit debug input so the release gate stays short and repeatable. This proves browser state transitions, not natural wave clearance. Natural progression needs separate seeded AI simulation evidence.
- Game over is reached through ordinary enemy attacks or fuel exhaustion after debug invulnerability is disabled. The debug advance hook runs neutral core ticks to avoid waiting minutes for fuel depletion. Tests never mutate core fields through the browser.
- Screenshots and traces remain in temporary test output and are not committed as binary assets.

## Tier 1 evidence

- The independent browser gate passed in 10.2 seconds against integration on port 5183. It verified keyboard movement, firing, pause and resume, HUD values, three wave transitions, game over, a fresh run, WebGL 2, and no page exceptions.
- Desktop 1440 by 1050 and mobile 390 by 844 screenshots were inspected. Their canvases measured 640 by 480 and 320 by 240. Score, wave, high score, fuel, and lives fit; mobile controls sit below fuel; neither page scrolls.
- The first browser attempt overlapped repository formatting and another Playwright runner and failed during wave progression. A rerun with unchanged tests and isolated artifacts passed. Test output must remain separate during concurrent QA.
- The core test agent recorded natural AI progression using seed 1982. It cleared 108 enemies over three complete waves and reached wave four at tick 8172 with 5300 points. Neutral input then reached game over at tick 8585. No debug flags or direct state mutations were used in that simulation.

## Tier 2 and Tier 3 preview evidence

- The complete three-test Tier 1 and Tier 2 browser suite passed in 10.8 seconds against the app worker's port 5190 preview. Reload preserved the complete paused core snapshot, preferences survived reload, demo mode preserved the player save, keyboard New Game replaced the run, blur paused play, and real touch input moved and paused the ship on mobile.
- Theme switching preserved the complete paused state across three switches and reused two canvases. Benchmark mode reported seed 78, Modern, WebGL 2, positive dimensions and frame intervals, ordered percentiles, and preserved the saved player run. This additional test passed in 1.6 seconds.
- No Tone or ZZFX module request occurred before input; both modules loaded after the first keyboard gesture. This verifies loading order in Chromium, not physical iOS audio playback.
- A populated mobile game-over screen initially overflowed its display. App commit d61b966 reduced the menu to 228 pixels within the 259.5-pixel display. Independent screenshots confirmed the title, playfield, five scores, initials form, and Play Again button fit.
- A real 90-point run ended through neutral-input simulation; entering XYZ saved the result first in the local top five and removed the saved run. No page exceptions occurred.
