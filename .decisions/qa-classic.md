# Classic acceptance checks

- Classic is the default. Browser coverage checks the shared 41-enemy pyramid and the 4:3 playfield, explicit Classic, Retro, and Modern selection, equal canvas bounds, exact paused-state continuity, and three cached canvases.
- Pause coverage checks generated pixel headings and action labels, aligned music and effects hotkeys, N remaining the effects toggle, and R constructing a fresh game.
- Existing keyboard, wave, game-over, save, preferences, demo, benchmark, and touch checks remain release gates. Core tests own exact 400 ms shot cadence and legacy-save migration; browser tests avoid duplicating those simulation assertions.
- Final production verification collects console warnings as well as errors. Screenshots remain outside the repository. Physical iOS and WebKit remain unverified because of the recorded host dependency limitation.
