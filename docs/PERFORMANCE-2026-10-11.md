# Cumulonimbus: measured local browser performance

Date: 11 October 2026. Local preview: `http://127.0.0.1:5173/`. No online deployment.

The following table preserves the first renderer checkpoint (224³ / 192 steps). **Current 256³ / 256-step results:** [detail refinement and production measurements](REFINEMENT-2026-10-11.md), including two 59.98 fps / 90-second runs with no long frames.

## What was measured

- Three.js **r186**, actual **WebGPU** backend. Browser reports AMD / GCN-5, hardware adapter (not a fallback). Host reports Radeon Pro Vega 56; browser conceals the specific device string.
- Codex in-app browser: Chromium 155, macOS Intel user agent, devicePixelRatio about 1.1. Viewport override used for desktop/mobile QA, then reset. Most runs use the embedded browser; one explicitly labelled standalone Chrome run is included below. Neither is a fullscreen display acceptance test.
- A deterministic **224³ RGBA8** volume stores density and two solar/one sky optical-depth caches. Caches are built once by a worker. Fixed spatial jitter, early ray termination, no TAA or hidden dynamic resolution.
- **Alta:** 128 nominal integration steps; **Massima:** 192. All results below use **100% internal resolution**. The explicitly selectable 75% preset is not used to claim these results.
- Two-second warmup, then complete visible RAF intervals until at least 30 or 90 seconds elapsed. FPS = interval count / sum of interval durations. Median, p95/p99 and long stalls are retained. A changed scene, hidden tab or resize cancels the run.
- Later reports also include CPU callback work through draw submission. This excludes later metric updates, asynchronous timestamp handling and browser composition. GPU timestamp queries are sampled asynchronously at most five times per second. These measure the cloud draw pass, not all browser/desktop composition or presentation. Neither RAF nor timestamp queries certify compositor-presented frames or a 120 Hz display.

## Results — include regressions, not just the fastest run

| Scene/version | Output = internal | Duration | FPS rAF | p95 / p99 | GPU mean / p95 |
|---|---:|---:|---:|---:|---:|
| Initial Alta, filtered UI | 1280×720 | 30 s | 40.19 | 49.3 / 51.1 ms | 0.715 / 0.721 ms |
| Alta, unfiltered UI, panel closed, before final density refinements | 1280×720 | 30 s | **59.98** | 17.7 / 20.3 ms | 0.715 / 0.721 ms |
| Alta, same stage | 1920×1080 | 30 s | **59.55** | 20.6 / 24.0 ms | 1.429 / 1.507 ms |
| Earlier Massima, fixed framing | 1280×720 | 30 s | **27.56** | 99.3 / 149.7 ms | 0.920 / 0.983 ms |
| Earlier Massima, slow orbit | 1920×1080 | 90 s | **48.75** | 34.1 / 50.9 ms | 1.805 / 2.032 ms |
| Browser calibration, **no canvas and no GPU renderer** | — | 15 s | **50.92** | 34.0 / 50.7 ms | — |
| Earlier Massima, window framing | 1143×954 | 30 s | 25.50 | 83.4 / 116.9 ms | 1.330 / 1.442 ms |
| Standalone Chrome, earlier Massima | 1280×720 | 30 s | 28.42 | 100.2 / 166.3 ms | 0.913 / 0.983 ms |
| Owner paused Backblaze/Dropbox, earlier Massima orbit | 1920×1080 | 90 s | **43.64** | 49.9 / 66.6 ms | 1.821 / 2.032 ms |
| Stronger erosion, CPU probe, Massima orbit | 1920×1080 | 30 s | **35.09** | 50.1 / 66.7 ms | 1.937 / 2.032 ms |
| **Previous parametric generator, Massima orbit, seed 1571198069** | **1920×1080** | **90 s** | **57.09** | **17.7 / 34.0 ms** | **1.863 / 2.032 ms** |

That checkpoint's 90-second run collected 5,139 intervals and 433 GPU samples. CPU submission mean/p95 was **0.324 / 0.400 ms**; GPU mean/p95 **1.863 / 2.032 ms**. It included **128 intervals over 33.34 ms** and a maximum stall of **67.1 ms**. The benchmark records the exact seed and morphology; open `/?seed=1571198069` to rebuild the shape.

