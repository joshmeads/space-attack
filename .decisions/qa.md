# Browser verification decisions

- The release browser gate drives real keyboard controls and checks the canvas owns a WebGL 2 context. It records browser exceptions.
- Three wave transitions use the explicit debug input so the release gate stays short and repeatable. This proves browser state transitions, not natural wave clearance. Natural progression needs separate seeded AI simulation evidence.
- Game over is reached through ordinary enemy attacks after debug invulnerability is disabled. Tests never mutate core fields through the browser.
- Screenshots and traces remain in temporary test output and are not committed as binary assets.
