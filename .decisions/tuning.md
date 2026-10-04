# Formation and fuel tuning

- Tighten and center the formation by changing the starting X from 55 to 83, column spacing from 30 to 22, and row spacing from 18 to 15. The 320 by 240 field and starting Y of 42 remain unchanged.
- Remove the retro fuel strip's nine separators. Fuel still drains in the same discrete core chunks, and the renderer retains the existing filled rectangle and low-fuel color.
- Astra approved regenerating the seed-1982, 3600-tick replay baseline because the intentional formation geometry changes collision outcomes. The replay inputs, test assertions, simulation rules and RNG algorithm remain unchanged.
- Previous final state digest: `2dc415334c6faa79ff879235ad0582e840d0ff53547c010b31732c83658b9fe0`. New final state digest: `df7204a1f2524e5c6d389bddcc90d4631db4b221157084b8dae88120ef8c5327`.
- Previous final event digest: `ac282c48434a6ba86d3e9c3f7366e78a2641697c8447285a94f606418de47d22`. New final event digest: `aac40ba809c50b2a18b7afaa7e1405f6cb42c023ff47f92a43bc9edf065f77f8`.
- The fixed replay still reaches game over with three hits. Its score changes from 2120 to 1520 and kills from 34 to 31; its first start event digest is unchanged. These outcomes reflect the compact formation's changed collision timing.
- An unmodified AI input driver with seed 1982 cleared three full waves without debug assistance, entering wave four after 8291 input ticks with 5270 points and two lives. No temporary AI source is committed.
- Vite Plus formatting, lint and type checks passed. All 34 existing unit tests passed, and the production build passed.
