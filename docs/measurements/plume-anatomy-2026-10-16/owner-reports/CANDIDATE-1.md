# Anatomy candidate 1 — technical handoff, 2026-10-16

Status: frozen for full-quality browser assessment. No artistic acceptance claimed.

Baseline: `59bb8d3`. Preserved original source: `before/volume.ts` and `before/volume.test.ts`. Interrupted input: `resumed-input/`. Exact candidate: `visual-candidate-1/manifest.json`.

The candidate removes the uniform 18 billows plus four rounded children around each liquid nucleus, and the equivalent repeated rounded population on ice cores. It adds a few unequal, continuous rising/overturning branches tied to each actual updraft. Five unequal, stretched tapered branches per ice core follow the outflow. The authored broad lower/middle bodies, unequal tower heights, local collars, family-dependent cap origins, and sparse ice streaks remain.

The new positive-inside field is a tapered capsule in normalized coordinates, scaled by `min(stretch)/(1+abs(radiusChange)/normalizedSegmentLength)`. Distance to a segment is 1-Lipschitz, projected radius is at most `abs(radiusChange)/length`-Lipschitz, and the coordinate transform has norm `1/min(stretch)`, so the resulting analytic field is at most 1-Lipschitz in world space. Coincident endpoints reduce to the enclosing ellipsoid. Invalid nonfinite, negative-radius or nonpositive-stretch input is rejected. Positive support bounds include the larger radius at both segment endpoints. Smooth union retains the existing analytic slope bound.

Macro resolution256³, detail128³, nominal ray budget384, output, extinction, material/fine-density evaluation, and optical-depth bake code are unchanged. No new cache or per-frame texture is added. All source changes are CPU generator/helper code.

## Targeted verification

Command: `npm test -- src/cumulonimbus/morphology.test.ts src/cumulonimbus/volume.test.ts --maxWorkers=1`.

Result: 30/31 passed; morphology5/5; volume25/26. The existing 32³ mass-centroid difference check fails: seed72/73 vertical centroid separation0.117593557km against threshold0.12km. The same probe at64³ is0.121972098km. No assertion was weakened and no shape parameter was tuned to this threshold. The upper-mass fraction over3km is0.13467 congestus and0.20562 multicell at64³. This is diagnostic evidence; it does not approve the failed test or establish visual family quality.

All other existing volume checks pass, including deterministic bytes, connected bulk, middle-section fill, multicell elevated separation/unequal summits, outflow shear, face clearance, and finite-light/material behavior.

The new helper test independently checks analytic cross sections and closed caps, 16,000 deterministic point pairs over tapered/anisotropic/very short/degenerate segments for a world-space field-change bound, positive support inside the raster AABB, and invalid parameters.

An external instrumented CPU probe evaluates the displaced/fine-density sampler unconditionally at every voxel that the existing bake prefilter would skip. Baseline and candidate, seeds72/73/74, sizes32/64/128: zero false-empty samples. Exact records, inserted instrumentation and source hashes: `support-skip-probe.json`, `cpu-*-support-probe.ts`, `*-probe-source-sha256.txt`. This verifies these sampled grids; it is not a universal proof or a256³ browser result. No repository source was changed for the probe.

## Browser decision required

Compare exact seed72/73/74, fixed state, front and quarter, with baseline. Primary risk: removing equal-sized rounded decoration may expose overly smooth parent masses. Evaluate hierarchy, cap connection, occupied depth and unequal cell structure as rendered at full configured output; revise or retire if shape becomes less natural. Numeric connectivity and the Lipschitz bound are not visual acceptance.
