# Decisions

| Decision                                                                         | Reason                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Use a 320 by 240 logical playfield and 60 Hz simulation.                         | It supports crisp integer scaling and a desktop CRT proportions.                   |
| Keep a mutable, serializable core state behind deeply readonly theme interfaces. | Fixed pools avoid bullet churn while renderer types enforce ownership.             |
| Store the uint32 RNG and all simulation timers in each save.                     | Continuing a save must preserve the same future inputs and outcomes.               |
| Use localStorage only with independent run, preference and score entries.        | The user explicitly removed IndexedDB and prioritizes synchronous lifecycle saves. |
| Count lives as total ships remaining including the current ship.                 | Three starting lives therefore permit three deaths.                                |
| Award one extra life when the score first crosses 5000.                          | The request specifies a single bonus threshold.                                    |
| Start with 36 enemies: four central flagships and four rows of eight.            | This fits the 4:3 playfield and keeps flagship groups distinct.                    |
| Default fuel drains by three of 100 units every two active seconds.              | This creates visible retro chunks and about 68 seconds to clear a wave.            |
| Freeze core simulation for three ticks on a kill.                                | Hit-stop is deterministic and independent of theme.                                |
| Keep title and benchmark simulations separate from the player run.               | Attract play must never overwrite a save or produce a leaderboard result.          |
| Require WebGL 2 and leave WebGPU disabled behind a feature flag.                 | This follows the initial compatibility target.                                     |
| Gate each release tier before the next.                                          | Tier 1 must deploy before saves, audio or the modern theme can delay it.           |
