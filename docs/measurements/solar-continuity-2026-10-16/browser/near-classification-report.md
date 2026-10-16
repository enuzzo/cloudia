# Seed72 near-camera material classification — frozen59bb8d3

This is CPU density/optical-depth evidence, not a render or lighting acceptance. No product file was changed, no cloud was baked, and no GPU/browser was used. The exact cached256³ macro,128³ detail,16³ half-float filtered motion field and frozen material/camera sources were verified by byte counts and SHA256 before evaluation. Nominal render quality remains384 steps.

## What surface=.4 actually means

`profile=1&surface=.4` supplies a0.4km **radius from the target at approach100%** and bypasses ordinary surface finding. It does not put the camera400m outside cloud. Intermediate zoom is exponential: distance=16*(.4/16)^approach; at80/95/100% it is0.836511642/0.481019842/0.400000000km.

At t60, wind=.55, dispersion0, pitch0, the explicit FPS target is `[-.28995623264629566,2.4981598424383944,-.02734375]`. All nine tested fixed-.4 cases on this exact target (yaw0, +.765, -.765; approach80/95/100%) begin in material: rho0.091678–0.840578. All six original front cases on the reset and separately computed recenter targets also begin in dense material: rho0.659974–0.756973. A featureless near image from these poses cannot by itself establish a boundary-lighting discontinuity. It remains a legitimate interior/immersive test; this audit does not declare the resulting image acceptable.

| Exact FPS target, yaw | Approach | Origin density rho | Axial depth behind rho>.025 front boundary (m) | Center distance to tau1 (m) |
|---|---:|---:|---:|---:|
| +0.000 | 80% | 0.745010 | 540.00 | 79.03 |
| +0.000 | 95% | 0.755442 | 895.49 | 74.27 |
| +0.000 | 100% | 0.712559 | 976.51 | 81.33 |
| +0.765 | 80% | 0.840578 | 951.04 | 66.95 |
| +0.765 | 95% | 0.645229 | 1306.53 | 79.86 |
| +0.765 | 100% | 0.737700 | 1387.55 | 74.91 |
| -0.765 | 80% | 0.091678 | 43.66 | 104.44 |
| -0.765 | 95% | 0.604221 | 399.16 | 98.68 |
| -0.765 | 100% | 0.557664 | 480.18 | 103.05 |

The depth column is one-dimensional distance on the orbit ray, not nearest Euclidean clearance to an exact physical surface. Density has no unique solid surface.

## External near poses for browser comparison

Use profile mode, t60, forcing/precipitation0, wind55%, dispersion0, frozen shape, no autorotation and pitch0. The positive yaw is exactly eight ArrowLeft presses at1280px CSS canvas width; negative yaw is eight ArrowRight presses. Each press changes yaw by36/1280*3.4=.095625rad. At another width use the actual width or an exact equivalent drag; eight keys would not reproduce the same yaw. Aspect used is1280/720. Native DPR does not change CSS key increments.

Ordinary approach probing searches the conservative support, samples rho>.025 and adds3m along the viewing ray. `ordinary radius` below is its full-approach distance from target. All six tested ordinary origins have rendering rho0 after current near microerosion. The reset front origin without that microerosion has rho0.003789; exact-target negative quarter has rho0.011020. Thus the3m probe margin is not a guarantee of zero density before erosion or across every pixel.

For reproducible comparisons use `surface=external radius` from the next table, matching the explicit target, yaw, pitch and approach100%. This adds100m to the **baseline ordinary radial estimate**, not a universal clearance guarantee for changed morphology. All six padded origins are rho0 with and without near microerosion. Five sparse rays first meet rendered material82–106m ahead; candidate geometry must be checked independently.

| Target | Yaw | Ordinary radius (km) | Ordinary center first material (m) | External radius (km) | Padded center first material (m) | Padded min of5 rays (m) |
|---|---:|---:|---:|---:|---:|---:|
| reset-center | +0.000 | 1.343189001415423 | 6.0 | 1.443189001415423 | 106.0 | 96.0 |
| reset-center | +0.765 | 1.930423660955128 | 5.0 | 2.030423660955128 | 105.0 | 82.0 |
| reset-center | -0.765 | 0.850590001068189 | 5.0 | 0.950590001068189 | 105.0 | 103.0 |
| exact-fps-target | +0.000 | 1.379511357419404 | 3.0 | 1.479511357419404 | 103.0 | 103.0 |
| exact-fps-target | +0.765 | 1.790548392397764 | 4.0 | 1.890548392397764 | 104.0 | 93.0 |
| exact-fps-target | -0.765 | 0.883175550384368 | 2.0 | 0.983175550384368 | 102.0 | 99.0 |

Reset target: `[-.41015625,2.48828125,-.02734375]`.

Exact FPS target: `[-.28995623264629566,2.4981598424383944,-.02734375]`.

Do not equate the exact FPS target with the original audit’s computed t60 recenter target `[-.288783282435141,2.4984131977082673,-.02734375]`; they differ by about1.20m. The supplement treats them separately.

Example baseline front external URL (then fixed comparison state, pitch0 and approach100%):

`http://localhost:4188/?seed=72&profile=1&surface=1.4795113574194039&target=-0.28995623264629566,2.4981598424383944,-0.02734375`

For yaw+.765 use surface1.8905483923977644 and eight ArrowLeft keys at1280px; for yaw-.765 use surface0.983175550384368 and eight ArrowRight keys. A front radius cannot be reused after orbiting and still claim the same near clearance.

## Numerical scope and limitations

- Original12 cases:168672 material evaluations. Supplement54 cases:759024 evaluations in about546ms. Original support/material source hashes match the existing cached bake manifest; no new bake was needed.
- Float64 CPU calculations and CPU half-float/trilinear emulation are used, not WebGPU f32 or GPU readback. The three input binaries are independently hash checked.
- Five sparse view rays per case use1m integration to2km; center is repeated at0.5m. Across54 supplementary cases, tau1/tau3 crossing changes by at most0.00881m on halving the step. This supports those sampled density integrals, not all pixels or radiance.
- Rendering’s rho<.002 cutoff and inspection microerosion are included in material classification; ordinary probing intentionally omits microerosion as current product does. Dynamic dispersal is0 in this fixture.
- No RGB/radiance, temporal contrast, scattering, cache-light interpolation, image quality or actual384-step render has been measured here. No claim about sun-toggle continuity follows from these density probes.
- Historical phase/local-light/reconstruction experiments used seed1571198069, target[.4296875,2.9365234375,0], fixed radius.6045067691053366. This audit has no corresponding material cache and cannot numerically classify that historical origin. Do not transfer seed72’s result to it.
- Poses are qualified only for frozen59bb8d3 seed72 anatomy and the documented state. Seeds73/74 or candidate morphology require their own boundary evidence.

Files: `near-probes.json`, `probe-near.ts`, `near-probes-supplement.json`, `probe-near-supplement.ts`, frozen source snapshots, input source/data hashes.
