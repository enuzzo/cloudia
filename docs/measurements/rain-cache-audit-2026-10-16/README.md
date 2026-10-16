# Lazy CPU A/s cache audit

Completed once, external-only2026-10-16, after the root released the CPU window.
See RESULTS.md and result.json. Both grids fail the proposed maximum mapping gate;
no additional pose/amount/growth sweep was performed. Coordinate another replay
with the root before running it during renderer measurements.
No product file, GPU/browser/build or generateVolume call is involved.

```
cd /Users/enuzzo/Documents/Codex
/Users/enuzzo/.bun/bin/bun /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle11/rain-cache-audit/replay.ts 32 18
```

The data stay in the existing cycle10/rain-work/data directory. The reader verifies
sizes/hashes before use. Absolute CPU imports are checked against the historical
bake hashes. The live rain block must remain byte-identical to the historical
shader block; the later narrow specialization elsewhere is not replayed or timed.

`replay.ts` is an instrumented copy of count-work.ts, retained among the snapshots.
Original cloud/rain points and the original cutoff control both candidate paths.
The old sequence SHA must match. Both128³ and256³ evaluate only their required
8corner nodes, round A and s independently to binary16 RNE, then use ideal CPU
trilinear reconstruction with f32 results. Maps store packed RG16F; no dense
cache volume is constructed. Full hypothetical volume bytes are metadata only.

Progress is printed every96rays. Before starting another ray, the process stops
if the audit has exceeded45s, recording an incomplete marker; incomplete output
must not be represented as a completed qualification. No automatic retry/bake.

Metrics separate amplitude, world mapping displacement, sigma, ray tau and T.
Contributor gates are engineering thresholds from the proposal, not perceptual
guarantees: original-A-positive p99 mapping≤.75m,max≤1.5m; max ray deltaTau≤.01,
mean≤.002. A stricter original-or-candidate contributor-union gate is also reported.
Opacity-weighted means use the rain share of the co-located segment opacity.

The deliberate wrong-zero-S control quantifies why empty amplitude nodes still
need valid mapping. Bounded cap/domain probes are additional finite checks;
they do not qualify all growth/wind/time/amount combinations or continuous support.
Candidate transmittance remains evaluated on the fixed baseline path: a candidate
which would continue beyond the baseline cutoff is explicitly censored. No source
RGB, native sampler equivalence, image or FPS claim follows from the report.

`result.json`, `historical-replay.json` and an after-run manifest are expected
outputs. Raw cloud data are referenced, not copied into this package.
