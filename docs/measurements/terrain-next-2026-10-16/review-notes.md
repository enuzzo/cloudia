# Next terrain reduction: independent notes, 2026-10-16

Read-only review of cycle10 `RESULTS.md`, `final-results.json` and archived `all-unresolved.json` / `final-summary.json`. No retrace, metadata generation, GPU, bake or product edit.

## Evidence and priority

At cap16 the midpoint variant leaves 666/5198 unresolved (394 home-down, 231 coastal-horizon, 40 level-sea-miss, one targeted). At cap64, 292 remain. Cap16 already makes 31226 height calls / 250382 metadata loads. Increasing caps is not a structural answer. Many listed unresolved already have a nonpositive witness, so finding a point inside is not the only problem: certifying the earlier prefix remains expensive. The list alone cannot identify how many pending cells are coast-transition versus inland plateaus.

## Exact plateau specialization

Store a conservative coast classification per node, using the coast interval *including its CPU numerical ledger*:

- `coastUpperCPU <= 0`: CPU smoothstep is exactly zero; height is exactly zero, provided remaining source operations are finite. Skip the four ridge noises, range noise and pow. Geometry traversal becomes the radial sea predicate on that interval. A local water cell does not justify a global sea hit: all earlier non-water intervals must still be certified outside.
- `coastLowerCPU >= 13`: CPU smoothstep is exactly one. The geometry height evaluation can omit coast noise/sin/smoothstep while preserving the ridge/range source order. The ideal plateau must also be covered for the derivative shortcut.
- Else: use the full original field. Never classify from the center alone or from sampled coast values.

Global `relief=0` already makes terrain irrelevant on the whole ray. Both the current product and the prototype already have a sea-only path; avoiding the prototype’s two unnecessary terrainHeight evaluations helps that prototype but is not a new optimization versus the product. For the sea-only prefix use the earlier two-radial-error bridge and a real witness. Do not use a height-zero cell to skip an earlier coastal ridge.

Plateau specialization is the lowest-risk candidate because the branch is an exact algebraic simplification, not a modified surface. Its limitations are unresolved transition cells, metadata fetch/divergence cost, and possible shader register pressure. It will not automatically resolve tangents in fully inland rough terrain.

## Component envelopes

For a cheap second-stage classifier, separate positive ridge contributions `h=sum a_j*ridge_j²` and the positive range factor. After a subset of source octaves, enclose omitted contributions by their precomputed node ranges plus the source rounding ledger. Push this h interval through the monotone power and positive products; use it to certify an outside point/prefix before evaluating all six noises. Keep a full original evaluation for accepted occupied witnesses.

This is most useful away from the surface. The remaining amplitude after only octave0 is about0.403, after octave1 about0.153, and after octave2 about0.046; their height uncertainty is much larger than1m in many cases. Thus component envelopes cannot be assumed to finish the final contact cheaply. Report actual noise/hash evaluations and metadata fetches, not only calls to a now-partial height function. Do not silently relax the cap or numerical ledger.

## Directional gradient metadata

A camera-oriented basis can reduce loss from independent world gx/gz intervals. Compute bounds for `gradH·u` and `gradH·v` directly through analytic directional AD, then project each ray into that basis at runtime. Merely taking dot products of the existing gx/gz box offline provides no new correlation information.

A single orthonormal basis still needs four gradient floats per node, so memory can stay unchanged. However its usefulness depends on the ray fan and terrain orientation, and camera-dependent rebuilding is unacceptable at the existing8.63s preparation time. A fixed small set of direction bins or two added diagonal projections avoids per-frame rebuilds but increases fetches/memory. Adding both diagonal min/max pairs costs16 bytes/node, about1.67MiB for109141 nodes, before extra runtime arithmetic. This is a candidate to falsify, not a proven improvement.

## Small falsifiable renderer proof

First add only plateau classification, with no cap increase or component/directional expansion. Freeze two exact rays/poses from the existing corpus: one known sea/zero-inland interval and one unresolved coastal boundary neighbor. Also retain `low-x-16-dy0` as a deliberately difficult inland control. Use one fixed render state and viewport; compile the real Three/TSL path, execute a small explicit probe (not a sweep), and export source/metadata hashes, ray inputs, classifications, original-field witness, prefix/enclosure, actual noise counts, metadata fetches and GPU validation errors. A normal full-frame output must show classification/unresolved coverage rather than silently falling back to the old Newton result.

Reject promotion if any transition is classified as plateau without its ledger margin; any new hit lacks a <=1m enclosure and occupied original-field witness; any prior certified hit/miss contradicts the new result; shader compilation or finite GPU checks fail; unresolved work is hidden; or the matched renderer probe does not reduce real work/time. Compilation success, fewer CPU calls, or an isolated sea-only speedup is not evidence of full-quality60FPS. Directional metadata and component envelopes should be separate follow-ups so the cause of any gain or regression remains testable.
