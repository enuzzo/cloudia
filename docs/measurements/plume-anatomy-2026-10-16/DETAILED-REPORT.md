# Plume anatomy experiments 1–3 — rejected, 2026-10-16

**Decision: none of these three anatomy trials is promoted. Photographic anatomy remains FAIL.** Candidate1 reduced repeated small rounded attachments but exposed smooth parent masses. Candidate2 changed the larger geometry and still produced cylindrical walls, narrow necks and a hooked upper shelf. Candidate3 corrected a real ownership bug in candidate2; the corrected seed 74 render retained the same dominant problems.

The local product generator has been restored to `59bb8d3`: `volume.ts` SHA256 `86a575e16bd23439f72ebe0ebc24cb6cea5900b22ac79321ca3e4366ac7afd74`. The experimental `morphology.ts` and its test are absent from the product. Their exact candidate versions remain in the archive. Restoration preserves the previous generator; it does **not** grant that generator photographic acceptance. Final integrated checks are recorded separately by the coordinating task.

## Scope and evidence

The trials changed only the CPU morphology generator and its tapered-sweep helper. Macro 256³, detail 128³, nominal 384 steps, configured native output, material/extinction, optical-depth bake, runtime motion and texture budgets were preserved. No extra per-frame cache was introduced. The full-quality browser session used native2560×1440 rendering in a 1280×720 CSS viewport; the archived screenshots are **1280×720 JPEGs**, not native-resolution readbacks. Those JPEGs cannot independently certify the configured internal pixel dimensions or preserve every rendered fine feature.

The [curated archive](README.md) contains 21 browser images, exact owned source snapshots, compressed reversible patches, numerical records, the diagnostic code and portable replay. Generated volume binaries, builds, dependencies and complete duplicate frozen source trees are excluded.

| Evidence | Coverage | Limit |
| --- | --- | --- |
| Browser baseline | Seeds 72/73/74, front0 and quarter0; extra seed 72 front35 | Each shape follows its own support-center target; not an identical world-camera or pixel A/B |
| Candidate1 | All three seeds at t 60, front0 and quarter0 | Qualitative anatomy decision at matched UI pose |
| Candidate2 | All three seeds at t 60, front0 and quarter0 | Qualitative anatomy decision at matched UI pose |
| Candidate3 | Seed 74 at t 60, front0 and quarter0 | Seeds 72/73 were not recaptured; their 64³ buffers match candidate2 exactly |
| CPU support probes | Seeds 72/73/74 at 32³/64³/128³ | Finite sampled grids, not universal or 256³ proof |
| Contraction replay | Candidates2/3, all three seeds at 64³ | Exact generated-buffer and transform-record comparison, not rendered quality |

The **baseline seed 72 quarter0** was captured after Home recentered to the cloud center plus drift; the candidate quarters used comparison reset-center. It is excluded from strict pose-matched comparison. The seed 72 front0 and seed 73/74 front0/quarter0 comparisons share the intended UI orientation/approach, but their world target still follows each support center. The extra seed 72 front35 is context only. No pixel-difference or exact-camera claim is made from this set.

## What changed and why it was rejected

| Trial | Implementation | Visible result and decision |
| --- | --- | --- |
| Candidate1 | Replaced the uniform 18 billows × 4 children population around each liquid nucleus, and repeated ice decoration, with a few unequal tapered rising/overturning branches tied to the actual updrafts | Fewer repeated globules, but smooth barrel-like parents and a broad lower plate became more exposed. Seed 74 retained the U-shaped void and hooked roof. **Rejected** |
| Candidate2 | Linked narrower bases and unequal heads through continuous sweeps; enlarged selected crown branches; removed congestus' authored ice roof; gave multicell unequal sources; tied sheared outflow to local mature sources | Seed 72 became a broad body with deep cavities and vertical walls. Seed 73 still resembled two chimney-like columns on a shallow common skirt, with truncated heads. Seed 74 retained the shelf/neck/gap structure and acquired a thin central tooth. **Rejected** |
| Candidate3 | Cloned each sweep's start/end/stretch arrays so in-place axis contraction applies once; all authored geometry and parameters otherwise unchanged from2 | In the two actual seed 74 images the thin protrusion shifts, but the hooked roof, sky gap and dark vertical wall persist. **Rejected** |

Examples: [seed 73 candidate2 quarter](browser/candidate2-seed73-quarter0.jpg), [seed 74 baseline quarter](browser/baseline-seed74-quarter0.jpg), [seed 74 candidate3 quarter](browser/candidate3-seed74-quarter0.jpg). The attached judgments concern those rendered images, not a meteorological rule that every separated tower or every gap is invalid.

The next useful geometry investigation is an actual inclined, fed shoulder connecting a substantial upper body into asymmetric expanding outflow, together with the full extent of the younger head. More small protrusions or surface noise would leave the dominant structure unchanged.

