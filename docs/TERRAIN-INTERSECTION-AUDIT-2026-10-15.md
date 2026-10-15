# Terrain clearance and intersection review — 15 October 2026

Read-only review of the current `landscape.ts` and `GPUSceneEngine.ts` terrain
camera clamp. No solver, renderer, source material or performance setting was
changed. The small mathematical reproductions below generate no cloud volume and
are not GPU readback or visual acceptance.

## Camera clamp and integer coordinates

The new camera floor is coherent with the authored radial terrain surface.
`landscapeSurfaceY(x,z,c)` solves
`length([x,y+6375,z]) = 6371 + terrainHeight(x,z) + c` on the upper local hemisphere.
Thus the default 0.2 km margin is radial clearance, not simply a vertical offset.
The CPU and WGSL use the same Earth center `(0,-6375,0)`, sea radius 6371 km and
cloud datum 4 km above sea level. The reachable local orbit is well inside this
hemisphere; the helper is not a global arbitrary-coordinate planet API.

The clamp raises only y and preserves the input array, x/z and target. The engine
rebuilds forward/right/up from the actual clamped origin afterward, so the view
continues to point at the chosen focus. Full authored terrain height also bounds
the rendered faded height, whose relief multiplier lies in `[0,1]`. These checks
support camera clearance; they do not establish correct terrain occlusion on all
view rays.

Negative lattice coordinates use `floor` before the fractional interpolation on
both CPU and WGSL. CPU `x|0`/`Math.imul` and WGSL `i32`/`bitcast<u32>` preserve the
same two's-complement low 32 bits before the unsigned avalanche hash. For example,
−1 becomes `0xffffffff` in both paths. The high 24-bit output is exactly f32
representable. No sign or negative-fract mismatch was found in the reachable
coordinate range. Final height still has ordinary f32 contraction/transcendental
rounding uncertainty; this source review is not a rendered parity test.

## Concrete unresolved intersection failure

`landscapeDistance`, currently lines 106–117 of `landscape.ts`, performs six
unbracketed updates. Its denominator includes only the radial sphere derivative;
it omits the derivative of terrain height along the ray. It also clamps that
radial denominator to at most −0.045. Neither this denominator nor six iterations
guarantees a root or the first surface hit.

A reachable case uses approach 0, yaw π/2, pitch 0, aspect 16/9, UV`(0.5,0.9)`,
tangent half-FOV 0.2867 and target `[0.4296875,2.9365234375,0]`. The ordinary
home distance is 16 km. The terrain camera floor does not move this origin.

- Origin: `[16.4296875, 2.9365234375, 9.797174393178826e-16]`.
- Normalized ray: `[-0.9641481825534892, -0.26536443258056197, -5.903704928339342e-17]`.
- Sea-sphere intersection: 26.162488204960255 km; relief multiplier 1.
- Six-pass returned distance: 25.97482993938811 km.
- Radial terrain clearance at that returned point: −1.5801926304511653 km.
- First detected positive-to-negative crossing in a 5 m forward scan, refined by
  bisection: `[23.13768181218734,23.137681812188504]`km.
- The returned distance is 2.8371481272 km beyond that crossing.

| Iteration | Distance km | Terrain clearance km |
|---|---:|---:|
|0 |26.162488205 |−1.552657008 |
|1 |20.281951721 |1.493780694 |
|2 |25.921167192 |−1.589576646 |
|3 |19.901604542 |1.614947414 |
|4 |25.996963059 |−1.576509516 |
|5 |20.026634058 |1.575848593 |
|6, returned |25.974829939 |−1.580192630 |

This oscillation is a failure of the mathematical solver, independent of small
CPU/GPU rounding. The crossing is the first detected by that 5 m scan, not a formal
proof against every earlier narrow tangent feature. The large nonzero clearance
alone proves the returned point is not a surface root. The CPU reproduction uses
the current f32 terrain-height reference and double ray/sphere arithmetic; it does
not claim these exact distances were measured on the GPU.

Reproducible artifacts retained in the repository:

- Script: [terrain-intersection-case-2026-10-15.ts](experiments/terrain-intersection-case-2026-10-15.ts).
- Output: [case.json](measurements/terrain-intersection-2026-10-15/case.json).
- Landscape SHA-256: `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`.
- Script SHA-256: `2e1c7be23d890797c9ae1c1511e916b8dfe656d74cde0c69ea1784d8bbabec46`.
- Output SHA-256: `2f15da8b0cca8b811d249bc197561b2f1dc6b8bf5d8af31898b6cc02a7f95b57`.

The script uses relative imports and asserts the expected landscape source hash
before evaluating the witness. Run
`bun docs/experiments/terrain-intersection-case-2026-10-15.ts [output.json]`.
The default destination is the retained measurement. Its rerun reproduced the
numbers above with `generatedVolumes: 0`; no browser or GPU benchmark was used.
The separate GPU terrain-height parity/clearance audit does not validate this
six-pass intersection solver.

## Possible bound for a future solver, not an implementation plan

In exact arithmetic, cubic value-noise interpolation has per-axis derivative
bounded by 1.5, hence Euclidean gradient at most `1.5*sqrt(2)`. The squared ridge
term has gradient at most four times that value. Applying the four authored
frequency/amplitude pairs gives the following conservative bounds:

- Octave sum max `h = sum(.58*.43^j) = 0.98275606`.
- Octave-sum gradient at most 1.15680566.
- Coast gradient at most
  `hypot(1,.2) + 6*.045 + 9*.055*1.5*sqrt(2) = 2.33985748`.
- Inland-factor gradient at most `(1.5/13)*2.33985748 = 0.26998356`.
- Range-factor gradient at most `.45*.018*1.5*sqrt(2) = 0.01718270`.
- Terrain height at most 3.24845152 km and terrain gradient at most 5.71804855.

For a unit ray and the existing constant per-ray relief multiplier `r`, the
clearance function therefore has Lipschitz bound
`L <= 1 + r*5.71804855*length(ray.xz) <= 6.71804855`. An outside distance divided
by such a bound suggests conservative advancement in the mathematical model;
it is not a signed distance. A real implementation needs finite-precision safety
margins, convergence tolerances and a proof or conservative method for the first
hit. The global bound is loose and could require many terrain evaluations.
Uniform marching with hundreds of iterations per pixel is not an acceptable
assumption; any future change needs a bounded cost model and profiling plan,
possibly tighter local or hierarchical bounds. Nothing was implemented here.

## Independent gates retained

- Sea-sphere-only horizon: the shader refines terrain only when `earthDistance`
  already hits sea. A mountain above the sea horizon can be missed. Relief also
  deliberately fades between sea distances 90–180 km. Camera clearance does not
  repair either limit; expanding the intersection model requires separate scope.
- Terrain lighting uses a tangent-plane height normal rather than the exact
  curved radial-surface normal. This approximation is small in the local orbit,
  but it is distinct from correct curved intersection and clearance.
- The engine's reported `altitudeKm = origin.y+4` is height above the local tangent
  datum. True radial sea altitude is `hypot(x,y+6375,z)-6371`; the difference grows
  with horizontal distance. This does not invalidate the radial clamp.
- The scene's f32 sea-sphere discriminant can lose precision close to the horizon;
  no GPU precision audit was performed in this review.

The camera-floor fix and these remaining intersection/lighting limits must be
reported separately. No terrain solver expansion is authorized by this audit.
