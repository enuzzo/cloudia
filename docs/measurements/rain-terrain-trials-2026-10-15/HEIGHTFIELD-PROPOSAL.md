# Single proposal: shared canonical heightfield and ordered hierarchy

Status: standalone CPU design/prototype only. No Cloudia product source changed,
no cloud volume generated, no WebGPU cost or image-quality claim.

Replace the unbracketed six-pass terrain root with a shared, stored R32F world-Y
heightfield. The new canonical surface is bilinear within each cell. It is an
approximation of the current procedural function, not an acceleration structure
that conservatively bounds that original analytic function between samples.
Measure that representation change independently from intersection correctness.

A min/max hierarchy bounds this interpolant exactly in real arithmetic because
bilinear weights are nonnegative and sum to one inside each cell. Traverse node
boxes front-to-back. At a candidate cell, substitute the ray into the bilinear
surface: the resulting equation is quadratic. Solve both roots stably, accept only
roots within the cell's clipped ray interval, and retain the nearest root. Empty
nodes are skipped with no procedural terrainHeight evaluation. No Newton step or
fixed uniform stepping is part of the proposed intersection.

The CPU witness uses a sorted worklist for clarity. Do not copy that sorting or a
large per-fragment stack into WGSL. The intended GPU traversal is hierarchical2D
DDA: the ray projection orders disjoint cell intervals, skip to a cell boundary
when its bound is empty, descend at the same t when its height range is possible,
and ascend after boundary crossings. Keep coordinates/mip/t rather than dozens of
stack entries. Boundary ownership must depend on ray direction; a blind t epsilon
can skip features and is not an accepted fix. This stackless traversal needs its
own equivalence/counter test before GPU integration; the current CPU worklist
counts do not measure its register use or bound-lookup count.

The standalone prototype stores leaf bounds for convenience. A GPU version can
omit that leaf level and directly read the four corner heights when a leaf is
reached. Higher levels remain explicit min/max reductions; automatic averaged
mip generation or filtered min/max lookup is invalid. Use textureLoad, including
for the four corner samples, so float32 filtering support is not required.

The cloud/rain integrator receives the resulting nearest terrain distance exactly
where it currently receives groundDistance. The 256³ macro,128³ detail,384 nominal
steps and native output remain unchanged. The four corner heights also provide
bilinear derivatives and a surface normal, avoiding the extra procedural
terrainHeight evaluations currently used in landscapeColor. Existing coastal and
canopy/rock color noise can remain a separate appearance operation.

## Sea and full-scene coverage

The sea-sphere intersection is a candidate distance, never a prerequisite for
searching terrain. Search terrain bounds even when the sea sphere is missed.
Return the nearest of a valid terrain hit and sea hit. A finite patch miss must
remain miss-in-domain, not a claim that the entire planet is empty.

For a finite, fully defined product model, use a world-anchored terrain window
and an infinite analytic sea. One concrete layout to evaluate is:

- Fine core:64×64km,1024² cells,62.5m spacing.
- Coarse field:512×512km,2048² cells,250m spacing.
- Both anchored to the scene, not snapped to the camera every frame.
- Fine boundary nodes are forced to the coarse bilinear edge values, making the
  shared representation continuous at the resolution transition.
- Coarse cells inside the fine core are excluded from coarse traversal. Do not
  take the union of two overlapping coarse/fine terrains: the higher coarse
  surface could incorrectly win inside the fine core. Each domain has its own
  bounds, and valid hits from the disjoint domains compete by nearest distance.
- Outside a world radius160km, taper authored nodal relief smoothly to zero at
  radius224km. This is a proposed explicit distant-geometry change, replacing the
  old view-dependent90–180km fade; it requires agreement and visual qualification.
- Define the actual surface as max(analytic spherical sea, canonical grid surface).
  The ray hit is therefore min(valid sea hit, valid grid hit). Where nodal relief
  is zero, the bilinear chord of the concave spherical sea lies below the analytic
  sea; the union hides that chord and joins to the infinite ocean without a hole.

