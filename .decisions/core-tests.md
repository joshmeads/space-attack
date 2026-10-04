# Core verification

Tests drive the public fixed-step API against small state fixtures. Fixtures isolate collision and scoring boundaries while full seeded replays exercise ordinary execution. The checked-in SHA-256 replay digest includes five complete-state and event checkpoints for seed 1982 over 3600 recorded input frames. Intentional rule changes require review of the checkpoint differences before updating this fixture.

The suite covers phase transitions, pause timers, both collision directions, bullet cancellation, smaller player hitboxes, two pooled straight shots, row and diving scores, flagship escorts, the one-time 5000-point extra life, single life loss, game over, chunked fuel, wave refill, spawn immunity, formation synchronization, dive concurrency, firing and steering intervals, horizontal bounds and slot return. Snapshot continuation checks the persisted RNG alongside identical future events and state.

The natural progression check used the actual demo input driver with seed 1982 and no debug actions or state mutation. It killed all 108 enemies across three complete formations. Wave 2 began at tick 2732 with score 1790 and two lives; wave 3 at tick 5509 with score 3490 and two lives; wave 4 at tick 8172 with score 5300 and one life. Idle inputs after wave 4 produced natural game over at tick 8585 with zero lives. Four death events included the extra life earned at 5000 points.

The copied simulation implementation is used only to execute tests in the isolated test worktree. Its files are excluded from this worker's commit.
