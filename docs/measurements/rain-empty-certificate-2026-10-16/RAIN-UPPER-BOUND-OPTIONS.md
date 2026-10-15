# Rain upper attachment bound — option, not implemented

Read-only assessment, 2026-10-16. This option is separate from the withdrawn
`cloudEmptyUntil` candidate. No product source, map, sampling sequence or build
was changed for this assessment; no volume was generated.

## Proposed invariant

`precipitationFootprint` emits RG8: R is column strength; G encodes the source
base as `round(clamp((base+.5)/3)*255)`. The final shader sample filters R and G
independently. Its vertical attachment is
`1-smoothstep(base-.08,base+.3,rp.y)`, with `rp=position-drift` and
`base=.72+(3*column.g-.5-.72)/growth.x`.

When generating the already resident 64² map, find every texel whose encoded R
is positive. Let Gmax be the largest encoded G among those texels AND all their
Chebyshev-distance-one neighbors, clipping indices at the map edges. If there
are no positive R texels, existing `hasRain` already disables precipitation.
Define:

```text
Bmax = 3*(Gmax/255) - .5
Ymax = .72 + (Bmax-.72)/growth.x + .3 + epsilonFP
```

Keep the existing rain box, `rainNear`, `rainFar`, `rainRegion`, entry jitter,
`t`, `sampleStep`, loop termination and cloud path unchanged. Only bypass the
rain optical block, before its first guess-map lookup, when `rp.y >= Ymax`.
The proposed skip initializes rain extinction/source to their existing zeros.

## Why the bound holds

A positive linearly filtered R sample needs at least one positive-R contributor.
All four bilinear contributors are at most one index apart, so all contributing
G texels occur in the neighborhood scanned above. Nonnegative interpolation
weights give `column.g <= Gmax/255`, apart from GPU floating-point error. The
height transform is monotone because `growth.x=1/height > 0`; current height is
in [.68,1]. Therefore `base+.3 <= Ymax-epsilonFP`, so skipped attachment is zero.
The preliminary guessed base and source shear choose a final UV; they cannot
invalidate the bound on any final positive-R sample.

The one-texel neighbor scan matters: a zero-R texel can still contribute G.
Using only positive-R G is unsound. Using every map G is conservative but often
includes the unrelated 2.5 km sentinel and loses the improvement. This proof uses
the current no-mipmap linear sampler and clamp addressing, including the domain
edges; a sampler or filter change requires review. Use actual encoded bytes,
not unquantized base moments: RG8 height rounding has up to 5.882 m error.
`epsilonFP` is an implementation guard to qualify against GPU decode/filter
error, not an allowance for missing texels. It must cover the CPU-to-f32 uniform cast,
filter error and the shader evaluation order `g*3-.5-.72`; its value has not
been measured.

## Integration points, if later authorized

- CPU: [precipitation.ts](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/precipitation.ts), near `precipitationSourceBounds` or map emission; scan the existing map once, no cloud rebake.
- Upload: [GPUSceneEngine.ts](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/GPUSceneEngine.ts), beside `precipitationFootprint`/`rainBounds` assignment; retain a decoded maximum and pass it as uniform metadata.
- Runtime: [cloudShader.ts](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/cloudShader.ts), guard the rain optical block before `guessXZ`/first rain-map lookup. Apply current growth to the bound each frame, not once at bake.

Do not shrink `rainUpper` to this value in an equivalence experiment: changing
box entry/exit or the union near distance can change sample locations, jitter
phase and interval clipping, including cloud contributions.

## Required tests and honest limits

Test a high-G zero-R neighbor beside low-G positive R; all four corners and map
edges; a lone diagonal contributor; empty maps; RG8 decoding; height .68/1 and
intermediate values; randomized bilinear samples proving the upper bound; and
attachment zero beyond the guarded bound. Compare the full t/ds/jitter sequence
with and without the guard, including rays crossing rain boundaries. A GPU test
must qualify finite precision and the intended sampler, then matched full-frame
images and repeated timing must test the actual performance hypothesis.

Potential saving is up to two rain-map and two detail lookups plus rain math for
the upper empty slab. Every 6 m loop iteration and the cloud path still run.
Opaque center rays may terminate before reaching that slab; upward edge/sky
rays are more promising. Actual Gmax, avoided lookup counts and FPS benefit are
unknown. No geometric, photometric or performance acceptance is claimed.

## Source snapshots read

- `precipitation.ts` SHA256 `561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72`
- `cloudShader.ts` SHA256 `d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd`
- `GPUSceneEngine.ts` SHA256 `9b065a853212191c8af8e3ab63f44a654f4d3918ea59e98af29b4a3c090a6fca`
- `motion.ts` SHA256 `62cf7af24ade712c46e710c0607d09549391672845703108e1380e36e2027bb2`

Peer read-only review (`rain_landscape`) found no counterexample under these
preconditions; this is analytical review, not a GPU precision test.
