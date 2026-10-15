# Lazy bounds for the unchanged Cloudia terrain — cycle 10

Working external CPU reference, not a product patch. No product source was edited,
no cloud volume was generated, and no GPU/browser was started. Run:

```sh
bun /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/terrain-bounds/run.ts
```

`run.ts` imports the original `terrainHeight`, `terrainNoise`, `coastDistance` and
camera clamp. It pins the original landscape SHA-256 to
`72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99` and reuses
all 14 saved cycle-9 poses from the bundled `matrix14.json`, which pins the prior
input artifact SHA. No prior external directory is required to run this harness. `manifest.json` pins this implementation and results.

## Implemented

- `bounds.ts`: min/max intervals for arbitrary rectangles, negative coordinates,
  original integer lattice hashes, restricted smooth interpolation, all four
  octave transforms, ridge products, coast, inland factor, range and power.
- `LazyMetadata`: sparse, lazy quadtree of analytical height intervals. Internal
  nodes are bounded directly; no resampled height surface is constructed. A fully
  materialized pyramid could union child bounds; that upload is not implemented.
- `trace.ts`: near-first traversal through the outer spherical terrain envelope,
  including rays that miss sea. Bounds reject intervals, analytical subdivision
  handles leaf intervals, and original point evaluations confirm the final hit.
  A known nonpositive witness plus a proven-empty prefix encloses the first
  **entry into the CPU occupied set** within 1 m along the ray. This statement
  does not require an exact zero of the discontinuous f32 expression.
- Point evaluations are deferred until the final 1 m band; a wide interval already
  has an analytical bound and does not also need an exact midpoint sample.
- An existence-only lookahead of at most 1 m can provide a negative witness. It
  never discards the unresolved interval or moves the certified prefix forward.
- Budgets on node visits and original height calls are enforced. Exhaustion returns
  `unresolved-budget` or `unresolved-height-budget`, never an invented hit/miss.
  A resumable GPU continuation pass is a next implementation step, not present here.

The authored `terrainHeight` and its inputs remain original imports. Hash constants
are reproduced inside the bound builder because the lattice hash is private; the
original noise function independently checks these bounds at lattice and other
sample positions. Parent quadtree metadata is neither linearly sampled nor used
as final surface height.

The sea-hit relief multiplier is preserved. A sea-miss ray uses the proposed
continuous extension `fade(max(0,tClosestApproach))`. This defines previously
absent terrain and is recorded as an explicit design choice. Ray inputs in the
main matrix are normalized. The quadratic retains `dot(ray,ray)` and hit tolerance
uses physical ray length, so normalization roundoff is not treated as exactly 1.
Arbitrary non-unit ray scaling can affect the legacy distance-based fade outside
its constant region; the regression below deliberately uses relief=1 to isolate
geometry and does not claim a new arbitrary-ray fade API.

## Reproducible finite results

`results.json` reports PASS for the reference checks, not product/GPU acceptance:

- 387 height/coast rectangles; 9,675 sampled positions.
- 1,161 child-rectangle containment checks.
- 1,000 isolated noise rectangles; 9,000 noise samples.
- 4,608 octave-coordinate checks and 6,912 noise/ridge/term checks, including
  simultaneous qx/qz updates and transforms with negative coefficients.
- Negative lattice/cell positions, near-zero f32 neighbors, tile edges, coast
  transitions, and both sides of the specified WGSL sine-accuracy range.
- An additional 100 point-rectangle bounds: widest observed height interval
  0.0486374 m, which is a finite width observation, not a universal error constant.
- A separate coast policy discards sine detail outside [-pi,pi] and uses the full
  inland range; 162 point checks across 18 such rectangles pass.
- A 5 m prefix scan at 62,740 independent original-height positions finds no
  earlier occupied sample. This catches errors; it cannot rule out all narrower
  features and does not replace the interval construction.

All 14 original rays resolve as **11 hits and 3 misses**, with every hit enclosed
within 1 m and an original nonpositive point as witness.

| Method, all 14 rays | Original height calls | Median / max per ray | Visited nodes | Dynamic analytical queries |
|---|---:|---:|---:|---:|
| Global mathematical gradient bound | 7,430 | 526 / 1,728 | 7,145 | 0 |
| Direct analytical interval subdivision | 58 | 4 / 11 | 624 | 617 |
| Lazy quadtree, 1 km leaves | 64 | 4 / 12 | 1,008 | 452 |
| Lazy quadtree, 62.5 m leaves | 64 | 4 / 12 | 1,114 | 304 |

The global-bound comparison is diagnostic: its ideal Lipschitz bound is not a
complete f32 certificate. The analytical builder specifically targets the rounded
CPU expression under the numeric contract below.

