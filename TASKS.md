# Space Attack tasks

Active tier: **Tier 3**. Advance to Tier 2 only after the Tier 1 build is deployed and CI passes. Advance to Tier 3 only after Tier 2 verification passes. The overall goal stays active until all requested tiers are delivered or a concrete external blocker is reported.

- [x] Establish shared contracts and module ownership in PLAN.md.
- [x] Set up Bun, Vite Plus, Pixi, Playwright and simple CI.
- [x] Implement deterministic simulation and focused core tests.
- [x] Generate original retro sprites, font and renderer.
- [x] Connect keyboard input, loop, HUD, title, pause and game over.
- [x] Play at least three waves and reach game over on integration.
- [x] Pass Tier 1 checks and deploy GitHub Pages.
- [x] Add validated saves, continue, touch controls, high scores and preferences.
- [x] Add generated music, effects, reduced motion and visual feedback.
- [x] Add silent title demo and screensaver.
- [x] Verify Tier 2 on integration and main.
- [x] Add deterministic benchmark and Modern theme after preceding tiers passed.
- [x] Complete final QA, README and decision record.

The scope now includes the user's later Classic default and shared bare layout request.

- [x] Add Classic as the default third theme with original generated art and audio.
- [x] Remove all surrounding cabinet/header/footer/control-caption chrome.
- [x] Share the same 41-enemy pyramid, playfield and HUD geometry across every theme.
- [x] Preserve valid legacy saved formations through hydration and theme changes.
- [x] Verify the updated replay baseline, three-wave progression, theme continuity and bare desktop/mobile layout.

- [x] Verify identical maximum fitted 4:3 bounds across Classic, Retro and Modern.
- [x] Verify generated pause labels, aligned M/N hints and R restart.
- [x] Publish the verified build to Codex Sites.
- [ ] Publish the final main checkpoint to both hosts and confirm Pages CI/live behavior.

Combined integration: 52 unit tests and six browser tests pass. Sites publication succeeded for source 24246a3. The production audit passed with zero console messages, warnings or errors. Final main publication remains open.
