# Classic persistence compatibility

- New preferences default to Classic. Valid stored Retro and Modern selections remain unchanged.
- The save schema remains version 1 because gameplay state fields are unchanged. Hydration recognizes the exact occupied slots of both the legacy 36-enemy and current 41-enemy formations.
- Existing runs keep their enemy IDs, home coordinates, positions, random state and timers. Both original and compact legacy geometry remain supported; the core installs the new formation at the next wave.
- Stored player fire cooldowns use the tick count derived from the millisecond setting. Countdown and lives bounds remain enforced against malformed saves.