This is close to the browser's observed 60 Hz cadence, **not stable 60 fps acceptance; 120 fps was not demonstrated**. Earlier low-FPS results remain first-class evidence. The old near-60 samples do not substitute for the current sustained result.

## Interpretation and limits

The measured cloud pass and CPU submission both fit within a 16.7 ms budget. Low cadence also occurred on a separate calibration page without a canvas. This supports browser/system scheduling and composition as contributing factors, without proving every lost frame belongs to another process or establishing one exclusive cause.

A sanitized earlier host observation showed load averages around 18–22, approximately 31 GB used memory with 1.2 GB unused, and active backup, browser and screen-sharing processes. The **owner later paused Backblaze and Dropbox**; this was reported by the owner, not changed by the agent. The subsequent 43.64 fps run shows that pausing those two alone did not establish stable 60. Further controlled browser/presentation comparisons are still required. The final 57.09 run includes morphology/code changes and evolving host load, so do not assign its improvement to one unisolated cause.

Changing CSS backdrop filters and closing the diagnostic panel improved an earlier comparison without changing GPU cloud cost. This is an observed UI/composition sensitivity; the comparison also includes evolving host load. No hidden quality reduction was used.

## Reproducible evidence

Committed raw final measurements, including every frame interval:

- [Massima 720p / 30 s](benchmarks/2026-10-11-ultra-720p.json)
- [Massima 1080p orbit / 90 s](benchmarks/2026-10-11-ultra-1080p-orbit-90s.json)
- [Browser-only calibration / 15 s](benchmarks/2026-10-11-browser-cadence.json)
- [Window framing / 30 s](benchmarks/2026-10-11-ultra-window.json)
- [Standalone Chrome / 720p](benchmarks/2026-10-11-chrome-ultra-720p.json)
- [Owner-paused sync / 1080p orbit / 90 s](benchmarks/2026-10-11-paused-sync-ultra-1080p-orbit-90s.json)
- [CPU probe / 1080p](benchmarks/2026-10-11-cpu-probe-ultra-1080p.json)
- [**Previous generator / 1080p orbit / 90 s**](benchmarks/2026-10-11-final-parametric-ultra-1080p-90s.json)
- [Initial filtered UI](benchmarks/2026-10-11-initial-720p.json), [earlier near 60 / 720p](benchmarks/2026-10-11-no-css-filter-720p.json), [earlier near 60 / 1080p](benchmarks/2026-10-11-high-1080p.json)

Exploratory reports and JPEG screenshots are retained in the ignored `output/cumulonimbus-2026-10-11/` directory. Export from the scene's controls to reproduce a run. For a comparable test, leave it visible, finish compilation first, close the diagnostics panel, and do not change controls during sampling.

## Visual acceptance

The scene now has real 3D density, an authored rain base, convective tower and asymmetric anvil, cached self-shadowing, two working light directions and orbit parallax. The new seeded generator varies bounded tower height/width, anvil spread, lean, lobe layout and erosion. A new cloud is built with matching optical-depth caches; reset preserves the seed. Desktop and narrow-screen composition, contained fixed-aspect buffers, pause/reset and benchmark cancellation were inspected in the browser. Legacy Flow/Cumulus was also checked after the Three.js update.

**Absolute photographic quality is not an accepted/completed gate yet.** The current cloud remains visibly procedural and its fine structure, anvil and light model need further visual refinement. There is no owner visual approval of this new scene. The shader uses approximate multiple scattering and a sky gradient, not a full measured atmospheric model. Keep this distinction separate from the passing technical checks and the observed GPU headroom.


## 12 October — ice fibres and light, renderer `ice-filaments-v4`

The next refinement preserves 256³ macro/light, 64³ fine field, conservative empty-space skipping, full 1080p and 256 nominal steps. Explicitly tagged ice lobes use narrower smooth union; 28 seeded thin streaks have varied heights. Lower-frequency bent anisotropic detail now modulates density inside the anvil as well as eroding its borders. A smooth downwind taper thins the outflow while leaving liquid density unchanged. CPU light bake and WGSL integration use matching formulas. The material model is an authored optical approximation, not measured ice microphysics.

