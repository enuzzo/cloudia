# Original-field terrain intersection — next candidate

This is a concrete implementation proposal, not a promoted solver. Product files,
GPU state and browser state were not modified. No cloud volume was generated.
Source read: `src/cumulonimbus/landscape.ts`, SHA-256
`72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`.

## Recommended change

Replace six unbracketed Newton-like updates with **ordered interval traversal of
conservative height metadata**, followed by original procedural-height evaluation.
The metadata stores lower/upper bounds on the existing continuous authored field
inside each tile. It is not sampled geometry, a bilinear height texture, a new
noise realization, or a replacement for `terrainHeight`.

Keep `terrainHash`, `terrainNoise`, `coastDistance`, `terrainHeight`, their numeric
constants, octave transforms, palette and final procedural evaluations unchanged.
Corrected intersections will intentionally differ from current incorrect hits.
The source-level height field can remain identical; bit-identical CPU/WGSL final
heights are already not guaranteed by the current implementation.

## Search domain and above-sea-horizon mountains

For each ray define `F(t)=length(origin+t*ray-center)-R-r*H(x(t),z(t))`.
`H` is exactly the authored `terrainHeight`; `r` is a constant for that ray.
Use an outer spherical envelope `R+r*Hmax`, with an outward bound on `Hmax` (3.25 km
is above the current ideal mathematical 3.24845152... km maximum; it still needs
a finite-precision ledger before a portable GPU certificate is claimed).
Search the forward portion of that envelope, including rays that miss sea.
When a positive sea hit exists, the endpoint can be the first sea hit, since
`H>=0` ensures some crossing occurs no later. When sea is missed, search to the
outer-envelope exit. Camera clearance makes the reachable origin outside terrain.
Do not retain the `earthDistance>0` condition in `cloudShader.ts` as the gate for
terrain tracing: that condition is itself the horizon defect.

There is a separate design decision concerning the current distance fade:

- Preserve existing sea-hit rays exactly: `r=1-smoothstep(90,180,tSea)`.
- Proposed minimum extension for a sea-miss ray:
  `r=1-smoothstep(90,180,max(0,tClosestApproach))`.
  At the sea tangent, `tSea` and `tClosestApproach` coincide, so this continuation
  has no mathematical discontinuity at that boundary. Nearby upward/level rays
  retain mountains. This is a definition for previously absent terrain, not a
  consequence of the old code. Keep it explicit in the experiment's metadata.
- Do not silently replace the old constant-per-ray fade with `fade(t)` while
  claiming exact equivalence: that changes the rendered surface on existing rays.

Use `a=dot(ray,ray)` rather than assuming the normalized f32 vector has exactly
unit length. Sphere coefficients should avoid the current subtraction of two
numbers near 4e7. With `h0=origin.y+4`, compute
`c=origin.x^2+origin.z^2+h0*(2*R+h0)`. A stable quadratic formula reduces ordinary
cancellation; it is not by itself a grazing-ray certificate. An uncertain
outer-envelope discriminant must mean “search/uncertain”, never “no terrain”.

## How to build valid metadata without changing geometry

Each tile records `Hlo,Hhi`, rounded outward, then each parent records the minimum
of child lowers and maximum of child uppers. Access by integer cell/level load;
never linearly filter or use ordinary averaged mipmaps for these bounds.

Construct leaf bounds analytically from the current field:

1. Transform the tile rectangle through each existing octave transform, enclosing
   the rotated rectangle by an axis-aligned rectangle in that octave's noise
   coordinates. Losing correlation makes the bound looser, not a new surface.
2. Split noise rectangles at integer lattice boundaries. Inside one cell the
   smoothstep coordinate is monotone. Bilinear interpolation attains extrema on
   the four corners of the restricted smooth-coordinate rectangle. The exact
   current integer hashes give its coefficients. Union all touched cells. A very
   large rectangle may fall back to the global noise bound rather than enumerate
   unbounded numbers of lattice cells.
3. Propagate the noise interval through the triangular ridge, its square, positive
   octave weights, monotone power, coast smoothstep and positive range multiplier.
   A ridge interval crossing noise=.5 has upper ridge=1; otherwise its endpoint
   values bound it. Its lower bound is the minimum endpoint ridge. Include all
   per-operation numeric uncertainties before recording `Hlo,Hhi`.
