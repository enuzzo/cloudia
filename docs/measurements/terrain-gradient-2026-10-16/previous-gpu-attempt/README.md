# External terrain GPU candidate and audit harness

This directory contains a concrete metadata pack, a CPU traversal of that exact
serialized pack, generated WGSL/TSL, an unapplied shader integration draft, and a
native WebGPU audit page. This agent did not modify product source. The author of this package
has not created a device, run GPU code, rendered a frame, generated a cloud volume,
installed dependencies or built the product.

## Ready-to-run audit

Serve this directory on localhost (root will use port 4182), open `index.html`, and
press **Esegui audit**. Nothing starts automatically. The harness creates a device
only after that click. It reports phases during adapter/device/shader/pipeline and
readback work, destroys buffers/textures/device, and exposes:

- `#audit-summary`: compact JSON suitable for CUA inspection.
- `#audit-json`: complete JSON including every GPU ray and rectangle result.
- **Scarica JSON**: native download of the same complete artifact.

The harness fetches only local assets in this directory. It verifies SHA-256 of
metadata, ray and rectangle binaries, records source hashes, shader compilation
messages and uncaptured device errors, and uses the original `LANDSCAPE_WGSL`
without changing its height functions. Its native WGSL is the same candidate
entry/helper source wrapped in compute audit kernels. It is not an FPS benchmark.
Extra point samples for the audit are explicitly outside the trace-call budget.

The page currently contains **5,198 rays**: matrix14 plus four real OrbitView poses
with 48 by 27 pixel-center ray grids. The poses cover a downward home view, level
sea-miss horizon, low camera floor looking upward, and coastal horizon. Both the
camera clamp and projection reproduce current product code. All inputs sent to
the GPU are f32, and the CPU oracle is evaluated at those exact input values.

There are also **254 rectangles**, including matrix-hit boundaries, negative
coordinates, coast/tile boundaries, positions around the specified sine-accuracy
range, zero-width/1m/62.5m/1km boxes and coarse world regions. The GPU reports its
analytical bound and nine original terrain-height samples per rectangle. The
host compares those with the CPU field and the inflated metadata envelope.

## Representation selected

Use `terrain-32km-coarse-1km-local.rgba32f.bin` and its descriptor:

- Domain: x/z from -512 to +512 km.
- Coarse leaves: 32 km. A full quadtree covers the domain.
- Local refinement: only the central [-32,+32] km square is subdivided to 1 km.
- 6,821 nodes; each node is two RGBA32F texels / 32 bytes.
- Texture: **256 by 54**, **221,184 bytes (216 KiB)** including padding.
- Saved CPU preparation run: approximately 142 ms; no GPU upload or device involved.
- Candidate 16 km coarse pack is also included for comparison: 10,901 nodes,
  352,256 bytes. It did not materially improve the targeted trace counts.

Each node stores an analytical min/max interval, first-child index, level and
world rectangle. Children are four contiguous records. The builder intersects a
node's direct analytical interval with the union of its four valid child bounds.
It never builds bounds from sampled extrema and never substitutes a sampled
height surface. Texture loads use exact integer texels, no linear filtering,
no ordinary averaged mipmaps, no sRGB transform.

`data.ts` uses the previously tested analytical CPU builder. Metadata is expanded
by **20 m** on each side and rounded outward. This is a conservative enlargement
for that CPU contract. Its adequacy as an all-GPU envelope is **not proved**;
`heightGuardUniversallyQualified` and `GPUQualified` remain false. Beyond the
specified WGSL sine-accuracy range, the coast bound uses the full inland interval.

The 216 KiB pack is concrete and small; this is not an enormous fine atlas. Outside
local refinement the solver keeps coarse nodes and performs selective analytical
subdivision. Domain exits remain explicit unresolved states. A changed landscape
formula/hash requires regeneration; camera motion does not change the field.

## Targeted CPU qualification of the packed ABI

Run `bun qualify.ts`. It reads the serialized float records through `PackedLookup`,
not the builder's JavaScript node objects, then traces the original 14 rays.

With the same ceilings encoded in WGSL — **256 visits, 16 original height calls,
48 stack entries, 1 m physical enclosure** — the 32 km pack resolves 11 hits and
3 misses, with maximum 188 visits, 12 height calls and stack depth 17. Across the
14 rays it uses 64 original height calls, 928 visits, 468 dynamic analytical
queries, and 2,972 metadata texel loads. The 34,105 independent original-height
point checks against those pack nodes all pass. The 16 km pack adds 54,505 passing
node point checks; these samples are bug detectors, not the analytical proof.

`qualification.json` includes counters, intervals, source and implementation
hashes. This establishes the CPU serialized-data path only. It does not establish
identical WGSL interval arithmetic or device performance.

