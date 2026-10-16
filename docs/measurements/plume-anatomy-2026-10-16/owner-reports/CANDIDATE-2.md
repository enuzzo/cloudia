# Anatomy candidate2 — frozen for browser assessment

Baseline59bb8d3; current candidate volume SHA256 `5cf1fdd548be860cdae1dc1eca4f1bf2e8eac94daf82f9063bc5b0610d8d01b9`. Exact source snapshots and hashes: `visual-candidate-2/manifest.json`. The helper and tests are unchanged from candidate1.

Candidate1 was visually rejected after actual full-quality seed74 front/quarter images: repeated globules decreased, but smooth walls, a deep horseshoe void and hooked outflow remained. Candidate2 therefore changes the structural density field, rather than increasing surface noise.

Changes:

- Each updraft's separate base and head are linked by two continuous tapered sweeps through its own unequal expansion height and width. The previous intermediate ellipsoid, neck ellipsoid and buried updraft ellipsoid were removed. Broad base ellipsoids are narrower, while the individual ascending columns retain volume above them.
- The crown has3–4 larger unequal rising branches per actual column. Only selected branches turn over into the shoulder; the others end as a growing rounded head. There is no uniform shell of18billows plus4children per buried nucleus.
- Congestus has no authored ice roof or horizontal ice streak band. Common material/height-dependent glaciation remains, so this does not make the whole cloud artificially liquid.
- Multicell retains separate maturity heights and a young intermediate pulse. The older and younger cells receive outflow sources of different width/depth.
- The sheared family's deep source overlaps its mature summit, then expands into a slightly higher downstream core. Sparse fibres are tied to these actual local sources, replacing the old world-height band that could hang above the column.

The analytic sweep field remains at most1-Lipschitz; radius/stretch validity, coincident endpoints, taper, support and16,000 point-pair changes are checked by the helper tests. All changes remain in the CPU morphology generator/helper. Macro256³, detail128³, nominal384steps, full output, density/material/extinction, light bake and runtime textures remain unchanged.

## Numerical results

Focused test command: `npm test -- src/cumulonimbus/morphology.test.ts src/cumulonimbus/volume.test.ts --maxWorkers=1`.

30/31PASS: helper5/5 and volume25/26. Existing centroid-separation assertion at32³ still fails0.116189935km against0.12km. No test threshold or geometry parameter was adjusted for this assertion. Other tests, including dense component connectivity, middle-section fill, distinct elevated multicell towers, summit heights, shear and texture-face safety, pass.

Actual generated-density centroid separation between seed72 and73:

| Resolution | Vertical separation km |
| --- | ---: |
|32³|0.116189935|
|64³|0.124296119|
|128³|0.124008691|

Every voxel skipped by the bake support prefilter was independently evaluated with the same displaced fine-density sampler on those3resolutions and seeds72/73/74: 5,710,907 skipped samples re-evaluated, zero nonzero densities missed. This is sampled CPU evidence; it is not a general proof or a256³ browser verdict. The exact instrumented source, source/helper/bundle hashes, and repeatable CLI are in `candidate-2-32-64-128-probe.*` and `probe-candidate.mjs`. Product source was never changed to instrument the probe.

256³probe intentionally deferred while root performs browser QA, to avoid overlapping heavy CPU bake with the render comparison. Root will decide based on visual assessment whether more verification is warranted or the candidate should be retired.

## Remaining decision

Root owns front/quarter comparison for all3families at full configured output against immutable v48. Candidate2 has no artistic PASS. Any test sampling change requires actual higher-resolution evidence and a reason linked to the measured requirement; the existing assertion is preserved pending that evidence.