## Numerical checks and the preserved failure

The helper expresses a positive-inside tapered capsule in normalized coordinates. Its radius slope and coordinate stretch are included in the field normalization; the field is not an exact signed distance to the tapered surface. Tests cover closed caps, taper, anisotropy, degenerate/short segments, support bounds, invalid input and 16,000 deterministic point pairs. These checks and the mathematical slope argument support the helper implementation; finite probes do not prove every generated shape or every 256³ sample safe.

The focused command was `npm test -- src/cumulonimbus/morphology.test.ts src/cumulonimbus/volume.test.ts --maxWorkers=1`.

| Version | Reported focused result | Existing32³ centroid separation72→73 |64³ |128³ |
| --- | --- | ---: | ---: | ---: |
| Candidate1 |30/31; helper5/5, volume25/26 |0.117593557km |0.121972098km |Not recorded |
| Candidate2 |30/31; helper5/5, volume25/26 |0.116189935km |0.124296119km |0.124008691km |
| Candidate3 |31/32; helper6/6, volume25/26 |0.116189935km |0.124296119km |0.124008691km |

The existing assertion requires a separation greater than 0.12 km at 32³. It **fails** in all three trials; the threshold was not changed. Higher-resolution results do not turn that test green, and none of these numerical distinctions constitutes an anatomy PASS. These focused results are recorded in the frozen owner reports; they are not a claim that the final integrated product suite used these retired sources.

At every voxel skipped by the bake support prefilter, external instrumented probes re-evaluated the same displaced/fine-density sampler. Baseline and candidate1 had zero observed false-empty samples across seeds 72/73/74 and32³/64³/128³. Candidate2 re-evaluated 5,710,907 skipped samples with zero observed misses; candidate3 has its own corresponding record. No 256³ support probe was run for these rejected trials. The probe changes are external and are preserved as audit code, not product instrumentation.

## The candidate2 alias bug is real and isolated

Adjoining sweeps reused mutable vertex arrays. Axis contraction visited every sweep start/end, so a shared coordinate could receive the same contraction twice. Candidate3's constructor gives every sweep its own start/end/stretch arrays.

For seed 74, X scale is **0.736423839920452**. Candidate2 has 13 shared vertex arrays, up to 2 applications, and a maximum coordinate error of **0.49030210674437447km** compared with the intended once-scaled path. Candidate3 has no shared vertex arrays, 1 application and zero measured error. One shoulder's intended X is 1.228965973 km; candidate2 places it at 0.905039841 km.

Seeds 72/73 have X/Zscale 1, so density, fullRGBA and sunset buffers are byte-identical between 2 and 3 in the measured64³ runs. That is why they were not recaptured for 3; it is not a claim that a new 256³ rendered comparison was performed. The original59bb8d3 generator has no sweep arrays and is unaffected by this experimental alias bug.

`node docs/replay-contraction.mjs` runs the two self-contained generated audit modules and compares all six 64³ outputs against the preserved records, including source/helper hashes, density/RGBA/sunset hashes and every contraction entry. It uses Node built-ins only and ignores no substantive output fields. There are no timestamps or source paths in the compared records. The replay passed locally; it requires neither the current product source nor an installed project dependency tree.

## What the upper-body sections establish

The [section records](numerical/candidate-2-seed74-material-sections.json), [primitive metadata](numerical/candidate-2-seed74-primitive-metadata.json) and archived external diagnostic code distinguish authored geometry from material thinning:

- At x 0.6/y 4.0km, macro density is zero along the whole sampled Zline: this sampled void already exists in authored geometry.
- At x 0.6/y 4.4km, integrated Z optical depth is 0.1633, compared with 10.5811 in the main column at x −0.2/y 4.4. Positive raw support at the shoulder fringe does not guarantee substantial final mass.
- Sampled continuous trunk center fields are 0.52–0.92. The slope normalization can thin the boundary; these center samples do not show it hollowing the trunk.
- The deep ice-source center has macro density 0.68284 and fine density 0.24750; removing only the multiplicative material factor in an external intervention gives 0.54127. Its lower half remains dense. Ice thinning contributes to the far outflow but cannot alone replenish the lower geometric void.
- The younger summit's full authored upper extent reaches y 4.59427 km before erosion. Comparing center heights alone misses its competition with the mature visible crown.

The older collar connects only the head at y 4.60938 to the local source center y 4.90601; this short local link does not feed the missing inclined shoulder near x 0.6/y 4.0. These are sampled CPU diagnoses of candidate2, not a full fluid simulation, proof of uniqueness of the cause, or visual acceptance.

## Final boundary

All three experiments are archived and retired. The product retains the previous generator, and the original anatomy, close-light, precipitation/landscape, UI and full-quality FPS requirements remain active. This experiment supplies reproducible rejection evidence and a more specific next geometry question; it does not close those gates.
