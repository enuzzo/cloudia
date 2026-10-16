# Analytic gradient metadata for the original terrain

External CPU prototype, 2026-10-16. No product source, GPU workload, browser, bake, dependency installation or volume generation was changed or started by this branch. The candidate is not promoted. The existing direct-interval package in `../terrain-gpu` remains frozen.

## What this changes

The final point evaluation still imports the original `terrainHeight` from `src/cumulonimbus/landscape.ts`. The authored four rotated octaves, integer hashes, squared ridge, smooth coast, range modulation and exponent remain the same. This prototype moves interval automatic differentiation and the numerical error ledger to an offline metadata builder. The ray traversal contains no noise-cell enumeration, nested interval mix, interval sine or interval power.

Each sparse quadtree node uses **three RGBA32F texels, 48 bytes**:

| Texel | Contents |
| --- | --- |
| 0 | CPU height lower/upper enclosure, first child index, level |
| 1 | minimum x, minimum z, square size in km, uniform height error E |
| 2 | ideal gx lower/upper and ideal gz lower/upper |

Nodes cover the closed square `[-512,512]² km`; four child records are contiguous. Heights and gradients are quantized outward to f32. The builder intersects analytical height enclosures with an optional single-center enclosure `Hcpu(center) ± (|gx|max+|gz|max)·size/2 ±2E`, and then intersects valid parent bounds with the union of valid child bounds. A center sample anchors an analytical derivative proof; there is no min/max sampled height map and no interpolated replacement surface. Runtime point samples use only the original function.

## The precise numerical target

`gradient.ts` defines a continuous ideal reference with the exact f32 authored constants and the source's coordinate-independent, pre-rounded octave amplitude sequence. Its ideal derivatives are interval bounds over the entire cell. Its uniform `E` accounts for CPU input fround, coordinate recurrence, source arithmetic order, noise fractions/cubic/mixes, smooth coast, and declared host sine/power budgets. The source's simultaneous x/z update is retained. The octave world derivative uses the transpose of the coordinate Jacobian through ordinary AD.

The noise gradient is derived separately on every intersected lattice cell. It includes the cubic's internal derivative maximum and unions the resulting component bounds. Negative coordinates use floor. The squared-ridge cusp includes both one-sided derivatives. Sine/cosine intervals include internal extrema. The `h^1.3` derivative is finite at zero; the prototype makes no bounded-Hessian assumption.

The noise interpolation ledger is local and compositional: fraction subtraction, two cubic weights, two horizontal mixes and the outer mix. Cubic error sensitivity in an inner mix is multiplied by the hash difference. The exactness of f32 fraction subtraction outside `(-.5,0)` is used only after coordinates have already been rounded to f32. The conservative `32u`, `u=2^-24`, remains the fallback. The independent derivation is in `review-notes.md`.

**Qualification boundary:** host `sin` absolute budget `2^-23` and host `pow` absolute budget `2^-22` are stated assumptions, checked on a finite corpus rather than proved for every host input. No universal GPU rounding, contraction, transcendental or ray-coordinate certificate follows from this CPU ledger. The outward binary64 interval padding is qualified for this bounded finite domain. `roundingQualified` and `GPUQualified` remain false in the exported results.

## Ordered entry rather than a continuity shortcut

For one metadata cell, let `Fcpu(t)` be radial altitude minus constant per-ray relief times the original CPU terrain height. Let `D` enclose the ideal clearance derivative on the whole segment connecting point sample `m` to the candidate interval. Then

```
Fcpu(t) >= Fcpu(m) + min(D · (t-m)) - 2·relief·E - radial/arithmetic guards.
```

The sign of `t-m` selects the appropriate endpoint. The radial derivative is monotone for any nonzero ray; endpoints bound it without assuming a unit ray. Signed derivative inclusion can directly cut a certified positive prefix, and a separate lower-bound evaluation validates that whole prefix before advancing.

Traversal remains near-first. A hit requires an entirely certified outside prefix, a **real nonpositive point evaluation**, and `(B-A)·|ray| ≤ 0.001 km`. This encloses the infimum of the occupied CPU set. It does not claim a literal zero, because the fround field is discontinuous. A tangent, numerical contact, exhausted point cap, exhausted visit cap, stack overflow or metadata-domain gap remains unresolved. There is no fallback that silently labels those cases as hit or miss.

