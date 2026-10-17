# Native metadata validation — formal FAIL, physical controls match

The frozen validator ran once after root authorization. Its unmodified result is `FAIL_NATIVE_METADATA_CONTROLS`, SHA256 `eb6c91e3240df4ca2f303596a2e224fd8b1377b97cae90955223ebd88038b7f1` (`result.json`). The frozen script/contract remain unchanged; no retry was made. The terminal output is preserved in `raw-run-log.json`.

The mismatch list contains only the following owner-local shadow-cache counters. The protocol declared cache activity as ownership metadata, but the explicit path allowlist omitted this nested shadow-cache instance. That omission is a validator defect; the original failed result is retained rather than silently changing the frozen criterion.

| Pose | Field | A | B |
| --- | --- | ---: | ---: |
| front | terrainRaster.shadow.cache.hits | 1805 | 6998 |
| front | terrainRaster.shadow.cache.requests | 1806 | 6999 |
| side | terrainRaster.shadow.cache.hits | 3343 | 10907 |
| side | terrainRaster.shadow.cache.requests | 3344 | 10908 |

The identical native shadow-cache scope in both owners explicitly says: “Owner-local CPU calls: requests are validated render calls, submissions are renderer.render attempts (including throws), hits skip shadow clear/draw; no GPU completion or presentation claim”. Its submissions (`1`), epoch (`0`), valid state, scope and ownership contract compare exactly. The differing counter values therefore do not identify a physical rendering-input mismatch. This is an explanatory reading of the saved result/schema, not a rerun or a replacement PASS status.

All world camera fields, complete lighting and flash state, material uniforms apart from the declared support bounds, weather controls apart from the declared precipitation bounds, terrain/optical metadata, quality, formats, dimensions, and render-affecting clocks compare exactly in both corresponding poses. The 256³ macro / 128³ detail / 16³ flow dimensions and 384 nominal steps are unchanged. All 143 installed source hashes match R1.

The predeclared weatherTime exemption is valid in both poses: paused, nonorbiting, settled clear sky, zero current/target rain, zero dispersion and no flash, with matching physical controls. Recorded values: front A=`15.035500000000004`, B=`15.651599999999991`; side A=`40.70380000000004`, B=`80.83930000000136`. Other clocks compare exactly. Source proof and exact line references remain in the frozen protocol/result.

| PNG | SHA256 | Bytes | Binding |
| --- | --- | ---: | --- |
| A front | 6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9 | 3599836 | Actual DTO alias and independent existing bitmap hash |
| A side | c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749 | 1359259 | All 28 transfer parts verified |
| B front | a5618ec2982212f7587d7930a5f42b271d86cab19288ae9094d502f2901934aa | 3607225 | All 74 transfer parts verified |
| B side | 64a047ec9d21590c6e7bdfead6a9e7b10b05210c5685c54e99ae978731d63a2a | 1467060 | All 30 transfer parts verified |

All four dimensions are 2474×1844 and agree with DTOs and IHDR headers. Every transferred part's order, length and SHA256 agrees with the data URL reconstructed from its independently verified PNG. A/B PNG bytes differ in both poses; this is content identity only and carries no quality judgement.

Runtime: `0.06025775s` wall, `0.054855s` CPU, `82362368B` peak process RSS. Limits were 10s wall, 5s CPU and 512MiB RSS; external alarm15s did not fire. No browser, GPU, model generation, density validation, performance measurement or artistic judgement occurred in this analysis.
