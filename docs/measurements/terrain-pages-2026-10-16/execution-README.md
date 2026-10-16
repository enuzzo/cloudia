# Compact analytic terrain pages, CPU prototype

External working directory only, 2026-10-16. No product, GPU, browser, dependency installation or commit. The original analytic source is frozen byte for byte. The final point query always calls that source. A page contains analytical bounds and an ideal-field gradient enclosure plus the original numerical deviation ledger; it is not a replacement height map or a fitted surface.

The root is measuring GPU A/B/A. **No fixture replay or analytical page preparation may start until the root explicitly releases CPU work.** The runner enforces a separate `--allow-cpu-replay` flag. The small `structural.ts` script has no fixture, point query, gradient bound build or benchmark.

## Format and concrete runtime changes

`compact.ts` serializes one RGBA32F base record per node `[Hmin,Hmax,pointer,E]`. Positive pointers address four contiguous children; negative pointers are `-(gradientIndex+1)`. The exact-f32 integer contract is checked before allocation and after encoding. Each leaf has one separate RGBA32F gradient record `[gxMin,gxMax,gzMin,gzMax]`; internal nodes have none. E is meaningful only at a leaf, where inclusion uses it. All original height, leaf gradient and leaf E values are copied without quantization changes.

A 32-bit key packs x and z cell indices (14 bits each) and level (4 bits). Maximum level 14 means a 62.5 m cell in the 1024 km square. Rectangles use dyadic coordinate arithmetic and are reconstructed exactly for this domain. The CPU `Work` object is a debug/reference representation, not proof of a 16-byte GPU stack or absence of register spill.

`trace-compact.ts` preserves the original near-first trace and all caps. It derives each child rectangle and clips it against the current ray segment **before** fetching that child's base record. A gradient record is fetched lazily only for a leaf that survives the height test and needs derivative inclusion. Fetch accounting counts actual base/gradient record accesses. It does not infer GPU milliseconds from those counts.

`verifyRepack` checks every implicit rectangle, pointer, height value, leaf gradient and leaf E against the source nodes. The initial packing phase then requires all geometric outcomes, point counts, visits, gradients and enclosures to be exactly identical on all 5198 fixture rays. Only record-load accounting and the explicit blocker key may differ.

## Prospective page protocol

The choices below are encoded in `protocol.ts` before running the experiment:

- 16 original point samples, 256 visits, stack capacity 48, 1 m band; no cap sweep.
- Three training bundles, 3 × 3 rays each. Two are fixed around `home-down-1-5` and `coastal-horizon-0-14`; the third is a designed near-coast view from `[16,2.5,0]`, direction `[-sqrt(1-0.4²),-0.4,0]`. Direction components are rounded to f32, with fixed yaw/pitch offsets.
- At most three refill rounds; pages refine the pending leaf to 250 m. An already 250 m leaf remains unchanged. A request contains a world key, target size, source hash and ledger version, never an oracle hit or a fitted height.
- The only primary request source is a normal-cap unresolved trace and its actual pending leaf key. Primary requests are deduplicated and sorted before deterministic four-face neighbor prefetch. Out-of-domain neighbors are skipped. Pages are reused by all rays.
- Every page has an exact node/leaf reservation before any analytic work. Metadata residency can never exceed 8 MiB. A rejected, stale or already fine request is logged explicitly and does not change the tree.
- The builder commits a page only after its entire analytic subtree is available. It reuses the exact previous `gradientBound`, `TerrainBounds` and center-anchor enclosure, with original outward rounding and no reduced margin.
- 48 offset holdout rays and 18 yaw holdout rays never request pages. `coastal-horizon-38-17` and `low-x-16-dy0` are separate controls, also excluded from requests. Their states and witnesses are exported without filtering.
- New page metadata gets up to 10240 independent finite probes of original point height, ideal derivative and CPU-versus-ideal E. These checks qualify the finite corpus only.
- The full 5198-ray matrix is run once only after page preparation and holdout safety checks. The fixture's old `cpu` results are stripped before producing any page request; they are not consulted by the selector or builder.

Success gates: zero new conflict against qualified first-entry prefixes/witnesses, no hit band over 1 m, at least 50% fewer metadata record reads before adding pages, at most 333 full-grid unresolved compared with the prior 666, residency at most 8 MiB. Resolved-to-unresolved changes are exported separately, even if not a false geometric answer. Actual GPU cost, upload, rebuild, queue and frame impact remain a later gate.

The 8 MiB limit is the resident serialized base+gradient data, not peak CPU heap. The external mutable builder keeps debug nodes, and transient array replacement can increase preparation memory. No synchronous CPU field query is introduced into a renderer loop. No runtime paging/GPU queue implementation is claimed.

## Execute only after CPU release

Use the existing Bun runtime, no installation:

```sh
cd /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle12/terrain-pages
/Users/enuzzo/.bun/bin/bun structural.ts
/Users/enuzzo/.bun/bin/bun run.ts --allow-cpu-replay --phase=packing > packing-stdout.json
/Users/enuzzo/.bun/bin/bun run.ts --allow-cpu-replay --phase=pages > pages-stdout.json
/Users/enuzzo/.bun/bin/bun run.ts --allow-cpu-replay --phase=full > full-stdout.json
```

Keep the phases sequential. Inspect `results/packing.json` before pages. Do not change protocol choices in response to the results and call the same run prospective. The full phase verifies that its prototype sources match the hashes used for preparation and refuses a failed holdout or finite-bound safety result.

Existing frozen inputs are read in place from cycle 10 after exact source/fixture/binary SHA validation. No 5 MiB old binary or 4 MiB fixture is duplicated into this directory. The prepared residency binaries are external derived files and should not be archived into Dropbox by default; preserve code, descriptors, SHA and every unresolved result instead.

## Current execution state

All three phases ran once after root authorization. The compact format preserves all 5198 geometric outcomes exactly and reduces logical CPU record reads by 86.75%. The fixed paging policy passes finite safety checks and stays at 5.292 MiB, but FAILS the prospective coverage gate: 666 → 660 unresolved versus target at most 333. Read RESULTS.md and the complete per-ray evidence before interpreting these results. No GPU or product change was made; all CPU processes have exited.
