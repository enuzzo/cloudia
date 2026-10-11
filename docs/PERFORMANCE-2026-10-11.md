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