## Expanded CPU matrix already exposes unresolved cases

`make-audit-cases.ts` generated all f32 GPU inputs and their independent CPU oracle.
It deliberately retains every unresolved result:

| Pose | Hit | Miss incl. outer envelope | Height-budget unresolved | Contact unresolved |
|---|---:|---:|---:|---:|
| matrix14 | 11 | 3 | 0 | 0 |
| home-down, 48x27 | 1,052 | 215 | 20 | 9 |
| level-sea-miss, 48x27 | 202 | 481 | 122 | 491 |
| low-clamped-up, 48x27 | 0 | 1,296 | 0 | 0 |
| coastal-horizon, 48x27 | 635 | 644 | 17 | 0 |

Totals: 1,900 hits, 2,639 misses, **159 height-budget** and **500 contact unresolved**.
These failures are concentrated at grazing/horizon rays. They prevent product
promotion even if matrix14 passes on the GPU. The proposed architecture has not
reduced rendering quality to hide them, increased the nominal cloud step, reduced
resolution or changed the terrain field. Fixing those paths requires additional
refinement/error reasoning or explicit continuation; this harness provides the
reproducible cases. Small residuals or a continuous-model bisection cannot stand
in for a first entry proof of the stepped CPU field.

## WGSL/TSL interface and limits

`helpers.wgsl` reuses original `terrainHash` and `terrainHeight`. It implements
interval arithmetic, finite cell enumeration (at most 64 cells per noise query),
analytical octave bounds, metadata loads, stable radial altitude and a 16-entry
cache of original point evaluations. `entry.wgsl` performs near-first traversal,
sea-miss terrain search, final original-field witnesses and explicit budget checks.

Its result is `vec4(tLo,tHi,status,visits*32+heightCalls)`:

0 = miss; 1 = hit; 2 = visit budget; 3 = height budget; 4 = stack overflow;
5 = metadata-domain exit; 6 = numeric/precision contact; 7 = unqualified metadata.
Only status 1 authorizes a hit distance. Every status above 1 stays unresolved.
There is no Newton fallback and no silent sky substitution.

`terrainTrace.generated.ts` provides a Three186 `wgslFn`, an include node for the
existing cloud integrator, and a nearest-filtered FloatType DataTexture adapter.
Its qualification uniform defaults to **0**, so an ordinary caller receives
status 7 until an explicit experimental GPU QA opt-in. The native audit page
intentionally sets that test-only opt-in to 1.

`cloudShader.integration-draft.ts` is an **unapplied draft** showing the new texture
and count parameters, dependency include and terrain call before cloud/rain depth
clipping. It handles sea misses. Unresolved pixels are bright magenta in this QA
draft and cannot count as valid output/FPS. This package did not change the product shader.

The real Three186 parser accepts the function ABI: origin/ray vec3, metadata
texture, record count and qualification float, vec4 result. The generated adapter
and data builder pass standalone TypeScript checking. This is not WGSL compilation.
No offline Tint/Naga validator is installed; actual module validation occurs in
the audit page and must be checked before any integration.

## Numeric qualification remains open

The GPU helper deliberately differs from the tight CPU reference: each interval
operation expands outward by an adjacent f32 value, sine bounds include the WGSL
specified-range uncertainty, and power uses a declared trial guard. The outer
sphere has a 10 m larger envelope, and stable radial tests use a declared 1 cm
allowance. These enlarge searches/uncertainty, not the terrain surface. Their full
interaction, FMA behavior and grazing classification have not yet been qualified
on a device, and the CPU matrix cannot be presented as having executed them.

The metadata 20 m envelope is an engineering trial allowance, not a universal
certificate. The audit reports GPU containment and CPU/GPU differences directly.
Its `finiteAuditPassed` concerns checked consistency; the separate
`productPromotionGatePassed` also requires no unresolved or disjoint CPU/GPU hit
intervals. Neither closes renderer imagery, worker parity, sustained FPS or all
reachable-ray acceptance. The shader's actual local stack/register cost is open.

[WGSL floating-point accuracy](https://www.w3.org/TR/WGSL/#floating-point-accuracy)
defines the relevant constraints; bounds outside a stated builtin input range
cannot be inferred by adding an arbitrary tiny epsilon. No external terrain
rendering code was copied.


The integration draft is pinned to cloudShader SHA d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd.
Root has a concurrent narrowCloud experiment in that product file; the draft is
not automatically applicable over that work. Reconcile the separate authorized
changes explicitly before any future integration. The terrain audit depends on
the unchanged landscape field, so this concurrent shader experiment does not
change its saved terrain inputs.
