# Simulation decisions

- The core uses xorshift32 with a fixed nonzero replacement RNG state for seed zero. Saves retain both the original seed and current RNG state.
- Pause freezes the global tick and preserves the phase timer. Continuing consumes one command tick without advancing gameplay.
- Bullet and event buffers are reused. Enemy formations allocate only when a new state or wave is created.
- Death clears both bullet pools and returns surviving divers to their original slots. The respawn timer freezes gameplay and refills fuel; the returning player receives 120 active invulnerability ticks.
- Dive groups respect the concurrent diver limit. Wave one allows one escort with a flagship; higher waves allow both escorts. Destroyed escorts retain their group for the flagship bonus.
- Diver steering changes only at 60-tick intervals. Horizontal bounds clamp motion instead of forcing an extra direction reversal.
- Difficulty increases by bounded formulas; the exported configuration fixes enemy fire intervals to at least 30 ticks. Final-wave kills clear bullets and enter the wave banner before fuel depletion can take another life.
- Debug invulnerability suppresses fatal hits and fuel deaths without changing normal scoring or wave rules.
