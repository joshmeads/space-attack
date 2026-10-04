# Classic acceptance checks

- Classic is the default. Browser coverage checks the shared 41-enemy pyramid and the 4:3 playfield, explicit Classic, Retro, and Modern selection, equal canvas bounds, exact paused-state continuity, and three cached canvases.
- Pause coverage checks generated pixel headings and action labels, aligned music and effects hotkeys, N remaining the effects toggle, and R constructing a fresh game.
- Existing keyboard, wave, game-over, save, preferences, demo, benchmark, and touch checks remain release gates. Core tests own exact 400 ms shot cadence and legacy-save migration; browser tests avoid duplicating those simulation assertions.
- Final production verification collects console warnings as well as errors. Screenshots remain outside the repository. Physical iOS and WebKit remain unverified because of the recorded host dependency limitation.

- The five primary browser tests passed on the completed app preview in 10.8 seconds. Desktop and mobile screenshots of all three themes showed identical canvas bounds and menu placement, with no external cabinet, header, footer, or slogans. Pause text and action labels use generated pixel glyphs, and the M/N columns align.
- A separate corruption regression passed: an excessive saved life count is rejected during hydration, the title remains usable, and no HUD RangeError occurs.
- Normal start, firing, pause, three-theme switching, audio toggles, resume, and R restart produced no game or library console messages in the preview. Only the two expected Vite development connection messages appeared. The final production gate must contain no console messages at all.
- The latest sizing instruction replaces integer-only CSS fitting. Browser checks now require the maximum available 4:3 area and a 390 by 292.5 mobile canvas at a 390 by 844 viewport. All six tests passed against the updated preview in 10.7 seconds. R starts a fresh game while paused and leaves an active run unchanged.
