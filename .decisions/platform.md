# Persistence and demo decisions

- The run, preferences and local top five scores use separate versioned localStorage keys. Storage exceptions return safe defaults and never interrupt gameplay.
- Hydration validates every simulation field, enemy identity and slot, enum, finite coordinate, RNG integer and fixed bullet pool before constructing a paused run. Its saved phase timer and RNG are preserved.
- Saving accepts only playing, respawning, wave clear and paused states. The app owns save scheduling and ensures demo cores never enter persistence.
- Demo input uses deterministic nearest-target aiming and short bullet trajectory prediction. It reads only core state and produces the same actions as the player.
- Scores use uppercase letters and digits with exactly three characters. Entries are normalized, sorted and capped at five before writing.
- Saved countdowns must remain within their configured simulation ranges. Phase timers are validated against the phase they will resume, preventing corrupted finite timers from freezing play or granting long invulnerability.
