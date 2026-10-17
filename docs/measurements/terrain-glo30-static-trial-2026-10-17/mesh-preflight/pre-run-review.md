# Static pre-run review — mesh source retention witness

17 October 2026. Read-only review of witness/protocol and saved GLO30 preprocessing sources/metadata. No model, test, build, browser or GPU execution. No codec review in this document.

**No blocking defect identified in the reviewed revision.** The placeholder holdout filename was corrected by root before the final source read.

Reviewed SHA256:

- `witness.ts`: `20ec1083acd1c4f3ebcd8abde0d16537d68b1335e198513c60c2e65c2658a1f6`
- `run.py`: `05327742b2ad1681f4e2d51c7eaf9fb7321b9070f44856eaa1e0d4657cfe60bb`
- `../glo30-dem/holdout-native-m.metadata.json`: `f55d618c830a67ed819b95fdb3f49b7c9fa49811f6e9f4d3cee2f6a8fd01ea04`

## Checks

- **Paths, coordinates, units.** Both scripts now use `holdout-native-m.f64le.bin`. The 147456 Float64LE values in metres match the metadata and preprocessing loop: Z outer/X inner, each axis `-48+(4*i+.5)*.0625`, i=0..383; first -47.96875 km, last 47.78125 km, 250 m stride. Preprocessing samples the original GLO30 mosaic directly with X west/Z north, the declared projection and PixelIsPoint coordinates without an extra half-pixel. The witness converts metres to kilometres once. The holdout is off the 62.5 m reconstruction nodes and was produced before clamp/ocean mask/quantization.
- **Canonical comparison and coast.** Before building the candidate, four separate historical SHA checks cover canonical positions, normals, surface and indices. This review checked the enforcement, not a new numerical reproduction of those hashes. Candidate height/gradient use the new source while every coast value is obtained directly from `oldSample(x,z)`, including refinement samples. The fixed holdout land selection also uses the old continuous coast, strictly greater than zero. Neither a favourable new mask nor the requantized coast variant is used for that selection. Changing triangulation can still change rendered interpolation of coast; the report explicitly says so.
- **Geometry and bounds.** The cross-product Y sign is correct for the builder's upward winding. Finite positions/surface, positive near-unit normals, valid vertex references, positive XZ area, contiguous cell spans, hole count=0 triangles and full index coverage are checked before output. Builder limits remain explicit: 2.4 million probes, one million vertices, two million triangles and 64 MiB geometry. The 1537 squared selected source nodes fit the probe cap. No one-pass refinement bound is relaxed here.
- **Runtime gates.** The child has a 20 s CPU limit and a 40 s wall timeout. Terminal RSS is an acceptance gate at 2 GiB, correctly described as measured rather than an OS allocation cap. The output directory refuses an implicit rerun. The RMS gate is fixed at candidate/baseline <=0.9; failed resource or source-retention gates do not authorize GPU expansion.
- **Interpretation.** The reference is the native DSM sampled bilinearly, with negative reference heights clamped to zero consistently before comparison. It is source retention, not independent geographic ground truth. The report retains signed extrema, RMS and improved/worsened/equal counts, and explicitly disclaims a maximum-error certificate, GPU correctness, visual acceptance and FPS. A passing average gate can coexist with local regressions, which must remain visible in the report.

This is a static readiness review only. No actual budget, geometry, RMS or quality PASS is asserted before the authorized run.
