# Retro renderer

- The retro theme renders into a 320 by 240 WebGL 2 canvas. CSS expands it by whole integer scale factors whenever it fits; narrow windows use a bounded fractional fit. High DPI does not change the logical raster, preserving the intended pixel grid.
- A supplied WebGL 2 context prevents Pixi from silently selecting WebGL 1 or WebGPU.
- Sprite frames and font glyphs become nearest-sampled textures once at initialization. Enemies, bullets, particles, explosion effects and score popups reuse fixed pools.
- The core supplies hitboxes, hit-stop and event points. The renderer reads those values without changing the simulation or using the core random generator.
- The existing rendering contract excludes previous high score. The app displays that value in its overlay; the renderer reserves the upper right HUD space.

Verification: TypeScript, Vite Plus formatting and lint passed. A real Chromium WebGL 2 smoke test rendered every row, bullets, explosions, score popup and HUD at a 960 by 720 CSS desktop size with device pixel ratio 2 and at 320 by 240 on a narrow viewport. Drawing buffer stayed 320 by 240. Hitboxes displayed from core configuration. Destruction removed the canvas. Browser reported no JavaScript or console errors. Screenshots retained at /tmp/space-attack-renderer-desktop.png and /tmp/space-attack-renderer-mobile.png.
