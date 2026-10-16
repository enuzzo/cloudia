# Geometry preflight R2 — prepared, not run

This external package contains **unexecuted** `witness.ts` and `run.py`. Root is the only authorizer of the future run. No Bun, typecheck, tests, DEM sampling, mesh construction, kernel, GPU, browser or build has been started for this package.

Read `protocol.md` and `PROTOCOL.json` before execution. The former also replaces cycle27's proposed protocol; its original local17 R1 is preserved separately. `PRE-RUN-FREEZE.json` pins these five local payload files, immutable v58 source/DEM/witness inputs, selected Three bundles and the Bun binary. The freeze omits itself to avoid a circular digest; its SHA is reported to root.

The executable builds **one** actual Float32 baseline mesh from cycle27/source and checks all 17 saved face identities before measuring all 591361 original DEM nodes in the closed ±48km core. It saves only all/land-mask/sea-mask aggregates per ring, fixed histograms, predetermined top8 extrema with raw coordinates and a SHA256 of the ordered Float64LE error stream. It does not retain the stream, a full mesh or 591361 JSON rows. Source-mask categories are not an independent physical coastline claim.

Future command, after source/budget review, **not executed here**:

```sh
cd /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle28/geometry-preflight
python3 run.py --execute-reviewed-r2
```

The launcher creates fixed `run/` exclusively, which consumes the single attempt even on preflight failure. It pins/validates the existing protected dependency directory and starts one child only; no install or extra node_modules symlink is needed. Expected artifacts: `run/result.json` ≤4MiB, `run/stdout.log`, `run/stderr.log`, `run/run.json`, and a launcher error log on failure. Progress is intentionally written to stderr.

Limits: child OS CPU hard limit20s; combined wrapper+child CPU **terminal gate**20s; total wall watchdog40s including input verification; macOS terminal sum-of-peak-RSS gate2GiB. The RSS sum is a conservative bound, not concurrent memory or a kernel memory cap. No retry, fallback, new points or budget increase. A result file alone is insufficient: the terminal Popen record must also PASS.

There is currently **no result or performance/art acceptance**. Whole-core node errors are observed geometry approximation, not a continuous supremum, DEM accuracy certificate, explanation of six pixels or GPU shadow proof. Edge/interior probes, a refinement candidate, native A/B and FPS qualification require separate later decisions. No rejected caster/clipping implementation is part of this package.

Preparation erratum: an initial hashing/freezing I/O check found that this Python does not expose `os.getxattr`; no child or sampler was launched. `preparation/` preserves the exact9628-byte R1 launcher reconstructed by reversing the sole recorded patch, the observed error and R1→R2 diff. R2 uses Darwin's six-argument `getxattr` through ctypes instead of an extra process. It remains unexecuted; the attribute was independently read as1 using the normal xattr command.
