# Outflow prefix preflight — PASS

Executed once after root authorization against source freeze R1 (`e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792`). Script `f887f39852d4c5f85d94da4c16326cd5c47e151c4640425e59b62b77b9184645`; numeric contract `52df1239d515d72589a44ed6eb819941ccb1338ed5acf9389f3ed23d38ac29bc`. No source mutation or retry after execution.

`result.json` SHA256: `967cf30ffc198991946b0b0f61e7e55dc05c70a0792024ddf127f80fcc563833`. Raw terminal return is saved in `raw-run-log.json`.

| Actual fixed seed | Family | Unique primitives A/B | RNG streams/counts | Result |
| --- | --- | ---: | --- | --- |
| 74 | sheared | 1918 / 1918 | Exact A/B identity | Anchor, descendants, contractions and owner-local joint contract PASS |
| 72 | congestus | 2589 / 2589 | Exact A/B identity | Entire recipe Float64 bytes identical |
| 73 | multicell | 2179 / 2179 | Exact A/B identity | Entire recipe Float64 bytes identical |

For seed74 the raw feeding line has F=`[-1.4559957312885672,2.1202193174511192,-0.2833933985233307]`, M=`[-1.0021619838755578,5.264401610377244,-0.3209972643433139]` and original proximal C=`[-0.25,5.85,-0.2]`. Its unclamped height ratio is `1.1862482308803317`, so this is an extrapolation above M. The independently calculated and observed new C both equal `[-0.9176362513060935,5.85,-0.3280009178265471]`.

Raw deltaXZ is `[-0.6676362513060935,-0.1280009178265471]`; after the existing shape transform and before horizontal contraction, the common world deltaXZ is `[-0.7100239172606053,-0.1361275888035775]`. Every one of the 98 direct outflow primitives receives that delta: two core lobes, 20 generic ice billows, 28 cap billows and 48 streaks. Their other components remain exact at that checkpoint. Anchoring consumes no RNG.

| Seed74 contraction | Baseline A | Candidate B |
| --- | ---: | ---: |
| X extent before | 5.714820275428022 | 5.004796358167416 |
| X scale | 0.761178793094101 | 0.8691662334874339 |
| X extent after | 4.35 | 4.35 |
| Z extent before/after | 2.220565369750186 | 2.220565369750186 |
| Z scale | 1 | 1 |

The actual installed whole-axis contractions were independently recomputed and checked for every primitive. Global X contraction changes because the moved outflow sets a different maximum extent. This does not claim unrelated A/B coordinates remain equal.

The inclined-shoulder endpoints derived from each actual post-contraction recipe are A start=`[-0.26384389300564415,3.748263877376555,-0.3285798943862841]`, A end=`[1.0861847431167255,5.072912396886162,-0.21269783235155046]`; B start=`[-0.3012750812200138,3.748263877376555,-0.3285798943862841]`, B end=`[0.6231515389534021,5.072912396886162,-0.34882542115512793]`. B explicitly selects the proximal core, index0. Endpoint arithmetic was recorded before raster; no shoulder density or model was created.

The legacy joint contract passes independently within A and within B: body and outside-selected groups stay exact across that owner's final joint projection, as do non-XZ components. Cross-owner collar identity is outside this contract because anchoring intentionally changes the feeding collar.

Unsheared recipe hashes: seed72 `59b00fa29cd30e18e2240c458a63e9cd34724de23f1f93b0cc6b11e0e92821df`; seed73 `09944c9f6f5b976d3666d9dc91008815cda53704d0147caae988c7212f29ca63`. Both hashes match A/B, with exact Float64 byte comparison and equal RNG stream counts.

Measured execution: CPU `0.371887s`, wall `0.213669083s`, peak process RSS `189251584B`; limits were 2 CPU seconds, 5 wall seconds and 268435456B. Node `v26.11.0`, arm64. External terminal alarm was 15s and did not fire. Four prior tiny synthetic fixture tests passed; no real prefix was executed in those fixtures.

Scope: six actual fixed recipe prefixes (A/B for 74/72/73), using the existing strict prefix extractor and observational checkpoints. Dense fields and cellular-noise construction are removed by that extractor, and execution returns before the first raster loop. No broad seed scan, full model, density/bake, browser, GPU, visual acceptance or FPS evidence is claimed.
