# Benchmark telemetry

- Benchmark measures visible requestAnimationFrame intervals before the app clamps its simulation elapsed time. These intervals describe rendered frame pacing, not CPU time inside the renderer.
- The collector uses a fixed 3,600-value ring and reusable sorting buffer. Per-frame collection allocates nothing. Percentiles, mean and maximum cover this recent window; rendered frame count, elapsed time and estimated dropped frames cover the run since reset.
- Dropped frames are an estimate against a 60 Hz budget, rounded to the nearest interval. Refresh rate, browser scheduling and display behavior can affect the estimate.
- Invalid intervals are ignored. The app excludes the first interval and clears its previous RAF timestamp when hidden so a suspended-tab gap is never sampled. Reset is available for starting a fresh measurement session.
- The benchmark collector imports only the theme identifier type. It does not read or write simulation state, storage, audio or console output. App query handling enables it only when the Tier 3 benchmark flag is available.
- Snapshot data is plain JSON-compatible data with seed, theme, resolution, pixel ratio, renderer, wave and tick supplied by the app. Taking a snapshot is intentionally separate from each frame's sample call.