Lighting now mixes a forward and backward HG phase with an isotropic component and two exponentially attenuated approximations for multiple scattering. The sky fill is less dominant and direct light slightly warmer. [PBRT phase functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions) supports the weighted-phase formulation; [NOAA glossary](https://www.weather.gov/otx/Glossary_of_Weather_Terms) supports the ice-anvil morphological reference. Numerical artistic parameters are our own. No full atmospheric or volumetric path tracing claim.

Production preview: `http://127.0.0.1:4176/?seed=1571198069`, Chromium 155 IAB, AMD GCN-5 hardware WebGPU. Same method and seed as previous checkpoint, full output/internal 1920×1080, Massima 256, slow orbit, both sun directions, 2-second warmup + 90 seconds, panel closed, no builds/edits during measurement. A backup/sync pause was requested after observing active processes; no new pause confirmation was received during these runs. The performance claims rest on the collected intervals, not an assumed host state.

| Sun / 90 seconds | RAF fps | p95 /p99 ms | Maximum ms | Intervals >33.34 ms | GPU mean /p95 ms | CPU mean /p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| Left | **59.98** |18.3 /18.7 |18.8 |**0** |3.859 /3.932 |.213 /.300 |
| Right | **59.98** |18.3 /18.7 |18.9 |**0** |3.866 /3.932 |.211 /.300 |

Both collected 5,399 intervals. Previous production GPU means 3.808/3.845 ms; added detail stayed close to that budget in these tests. **Sustained 60 Hz RAF cadence is retained for the tested scene/host; 120 fps and compositor-presented-frame certification remain unmeasured.**

Raw evidence: [left](benchmarks/2026-10-12-ice-light-production-left-1080p-90s.json), [right](benchmarks/2026-10-12-ice-light-production-right-1080p-90s.json). Local before/after/angle/mobile JPEGs and probes: `output/ice-light-2026-10-12/` (ignored). The desktop 1143×954 and narrow 390×844 scene/control layout were inspected, both lights exercised, production console showed no warnings/errors, temporary viewport restored. This viewport check is not physical-phone acceptance or a mobile performance claim.

35 tests / 10 files, TypeScript, application and legacy hero builds passed. Read-only review verified CPU/GPU density and cache equivalence, support coverage and phase sign. One finding about inadvertently narrowing liquid-lobe unions was fixed by explicitly tagging icy lobes. Build retains the known large-Three chunk warning.

Visual result: more uneven anvil edges, a lighter outflow and deeper shading of the tower. Fine fibres remain subtle in the compressed browser captures; broad surfaces are still soft. **Photographic visual acceptance remains open and no owner acceptance is inferred.** No camera/gestures, online deployment or GitHub push in this checkpoint.


## 12 October — shadow sharpness and fibre contrast, optical-detail-v5

Owner reported persistent softness. The previous upwind light bake bilinearly resampled accumulated optical depth on every height layer. A narrow-blocker regression demonstrates the resulting diffusion: peak optical depth 0.374 with the old integration, 1.565 with parallel rays held in a sheared light-space grid. The new bake resamples accumulated depth only when writing the world cache. A homogeneous-medium test verifies voxel-center path length and Beer–Lambert optical depth. This is a finite-resolution approximation, not exact path tracing; 8-bit cache quantization and tau clipping at 16 remain.

Fine RGBA detail is 128³ (8 MiB, formerly 64³ / 1 MiB), retaining the 256³ macro/light cache. Cellular detail now has four samples per feature cell. Massima uses 384 steps, with a 1024 loop cap covering the entire diagonal. Body extinction is 18; ice stays at 6.5. A smoother, higher-contrast ice density mask separates strands and gaps. These are authored coefficients, not measured microphysics. CPU bake and GPU integrator share density/material formulas. The new light bake runs once in the worker and adds no per-frame shadow march. [PBRT transmittance](https://pbr-book.org/4ed/Volume_Scattering/Transmittance) supports the density/path-length formulation; the light-space discretization is our implementation.

The higher-resolution support mask has a minimum conservative halo of 0.043046875 world units beyond maximum warp and macro interpolation. Multi-step empty advances are limited to 0.04 and are integer multiples of the normal step. At Massima this is 2 × 7/384 = 0.0364583; occupied samples retain their original grid. Alta and Fluida use their ordinary step. Only zero support enables this shortcut. Review checked the halo bound, density/bake equivalence, loop cap, output DPR and teardown/resource use.

Final production preview is **http://127.0.0.1:4177/?seed=1571198069**. The older 4176 endpoint is a separate static Python snapshot and does not serve the new build. Chromium 155 / hardware AMD GCN-5 WebGPU, seed 1571198069, 2-second warmup +90 seconds, motion on, one rendering scene, no build or editing during capture. The final Full-HD measurements use fixed framing; prior v4 orbit numbers are separate scenarios.

| Scenario / 90 s | Output = internal | Steps | RAF fps | p95 / p99 ms | Max ms | >33.34 ms | GPU mean /p95 ms |
|---|---|---:|---:|---:|---:|---:|---:|
| Massima, left |1920×1080|384|**59.98**|18.5 /18.7|18.9|**0**|5.315 /5.505|
| Massima, right |1920×1080|384|**59.98**|18.5 /18.7|18.8|**0**|5.313 /5.505|
| Native screen, Massima, left |2515×2099|384|**39.18**|35.0 /38.3|51.8|639|17.821 /17.957|
| Native screen, Alta, left |2515×2099|128|**59.39**|20.0 /24.0|38.2|10|9.598 /9.699|

Both Full-HD runs have 5,399 intervals, CPU mean 0.230/0.227 ms (see raw reports for precise values). Native output explicitly uses DPR 2.2000000477 at CSS1143×954 and is **not a stable-60 result at either quality**. No automatic downgrade or pixel-ratio cap was introduced. Default remains the window/CSS mode; native output is an explicit choice.

Raw final reports: [left](benchmarks/2026-10-12-sharpness-left-1080p-90s.json), [right](benchmarks/2026-10-12-sharpness-right-1080p-90s.json), [native Massima](benchmarks/2026-10-12-sharpness-native-ultra-90s.json), [native Alta](benchmarks/2026-10-12-sharpness-native-high-90s.json).

Earlier experimental evidence is preserved too: [two simultaneously rendering tabs](benchmarks/2026-10-12-sharpness-duplicate-scene-probe-90s.json) reached21.22fps; closing the second scene preceded recovery to59.98. A30-second attempt was cancelled by resize and produced no result. Two [ordinary-stride left](benchmarks/2026-10-12-sharpness-single-stride-left-probe-90s.json) / [right](benchmarks/2026-10-12-sharpness-single-stride-right-probe-90s.json) runs reached59.98 with GPU means7.365/7.425ms. Final bounded skipping reduced mean GPU cost to5.315/5.313ms without changing occupied sampling. These are sequential comparisons on a shared host; they do not establish one exclusive explanation for browser cadence. A sanitized host snapshot after the contaminated run showed81.5% CPU idle with both backup and application processes active; no process was paused or stopped by the agent.

A final exploratory reduction of ice variation along view depth made the cap look more like a uniform sheet and was **rejected/reverted after rendered inspection**. The committed source retains its previous bend/strand depth frequencies. Photographic acceptance remains open: tower shadow separation and fine detail improve, but broad anvil surfaces still look soft. No owner approval is inferred from unit tests or FPS. Local image/probe folder: `output/sharpness-2026-10-12/`.

40 tests /11 files, TypeScript, application and legacy hero builds pass. Known large Three.js chunk warning remains. Commissioner, seed/reset controls and legacy routes are preserved. No gestures, camera permission, deployment, or GitHub push in this pass. 120fps and compositor presentation remain unmeasured.


Final default-window orbit verification: **1143×954 output/internal, Massima 384, left light, 90 seconds:59.98fps**,5,399 intervals, p95/p99 18.5/18.7ms, maximum18.8ms, **zero >33.34ms**. GPU mean/p95 **4.348/4.456ms**. [Raw window/orbit report](benchmarks/2026-10-12-sharpness-window-orbit-90s.json). Final browser page title/URL and nonblank scene verified; console had no warnings/errors. Controls remained usable at temporary390×844; native viewport restored, orbit reset, motion on, default window/Massima left open at4177. This is desktop responsive-layout evidence, not physical-phone performance.

Committed qualitative comparisons: [before](images/cumulonimbus-sharpness/before.jpg), [after left](images/cumulonimbus-sharpness/after-left.jpg), [after right](images/cumulonimbus-sharpness/after-right.jpg), [orbit](images/cumulonimbus-sharpness/orbit.jpg). Before/after use the same seed, reset camera, left light and CSS-sized window, though JPEG capture can soften the apparent detail; use the live scene to assess it. Images are rendered cloud evidence, not photographic references.