4. A coarse global fallback is `[0,Hmax]`. Any tile outside a finite metadata
   domain must use this fallback or dynamic analytic subdivision, not a false miss.

A practical first layout to measure is a static 1024-by-1024 array with 1 km cells
covering [-512,512] km in x/z, two f32 channels, plus min/max pyramid. Memory is
8 MiB at the base and approximately 10.67 MiB including all mip levels. This is a
budget example, not a measured optimum or sufficient-coverage proof for every
future camera. Clip to the proven outer envelope and verify coverage per ray.
A seed-independent static wilderness permits reuse; regenerate if the landscape
hash/formula changes. Store that formula SHA and bounds-builder version.

First implement the analytic builder and 14-ray CPU reference. No million-tile
bake is needed to validate the builder: lazily evaluate only tiles visited by the
small matrix, compare its bounds with adversarial point samples as a bug detector,
and independently check the mathematical construction. Build the full hierarchy
only after this reference succeeds.

## Ordered traversal and first-root invariant

For a ray interval `[a,b]` inside one tile, radial distance has an exact minimum
at `clamp(tClosestApproach,a,b)`. The maximum is attained at an endpoint. Enclose
both with outward numeric bounds, producing `[radialLo,radialHi]`.

- If `radialLo-R-r*Hhi > 0`, the whole interval is outside: discard it.
- If it cannot be discarded, descend. Traverse intersected children in increasing
  ray t. Handle cell-boundary ties by visiting all relevant cells, or inflate cell
  bounds, so a feature on a tile edge is not omitted.
- Original `terrainHeight` evaluations may tighten intervals at the leaves.
  A proven Lipschitz/interval bound is required to skip between those evaluations.
  Equal-sign endpoints alone are not an empty-space certificate.
- Keep an earliest point whose clearance is proven nonpositive. This provides
  existence of a crossing for the continuous authored model. Keep the earliest
  unresolved front after all earlier intervals have been certified outside.
- Once the nonpositive point is at most **0.001 km (1 m along a unit ray)** beyond
  that front, the first root is enclosed within 1 m. This works even if the first
  unresolved interval's two endpoints are positive: root existence comes from
  the later proven nonpositive point, and no earlier root can precede the front.
- A small residual alone is not existence or distance accuracy. A normal sign
  bracket is not necessarily the first bracket if earlier intervals are unknown.
- A tangent may never produce a negative sample. Preserve it as an unresolved
  possible contact unless interval/derivative analysis proves or excludes it.

Return an explicit result `{status, tLo, tHi, nodeVisits, heightEvaluations}` with
`hit`, `miss`, or `unresolved`; never overload `-1` with both latter meanings.
The cloud/rain occlusion distance can be a selected point inside a certified hit
interval. It must not be an arbitrary endpoint of an unresolved interval.

## Bounded cost and honest fallback

For the first implementation, use a small fixed local stack and **128 node visits
plus 16 final height evaluations per primary pass** as an experimental budget,
not as evidence that those limits are sufficient. Stack overflow, uncertain
numeric classification or work exhaustion publishes an unresolved mask and
remaining interval state. A second pass processes only unresolved pixels,
continuing from saved state in another bounded batch. Gather counts and timing.
The existing six-pass solver is not an acceptable “correct” fallback.

A hard global work ceiling still requires a declared unresolved outcome. Reverting
those pixels to sky misses terrain; returning the earliest possible front can
create false terrain. Neither satisfies the original correctness requirement.
Keep the candidate unpromoted if the actual matrix has unresolved pixels or its
bounded continuation violates the FPS budget. This is a qualification condition,
not permission to quietly choose a wrong fallback. Arbitrarily close/tangent
contacts cannot be guaranteed resolved by a fixed amount of black-box sampling.
A dedicated tangent-root interval/derivative solver is the later fallback if
actual reachable rays require it; metadata makes that cost selective.

## Numeric equivalence limits that must stay visible

The current CPU uses explicit fround while WGSL permits contraction, reassociation
within its rules and implementation-specific builtin results. A global ideal
Lipschitz constant applied directly to f32 samples is not a complete GPU proof.
The existing observed maximum parity error (6.44 mm at 512 GPU samples in earlier
work) is finite evidence, not a universal margin.