That last policy makes the finite world complete and handles mountains above the
sea horizon within its authored window. It does not claim an infinite procedural
mountain range. Until that policy is agreed and tested, this prototype remains a
local patch only. It cannot qualify the full navigable scene.

CPU camera clearance must use the same canonical surface, then add the200m margin
radially: from shared surface y at x/z, obtain its radius and solve the upper
hemisphere at radius+0.2km. Do not keep clamping against a different procedural
height or add0.2 vertically as a substitute for radial clearance.

## Resource and runtime scope

With R32F heights and RG32F min/max levels excluding the leaf level, the proposed
fine/coarse layout needs about33.36MiB of GPU data and the same CPU payload before
transfer. This adds 2D resources only. There is no full-resolution extra depth
buffer in this proposal and no change to cloud textures or output resolution.

The local prototype covers64×64km at125m spacing (512² cells). Its bounds include
the leaf level, so its actual memory is intentionally not the optimized estimate.
Counters distinguish bounds checked, nodes visited, cell roots, authoring height
evaluations and runtime procedural evaluations. The finite local CPU ray sample
cannot predict a native6.29million-pixel GPU frame. Cache coherence, divergence,
stack/register pressure, horizon cases and other cloud work must be profiled.

A hard traversal budget must never silently turn unresolved into miss or hit.
The prototype exposes unresolved with the earliest pending interval and any
provisional root. A product candidate needs a qualified completion/fallback policy
and telemetry. Returning sea or a false terrain wall upon budget exhaustion would
not satisfy first-hit correctness. If the selected hierarchy exceeds the runtime
budget under qualification, do not promote it merely by lowering that budget.

## Required gates before product work is promoted

1. Representation error against the current procedural surface: deterministic
   interior points, cell phases, coast, diagonals, peaks and core/coarse seams;
   report signed/max/RMS errors separately from root error.
2. Mathematical intersections: planar/vertical/negative-coordinate/boundary rays,
   two forward roots in one bilinear cell, exact tangency, near-linear equations,
   long grazing paths, sea misses with mountain hits and nearest-hit ordering.
3. Exhaustive cell-DDA reference of the same stored field; unresolved remains a
   separate state in correctness and cost statistics.
4. GPU readback against the same f32 payload, especially small direction components,
   cell corners, tangent discriminants, long distances, conservative node-box
   rounding and all resolution/outer-ocean seams. CPU f64 roots are not GPU proof.
5. Native3344×1882 isolated terrain cost and complete-scene GPU timing at low orbit,
   horizon views, portrait and rain. Report node/leaf/stack percentiles and every
   budget exhaustion; no cost claim is made from a CPU324-ray subset.
6. Actual image guards for silhouettes, coast, terrain/cloud/rain occlusion and
   orbit continuity, without accepting a new landscape merely because roots pass.
7. Worker/main resource transfer, ready/teardown/regeneration/device-loss cleanup,
   source hashes and explicit canonical-model metadata.

Primary sources informing the design, not performance evidence for Cloudia:

- Musgrave, Grid Tracing for Rendering Height Fields, chapter3 of his dissertation:
  https://www.kenmusgrave.com/dissertation.pdf . Cell traversal and intersection
  are separate, and ordered heightfield traversal avoids repeated 3D samples.
- NVIDIA GPU Gems2, Terrain Rendering Using GPU-Based Geometry Clipmaps:
  https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry . Nested terrain grids require
  explicit transition treatment; their published performance is not ours.
- NVIDIA GPU Gems3, Relaxed Cone Stepping for Relief Mapping:
  https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-18-relaxed-cone-stepping-relief-mapping . Relaxed cone methods and subsequent binary
  search do not by themselves establish the first-hit invariant needed here;
  this proposal instead uses exact cell equations on its declared interpolant.