The 1 km lazy run creates only 154 metadata nodes over this ray matrix. The 62.5 m
run creates 363. Warm 62.5 m metadata uses 917 existing node loads and 304 dynamic
analytical queries; those dynamic queries perform **7,336 lattice hash calls**,
in addition to the 64 original height evaluations. Cold lazy creation performs
35,712 hash calls. These counts make the extra work visible: “64 height calls” is
not the total tracing cost, and does not by itself prove a GPU/FPS improvement.

The single saved CPU run includes coarse timings to reproduce host behavior.
These millisecond-scale timings are affected by JIT/order/cache and are not an FPS
benchmark, sustained timing qualification, or prediction of Metal register cost.

With **128 visits / 16 height calls per ray**, every tested leaf size resolves
13/14 cases: 10 hits and 3 misses. `low-x-16-dy0` stops honestly at the visit budget.
With **256 visits / 16 height calls**, all 14 resolve: the worst case uses 200 visits
at 62.5 m leaves and 12 original height calls. These are separate runs with their
stated ceilings; no continuation implementation is claimed.

The practical next candidate can therefore start with a coarse static bound field
and selective finer bounds, with a real saved-state continuation for uncommon
rays. A complete 62.5 m grid over the entire 1024 km domain would have 268 million
base cells (2 GiB for two f32 channels, about 2.67 GiB with a full pyramid), so the
small sparse result must not be mistaken for a cheap full texture. A bounded local
clipmap or sparse hierarchy is needed before any GPU integration.

## Witnesses retained

The documented bad Newton case now has a 1 m enclosure around 23.1377 km, rather
than returning a point 2.84 km beyond its first observed crossing. The saved
profile-valid level ray still hits terrain around 22.166 km while missing sea.
Every matrix result includes exact origin, ray, search interval, witness and
counter values; the cycle-9 low-altitude probes are distinguished from the
profile-framing-valid witness by their original provenance.

Independent review found an outer-envelope precheck bug in this external
prototype: it used `sqrt(discriminant)/length(ray)` instead of dividing by
`dot(ray,ray)`. Fixed before freezing. A regression scales the original
`low-x0-dy0.05` direction by 0.5 and 2. The old 0.5 precheck falsely put the exit
behind the origin at -260.2121458; the correct t exit is +112.7506549. Both scaled
rays now produce exactly the same physical hit interval as the unit ray,
`[5.25028324385,5.25077456738]` km (0.4913 m wide). Full values are in `nonunitCases`.

## Numeric contract and limits

This is a CPU fround reference, **not a portable WGSL error certificate**.

- Basic interval operations evaluate extrema with the same finite JS binary64
  operation and `Math.fround` as the imported CPU expression. Monotone endpoint
  rounding encloses this CPU operation; it must not be read as an outward bound
  on an ideal real arithmetic expression or different shader expression.
- The cubic is bounded by its monotone exact range plus absolute guard 2^-20.
  On input [0,1], that exceeds the sum of the source CPU multiply/subtract rounding
  errors. It is not clamped to 1, so possible rounded overshoot remains included.
- Each mix uses guard 2^-21, covering source-order CPU rounding for the bounded
  hash, cubic and row-interpolation inputs used here. The global noise fallback
  is widened to [-2^-17,1+2^-17].
- Ridge squaring does not assume monotonicity across zero or that inflated noise
  is entirely inside [0,1]. The interval includes the source order `(a*r)*r` and
  intersects it with `a*(r*r)` plus guard 2^-21. The independent review estimates
  a difference bound at most about 2^-22 over this bounded domain, so the pad is
  deliberately larger.
- Host `Math.sin` uses a declared absolute allowance 2^-23 around analytical
  extrema; host `Math.pow` uses 2^-22. Their adequacy is finite-qualified on this
  runtime and test set, **not proved for every host libm/input**.
- WGSL sine accuracy outside [-pi,pi] is not prescribed by the published
  [accuracy table](https://www.w3.org/TR/WGSL/#floating-point-accuracy). The optional `unknown-outside-wgsl-range` coast policy keeps the formula
  unchanged and widens inland metadata. It does not qualify the rest of the GPU
  path, whose contraction, builtins and coordinate rounding remain to be audited.
- The trace uses binary64 sphere/slab arithmetic and a 1e-9 km radial allowance.
  This is a small declared CPU margin, not an interval proof for every GPU grazing
  ray. A production GPU envelope requires an outward coefficient/error ledger.
- The main tests use zero additional point-field margin because they compare the
  imported CPU field with its own builder; no universal CPU/GPU parity is inferred.
- Tangent contacts, domain exits, precision floors and exhausted budgets remain
  explicit unresolved states. This finite 14-ray set does not prove every
  reachable camera/view ray resolves under the same ceilings.

Keep the implementation external until the field/error contract is independently
accepted and the GPU implementation has direct height/first-hit readback and
full-output image/FPS evidence. The existing terrain shader is untouched.
