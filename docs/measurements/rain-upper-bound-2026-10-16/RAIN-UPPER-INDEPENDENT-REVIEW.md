# Rain upper bound — independent review

2026-10-16. Read-only product review; no source edit, GPU work, cloud bake or
build. The external candidate is being prepared separately by `rain_landscape`.

## Verdict and proposed guard

The halo-one maximum is conservative in the mathematical linear-filter model.
For the isolated candidate I recommend a single explicit tolerance:

```text
RAIN_BASE_UPPER_GUARD_KM = 3/255 + 2^-15
                         = 0.011795223460477941 km  (11.7952234605 m)
Bmax = maxEncodedG/255*3 - .5        // CPU f64, uploaded as f32
Ymax = .72 + (Bmax-.72)/growth.x + .3 + RAIN_BASE_UPPER_GUARD_KM
perform original rain optical block only if rainRegion && rp.y <= Ymax
```

Leave the existing rain box/interval, entry jitter, t, ds, cloud path and loop
termination unchanged. The guard must precede BOTH rain-map lookups and leaves
the already initialized rain extinction/source at zero when skipped. Equality
runs the original branch. `rp` must remain `position-drift`, not world position.

This is a CONDITIONAL numerical certificate: the tolerance covers a filtered
G overshoot of at most one encoded UNORM8 code plus the ALU budget below.
No portable GPU claim follows from that assumption until the actual sampler is
qualified; one code is not a numeric accuracy requirement I found in WebGPU.

## RG/filter/support proof

Scan each encoded R>0 texel and all its Chebyshev-distance-one neighbors, clipped
to [0,size-1]. Take maximum G over this set, including R=0 neighbors. Whenever
the FINAL RG lookup has column.r>0 under a nonnegative linear filter, at least
one of its four contributors has positive R. The other contributing G texels
are at most one index from it. Thus ideal column.g <= maxEncodedG/255.

The two channels share this final lookup/footprint, but G has its own values;
R/G are not premultiplied. Max G over only positive R is unsound. A high-G
zero-R diagonal/edge contributor is a required adversarial case. Far empty
sentinel G values outside this one-index neighborhood cannot contribute to a
positive-R final sample. GuessUV/shear can select a different final point but
cannot defeat its maximum. The strict final UV-domain check and clamp-to-edge
sampler preserve the argument at the borders; no wraparound halo is needed.

The current texture has linear min/mag, mipmaps disabled, no comparison, and
anisotropy one. Linear chooses two texels per dimension. The WebGPU note about
implementation-dependent *anisotropy* is not an exception to this linear case.

## Numerical ledger and its boundary

Current motion gives height in [.68,1], so the SHARED uploaded growth.x is finite
and in [1,1/.68] (about [1,1.470589]). A positive error deltaG in sampled G changes
base by 3*deltaG/growth.x <= 3*deltaG. Therefore deltaG<=1/255 is covered by
3/255 km, without assuming CPU/GPU agree with the unquantized base moments.
The actual encoded map is the reference; RG8 source rounding needs no additional
5.882 m allowance once its bytes define Bmax.

For ALU, use E=2^-21 km=0.4768371582 mm as a deliberately loose one-ULP budget:
all length-like intermediates here have magnitude below4. Add/subtract/multiply
are correctly rounded; division permits2.5ULP. Counting upload/conversion,
original top expression, bound expression, literals/reassociation and the
smoothstep endpoint comparison with a32E allowance gives at most15.2587891 mm.
The chosen2^-15 km=64E=30.5175781 mm leaves a factor-two margin on this ledger.
The smoothstep check includes subtraction of its two edges and division before
clamp: merely reaching an ideal endpoint without margin would not prove t=1.
The same rp.y and growth.x are used by both paths, so camera/world-coordinate
roundoff is shared rather than an extra independent position error.

This ledger covers f32 arithmetic; it does not derive a texture-sampler numeric
ULP bound. If actual filtered G can overshoot the neighborhood maximum by more
than1/255, or a zero-only R footprint can return positive R, the certificate is
not established. A larger arbitrary epsilon is not a substitute for this check.
If future growth permits height>1, either scale the filter allowance by
1/growth.x or disable the optimization outside the qualified range.

## Qualification still required

Use an inexpensive GPU sampler audit on synthetic RG8 maps, without a cloud
bake: constant G extrema, checkerboards, one positive-R texel, R=1 byte against
R=0, high-G R=0 axial/diagonal neighbors, all-zero R, edges/corners and UVs just
either side of texel boundaries. Compare the same sampled final RG against the
CPU encoded neighborhood max and test the endpoint clamp at growth extremes.
The test should report actual positive G overshoot, all-zero R behavior and
max final attachment beyond the guard; these are different from mean RGB error.

CPU tests should independently verify encoded-byte maximum/halo and empty maps;
growth .68/intermediate/1; guarded attachment zero including equality; and
identical point/step/jitter sequences. Matched images and repeated timing then
decide utility. No actual Gmax, avoided-sample count or FPS benefit is claimed.

## Primary references and source snapshots

- [WebGPU filter/sampler contract](https://www.w3.org/TR/webgpu/#enumdef-gpufiltermode): linear footprint/interpolation and clamp addressing. Source text was also checked in the [official spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs).
- [WGSL](https://www.w3.org/TR/WGSL/), sections15.7.4–15.7.5: arithmetic accuracy, division2.5ULP and permitted reassociation/fusion. No explicit textureSampleLevel result-error allowance was found there.

- `precipitation.ts` SHA256 `561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72`
- `cloudShader.ts` SHA256 `d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd`
- `motion.ts` SHA256 `62cf7af24ade712c46e710c0607d09549391672845703108e1380e36e2027bb2`
