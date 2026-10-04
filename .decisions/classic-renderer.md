# Classic renderer

Classic uses a black 320 by 240 pixel canvas with sparse yellow stars, angular yellow score digits, a cyan player, green life icons, white shots and a continuous green fuel bar with a red E. The six original enemy designs use yellow, red, green, red, red and red row palettes. Photo 2 and Photo 3 informed the colors and sparse presentation; the game displays no copied copyright line.

All positions come directly from the core. The renderer uses the shared HUD anchors and backend preference helper. Its fixed 64-enemy sprite pool covers both the existing 36-enemy saves and the new 41-enemy pyramid. Source grids generate cached nearest-neighbor textures, and fixed pools hold bullets, particles, explosions and score labels. Reduced motion disables shake and death flashes.

Scoped TypeScript and Vite Plus lint checks passed. The renderer's production library build passed. A Chromium WebGL 2 smoke check covered both formation sizes, core immutability, reduced-motion hitboxes, desktop and mobile integer scaling, and renderer destruction followed by recreation without page errors. Screenshots remain outside the repository. The app owns the previous-best digits and menu overlays.