Sea intersection is computed by a general quadratic. A ray that misses the sea still traverses the outer terrain envelope through its far end, so above-horizon mountain candidates are included. A ray-constant relief fade uses sea distance when present and closest approach otherwise, as in the earlier external candidate. This continuation is explicit candidate behavior, not a claim that the existing product already implements it.

## Reproduce and inspect

Run with the existing local Bun runtime, without installing dependencies:

```
cd /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/terrain-gradient
/Users/enuzzo/.bun/bin/bun run.ts > run-stdout.jsonl
```

`run.ts` verifies the canonical terrain hash before running, imports the complete `5198` f32 ray dataset from the frozen audit, tests multiple metadata spacings and explicit point caps, and writes every resolved and unresolved result. The fixed primary traversal cap is 256 visits, 48 stack records and 1 m geometric tolerance; the main comparison uses 16 point samples. Larger point caps are separate diagnostic variants, never an implicit improvement to the same cap.

`validate.ts` independently implements the ideal scalar gradient and checks negative coordinates, noise and tile boundaries, coast transitions, ridge cases, transforms, large rectangles and serialized metadata. Finite passes are evidence for this corpus, not an all-input or GPU proof. `runtime-inclusion.wgsl` is a small uncompiled design artifact showing the new runtime arithmetic; it is not an installed renderer change.

## Research and scope of applicability

Hart's derivative-bound argument supplies the basis for conservative advancement on the ideal field. It does not differentiate or restore continuity to a fround staircase. [Hart, Sphere Tracing (1996)](https://experts.illinois.edu/en/publications/sphere-tracing-a-geometric-method-for-the-antialiased-ray-tracing/).

Using local bounds over ray segments rather than a global worst-case gradient follows the useful direction in [Galin et al., Segment Tracing Using Local Lipschitz Bounds (2020)](https://onlinelibrary.wiley.com/doi/abs/10.1111/cgf.13951). The publisher abstract was consulted; the full publisher PDF was unavailable in this session. The metadata and numerical ledger here are our own implementation.

Signed/asymmetric derivative inclusions retain increasing/decreasing information that a single absolute Lipschitz number loses; this is also the direction of [Aydinlilar and Zanni, Forward inclusion functions for ray-tracing implicit surfaces (2023)](https://www.sciencedirect.com/science/article/pii/S009784932300081X). Here they are applied only to the ideal field and bridged to the CPU target by E.

The original global estimate `LH=5.72` remains a diagnostic upper bound for the ideal field; it is too loose to be an attractive runtime choice. A cap is an explicit computational limit, not proof of a miss: the practical need to preserve a conservative step and expose premature termination is consistent with the discussion in [NVIDIA GPU Gems 3, Relaxed Cone Stepping for Relief Mapping](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-18-relaxed-cone-stepping-relief-mapping). This prototype does not reuse sampled depth-map cones as proof for the procedural curved-world terrain.

## Outcome

The numerical outcome is recorded in `RESULTS.md` and `results.json`. CPU wall times are preparation/runtime observations on this Mac; they are not GPU timings, fragment compile timings or FPS evidence. The existing blocked browser run did not establish whether compilation or DOM/accessibility work caused the stall, so this branch makes no causal attribution and no GPU performance claim.


## Durable archive and reproduction

This directory contains source and evidence, with portable import rewrites recorded in `provenance.json`. Copy it to a work directory outside Dropbox before reproducing. Run `python3 restore-fixture.py`, then `/Users/enuzzo/.bun/bin/bun run.ts --candidate-only`. The exact original 4 MiB JSON fixture is stored once in gzip form; its reconstructed SHA is checked. The 5 MiB gradient binary is deliberately excluded and is rebuilt by the script; its SHA is recorded. No dist/build/map/cache directory or specification PDF is included.

`previous-gpu-attempt` preserves the original runner, shader/source files, manifest, root attempt record and the unexecuted follow-up. To restore its original fixture too, use `python3 restore-fixture.py --previous-gpu`. The previous runner is historical evidence, not an instruction to repeat the blocked audit. No numerical GPU result was recovered; the cause remains unknown. The original files there are preserved byte-for-byte, including their original absolute imports and external-layout assumptions.