[WGSL section 15.7.4](https://www.w3.org/TR/WGSL/#floating-point-accuracy) specifies
finite accuracy by operation; where a stated input range is exceeded, its accuracy
is undefined. In particular, the f32 `sin` bound is stated only on [-pi,pi], while
this coast evaluates `sin(z*.045)`. Thus beyond |z|≈69.813 km a small universal
coast epsilon cannot be inferred from that table. The portable certificate can
retain the shader and use the full inland range `[0,1]` (inflated for arithmetic)
for those metadata cells. It sacrifices pruning there; it does not alter terrain.
Do not add argument reduction to the product and label the height field unchanged.
`pow`, interpolation, coordinate transforms and the sphere must likewise have
outward error propagation. Bounds using only the global `[0,Hmax]` route must be
proved for current finite arithmetic before being called GPU certificates.

For a practical first Apple/Metal candidate, label a tested numeric envelope as
platform-qualified, keep uncertain classifications on the conservative path and
state its finite tested domain. A portable all-implementation guarantee is a
larger requirement. Neither a dense scan nor random GPU parity validates every
point or rules out every tangent.

## Saved lightweight diagnostics

Run `bun cost-probe.ts` in this directory. The script imports the unchanged product
CPU height and refuses an unexpected landscape SHA. It generated zero volumes,
used no GPU/browser, and evaluated only 14 rays plus a 25 m witness-finding scan.
`cost-probe.json` contains exact origins, rays, counts and intervals. Its global
mathematical bounds are intentionally applied to CPU f32 samples only as a cost
and behavior diagnostic; the result is **not a finite-precision certificate**.

The documented oscillation case is enclosed around 23.1377 km rather than the old
25.9748 km return. The new horizontal ray starts at
`[-16,-3.4163984102497125,0]` with 200 m radial camera clearance and direction
`[-0.9950371902099893,0,0.09950371902099893]`. It misses sea but crosses authored
terrain around 4.752 km. This particular ray is a radial-clearance probe, not a verified OrbitView frame.
The script also saves a framing-valid comparison pose: target `[0,-3,0]`, yaw pi/2,
pitch 0, approach 0, aspect 16/9, ordinary inspection=0 and UV `(0.5,0.42)`. Its
origin is `[16,-3,0]`, the level ray points approximately `[-1,0,0]`, sea is missed,
and the diagnostic encloses terrain at `[22.1651363075,22.1660201201]` km. The URL
accepts this target under the existing profile controls. This is a mathematical
construction from current framing, not browser or GPU verification. The script
saves ten above-horizon sign-crossing witnesses in total.

The global-bound version needs hundreds to 1788 original height
calculations per diagnostic ray, so it is not a sensible per-pixel shader candidate.
This is the reason to build interval metadata before product integration, rather
than raising an iteration cap and assuming the cost is acceptable. Exact current
counts are in the JSON, since conservative rounded bounds change the counts.

## Qualification before product promotion

The next candidate should first pass the documented oscillation witness, the saved
sea-miss rays, sea-only misses, tile boundaries, negative hash coordinates,
near-tangents and old fade boundaries. Check that every skipped prefix has valid
bounds and every hit has a witnessed nonpositive point inside its 1 m enclosure.
Run the original height functions byte-identical and verify CPU/GPU heights and
hit intervals independently, including outside the sin accuracy domain. Then
check main and worker renderers, cloud/rain depth clipping, horizon silhouettes,
near-ground motion, console/device errors and full-resolution FPS. No screenshot
or count in this proposal closes those gates.

The primary [Hart paper record](https://experts.illinois.edu/en/publications/sphere-tracing-a-geometric-method-for-the-antialiased-ray-tracing/)
provides the Lipschitz-distance-bound foundation. NVIDIA's authored
[GPU Gems chapter on cone stepping](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-18-relaxed-cone-stepping-relief-mapping)
explains why missing thin structures and stopping before a true hit survive a
fixed iteration cap. Those principles support this proposal; its texture-height
algorithm is not copied or assumed valid for Cloudia's curved procedural field.
