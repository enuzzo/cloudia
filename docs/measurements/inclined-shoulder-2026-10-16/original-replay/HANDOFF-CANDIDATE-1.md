# Inclined upper shoulder — candidate 14.1

Status: runtime frozen; numerical checks complete; root owns the remaining browser judgement. No broad artistic PASS is claimed.

Baseline: `08c33cb`. Baseline geometry SHA256: `86a575e16bd23439f72ebe0ebc24cb6cea5900b22ac79321ca3e4366ac7afd74`. Sources: `baseline/` and `baseline-manifest.json`.

Runtime snapshot: `candidate-1/manifest.json`. Final test revision: `candidate-1-r2/manifest.json`; runtime bytes are unchanged. Owned product files are `volume.ts`, `inclinedShoulder.ts`, and `inclinedShoulder.test.ts`. No engine, shader, UI, or weather changes.

## Cause verified on the actual baseline

CPU sections at 64³ were located using each seed's actual mature/young summits and ice sources, without reusing coordinates from the retired generator. At the selected seed 74/77/80 points, every fine-density sample along Z is empty. Seed 74 also has zero macro density along the entire line. Seeds 77/80 have weak macro density erased by the unchanged fine sampler. At 256³, all three sections remain empty after fine erosion.

The old head-to-cap collars start too high to occupy the missing inclined upper-body shoulder. Baseline grid, actual primitives, and records are in `baseline-sections.json`.

## One structural change

Only the sheared family gains one inclined ellipsoid. Its lower anchor starts 68% of the way from the mature cell's foundation to its head. Its upper anchor enters the local ice source. Width and depth derive from the actual contracted head, foundation, and cap dimensions. The primitive is applied after horizontal contraction and after every existing decoration/RNG call: no original lobe moves and no extra noise population is introduced.

The helper rotates through an orthonormal basis, scales normalized signed distance by the smallest radius, and computes the analytic rotated AABB. The field is at most 1-Lipschitz, preserving the existing fine-warp/bake pruning contract. Prepared coordinates are owned numeric values; no caller array is mutated or shared under later transforms. The primitive enters the same raw field before the unchanged density, detail, occupancy, and five-direction optical-depth bake.

Macro 256³, detail 128³, nominal 384 steps, full configured output, light/extinction/material/erosion coefficients, and runtime cache/shader paths are unchanged.

## Focused tests and small-grid comparison

Command: `npm test -- src/cumulonimbus/volume.test.ts src/cumulonimbus/inclinedShoulder.test.ts --maxWorkers=1`.

Result: **31/31 PASS**. The 26 existing volume tests are unchanged. Four helper tests cover prescribed sections, endpoint interior, 12,000 point pairs for the slope bound over rotated/anisotropic/vertical/short shapes, analytic support, coordinate ownership, and invalid inputs. The fifth new test reproduces the measured baseline seed 74 section at 64³ and requires positive fine-density presence after erosion. It uses material presence, with no artistic threshold or moment tuning.

At 32³ and 64³, seed 72/73 density, RGBA, sunset, and detail buffers are byte-identical to baseline. Sheared density never decreases. At 64³, only 354/340/234 macro voxels increase for seeds 74/77/80. Resulting optical-depth changes can extend along light rays. All 1,033,017 candidate samples skipped by the bake prefilter were independently re-evaluated: zero nonzero densities missed. Records and fixed section coordinates: `comparison-32-64.json`.

## Full-resolution CPU qualification

Command: `node --expose-gc probe-cycle14.mjs 256`. The executed command also attempted `nice -n 10`; scheduler priority adjustment was denied, but Node continued and exited 0. No FPS measurement window ran concurrently. Buffers were hashed and released with explicit garbage collection between volumes. No large binary volume archive was written.

Ten serial volumes were checked: baseline/candidate, seeds 72/73/74/77/80, at macro 256³ and detail 128³. Source, bundle, and dependency hashes are in `comparison-256.json`. The CPU source closure is frozen under `baseline/`, `candidate-1/`, and `shared-source/`.

- Seed 72 and 73 density R, full RGBA, sunset RG, and detail RGBA SHA256 values are identical between baseline and candidate.
- All **140,692,504** skipped bake-input samples across both versions were re-evaluated with the actual displaced fine sampler: **zero densities missed**. Candidate-only count: 70,343,143; modified sheared seeds: 42,846,825.
- Every one of the six macro-face clearance values is exactly unchanged for all five seeds. The smallest clearance among sheared seeds is 1.03515625 km at seed 77, positive X. These are macro-density footprint margins; root owns rendered motion/scene qualification.

| Seed | x km | y km | Baseline tau Z | Candidate tau Z | Candidate max fine density |
| --- | ---: | ---: | ---: | ---: | ---: |
| 74 | 0.560923 | 4.045844 | 0 | 13.816658 | 0.892696 |
| 77 | 0.472604 | 3.699297 | 0 | 11.575198 | 0.870232 |
| 80 | 0.526504 | 3.978208 | 0 | 8.971558 | 0.898149 |

This is numerical CPU evidence at the configured volume/detail resolutions. It is not native GPU sampling or artistic acceptance. Compact summary: `NUMERICAL-256-SUMMARY.json`.

## Direct image feedback by anatomy agent

Inspected actual seed 74 baseline/candidate front, quarter, side, and rear JPGs in `cycle14/browser`. Front and rear show a thicker, more supported incus underside while preserving surrounding detail. The candidate does not expose the barrel-like wall that invalidated the previous generator experiments. Quarter and side mostly occlude the new mass, so their small difference cannot establish its shape. The cap source becomes rounder/heavier, and the global hooked/U-shaped silhouette remains.

This supports a local connection improvement only. Full photographic incus acceptance remains open pending root's other seeds, low sun, rain, and motion views. Reject or revise from actual rendered imagery if the added mass creates a smooth wall or worsens the silhouette.
