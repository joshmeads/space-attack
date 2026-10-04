# Modern renderer

Modern keeps the 320 × 240 simulation field and every core collision box. Pixi draws the original six vector ship designs at the fitted display size and device pixel ratio; only presentation positions and lean are affected. The renderer requires an actual WebGL 2 context and does not enable WebGPU.

Ship graphics are constructed once. Bullets, burst particles, expanding rings and score labels use fixed pools. A separate visual RNG changes presentation only. Glow and bloom apply to actors at restrained strengths; the sky and perspective grid stay subtle so diving enemies remain readable.

Modern uses the browser's monospace font for generated HUD textures without loading a font asset. Reduced motion removes ship lean, formation sway and camera shake, holds stars steady and lowers death flash opacity. Theme activation remains the app's Tier 3 decision after the lower tiers pass.

The Chromium smoke check used an actual WebGL 2 context. Desktop rendered a 960 × 720 CSS field into a 1920 × 1440 drawing buffer; a 390 × 292 CSS field rendered into 1170 × 876 pixels at DPR 3. Core state stayed unchanged, reduced-motion hitboxes rendered, and renderer destruction followed by recreation succeeded without page errors. This is renderer verification, not a substitute for the integrated multiwave playthrough.
