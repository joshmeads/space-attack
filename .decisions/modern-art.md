# Modern theme design decisions

- Shapes use centered logical coordinates in the existing 320 by 240 playfield. Rasterize the vectors at device resolution; rendering scale never changes core positions or hitboxes.
- The cream and cyan player has swept wings and a narrow cockpit. Enemy rows use a crowned magenta flagship, split violet scout, crescent cyan striker, faceted mint drone, and amber manta. Map row 4 to manta even though it retains the core drone kind.
- Hulls receive dark solid fills and thin row-colored outlines. Panels use the row color at low opacity. Cockpit lights use cream. Cache the geometry once per ship design.
- Apply one restrained glow or bloom pass to the ship and effects layer. Keep HUD text outside filters. The effect values are tuning starting points, not a requirement to stack filters.
- Preserve the retro information layout and original glyphs. Generate glyph geometry or high-resolution textures from the existing character grids rather than loading a font.
- Keep stars faint and use any perspective grid only in the lower background at the configured low opacity. Enemy projectiles should stay visually brighter than background decoration.
- The renderer may lean the player by 0.06 radians and draw exhaust behind ships. These effects cannot modify collision or shot direction. Reduced motion disables shake and limits flash opacity.
- The modern asset catalog stays unreferenced until the Tier 1 deployment is complete. This assignment adds data only and does not enable the theme.
