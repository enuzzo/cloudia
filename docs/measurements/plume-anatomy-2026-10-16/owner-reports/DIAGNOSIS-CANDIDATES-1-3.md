# Anatomy experiments1–3: visual rejection and concrete causes

These experiments have no artistic acceptance. Candidate1 and2 were rejected after full-quality browser captures of all three families; candidate3 isolated a real data-ownership bug in candidate2, then was also rejected after root inspected full-quality seed74 front/quarter captures. The hooked roof, underlying gap, straight wall and spire remained. All three candidates are retired; volume.ts is restored byte-for-byte to59bb8d3 and the new helper/test files are absent from the product. See `FINAL-STATE.json`. The original59bb8d3generator has no sweep arrays and is not affected by this experimental alias bug.

## Candidate1

Removing the uniform18×4surface decoration reduced repeated small globules, but exposed smooth parent ellipsoids, a broad lower plate, the sheared central U-shaped void and a hooked roof. Fewer repeated spheres was not sufficient to improve photographic anatomy. Technical bound checks do not override that image judgement.

## Candidate2

The geometry changed: narrow bases, continuous swept columns, larger unequal crowns, no congestus roof, unequal multicell sources, deeper sheared source. The rendered result remained worse than baseline: vertical/cylindrical masses, truncated-looking heads, chimney/skirt in multicell, hooked roof and central tooth in sheared. The 32³centroid difference check also remains failing (0.116189935km vs0.12km);64/128³separations0.124296119/0.124008691km do not grant visual acceptance.

## What the CPU sections actually show

The frozen candidate2 seed74 metadata and exact diagnostic intervention are in `candidate-2-seed74-primitive-metadata.json` and `candidate-2-seed74-material-sections.json`; `candidate-2-material-sections.ts` includes the exact external diagnostic function. Product source was not instrumented.

- At x0.6km/y4.0km, the macro density is zero through the whole sampled Zline. This is a real authored geometric void. Neither the fine ice material nor its light phase created that empty space.
- At x0.6/y4.4km, integrated Zoptical depth is0.1633; the main column at x−0.2/y4.4 is10.5811. The nominal broad shoulder's fringe is optically weak after erosion, despite positive raw support.
- The actual continuous trunk center fields are0.52–0.92. The Lipschitz normalization lowers signed-field depth and therefore can thin boundary density, but these trunk centers still have ample positive depth. There is no evidence that this normalization alone hollows the columns.
- The deep ice-source center is at [0.34915,4.90601,−0.34138]km. Macro density0.68284 becomes fine density0.24750; removing only the multiplicative material factor in an external CPU intervention gives0.54127. The source lower half at y4.60232 has fine density0.69868 with material factor0.96345. The source does have a dense lower core.
- The downwind core center [1.67412,5.06006,−0.46900] has fine density0.10364 vs0.52076 without the material factor. Ice greatly thins this far outflow, but changing ice material alone cannot fill a lower geometric hole.
- The younger sheared summit center is at y3.80315 with vertical radius0.79112, so its upper tip reaches y4.59427 before erosion. Its apparent head can therefore compete with the mature cell's visible lower glaciating crown. Center heights alone do not establish an age hierarchy in the silhouette.

The older cell's collar is authored only between the head at y4.60938 and source center y4.90601. That short local connection cannot replenish a missing inclined shoulder at y4.0/x0.6. A next geometric investigation should measure and author an actual inclined fed shoulder from the older upper body into the expanding outflow, then assess the young-head's full physical extent. Adding surface noise or changing the phase function would target a different cause.

## Candidate3 isolates an ownership bug

Candidate2 reused the exact same array for adjoining sweep vertices. The in-place horizontal contraction visited each sweep start/end separately, so shared vertices received the scale twice. Candidate3 clones start/end/stretch in the sweep constructor. All shape parameters and other geometry are unchanged.

`candidate-2-vs-3-contraction.json` records independent frozen source/helper hashes, exact contraction factors, per-axis reference counts/errors, and density/RGBA/sunset buffer hashes. Instrumented CPU sources are `candidate-2-contraction-audit.ts` and `candidate-3-contraction-audit.ts`.

For seed74, Xscale0.7364238399 acts twice on13shared vertices, causing up to0.490302107km displacement from the intended once-contracted path. The young shoulder should be x1.228965973, but becomes0.905039841, an error of−0.323926132km. Candidate3 has no shared mutable vertex arrays, one application and zero coordinate error. For seeds72/73, XandZscales are1, so the density, fullRGBA and sunset buffers remain byte-identical between2and3at64³. The alias fix cannot cure those two families' already observed visual failures.

The new regression creates adjoining/coincident sections from shared input arrays, performs the same X/Zin-place contraction, and checks the intended positions, single scale and unchanged caller inputs. Helper6/6PASS. Total focused tests31/32PASS, with the same pre-existing32³centroid assertion still failing.

Do not promote candidate3 solely because the ownership bug and support tests pass. A correct transform is necessary for a valid experiment; photographic anatomy remains a separate rendered-image requirement.
