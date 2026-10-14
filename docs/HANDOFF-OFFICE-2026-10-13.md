# Cloudia — current local handoff

## Current continuation: v21 —14 October2026

Implementation `2b880b9`: cloud-column rain curtains, real camera approach,
native maximum quality, distant procedural Earth, outside/Escape panel dismissal,
and dedicated cached sky worker.104tests/23files and both builds pass.
Final rain90s FullHD:59.874rAF/s,3 intervals>33.34ms; near approach30s:
47.237rAF/s,160 intervals>33.34ms. No perfect60, compositor or photographic
acceptance claim. Native Retina workload can exceed FullHD substantially.
See [ENVIRONMENT-2026-10-14.md](ENVIRONMENT-2026-10-14.md) for evidence,
controls, architectural limits and the recovered Dropbox object-directory issue.

Later14 October: owner requested only wilderness. River/field patterns removed;
forest, mountains and sea added with bounded approximate heightfield refinement.
See the final section of ENVIRONMENT for current evidence and limitations.

Next visual work: refine relief/ground shadow, near-density detail and reference
comparison. Next technical work: quantify first/cached sky-switch latency.
The roadmap remains open; no hands recognition or automatic camera activation.

## Previous continuation: v20

Tested implementation: `c6a862194f7fdaeda5c5bb86a1d7108d61336145`.
97 tests/21 files, TypeScript and both builds pass. Day/low-sun cache directions,
phase and atmosphere now share the sun model; RG8 adds32 MiB GPU and32 MiB CPU
payload. Detailed evidence and current limits: [SOLAR-2026-10-13.md](SOLAR-2026-10-13.md).
Ordered next work: [product roadmap](plans/2026-10-13-product-roadmap.md).
The following v18 checkpoint is preserved as historical context.

Updated13 October2026 after the observatory continuation. This supersedes the
v16 handoff; historical office evidence remains in OFFICE-REFINEMENT-2026-10-13.md.

## Authoritative checkpoint

| Item | Current state |
| --- | --- |
| Repository | https://github.com/enuzzo/cloudia |
| Branch | codex/cumulonimbus-webgpu |
| Tested implementation | 5290302f5005ab777f27037783a0e3e0cc71a0cd |
| Complete v18 delivery | `85d6919`, pushed and remote SHA verified after explicit user approval |
| Renderer | observatory-v18, Three.js r186/WebGPU; main default, worker optional |
| Quality | 256³ macro,128³ detail,384 nominal steps,100% configured output; no adaptive reduction |
| Checks | 94 tests/21 files, typecheck, application→hero builds pass; real main/worker WGSL compiled |
| Local runtime | darwin/arm64, Bun1.3.11, Apple/Metal-3 in-app browser |
| Publication | v18 published on feature branch; v20 continuation described below. No deployment or main merge |

Read [OBSERVATORY-2026-10-13.md](OBSERVATORY-2026-10-13.md) for research,
photographic mismatch ledger, hand vocabulary, all GPU probes and their limits.
Read GOTCHAS.md and PROJECT_OPERATING_RULES.md before editing.

## Delivered

- Unequal intermediate outflow billows and macro carving reduce the smooth cap;
  seed-determined congestus/multicell/sheared families remain. The silhouette
  still reads as a shelf from some angles: no photographic acceptance claim.
- Neutral overcast elevation structure, per-sample aerial attenuation, smooth
  sky/ambient/solar transitions, low-sun colour with approximate ozone absorption.
  Sunset still uses the existing fixed cloud-shadow cache directions.
- World-space rain/virga shaft under the cloud, sharing view transmittance.
  This is authored precipitation, not droplet microphysics or a surface splash.
- Personal-observatory UI: serif wordmark + existing self-hosted Commissioner,
  charcoal-green instruments, citron state feedback, permanent sun/sunset/rain/
  storm console, manual controls and separate diagnostics. Existing functions
  remain. Responsive panes, keyboard focus and Escape supported.
- Future hand guide is visible and explicit: camera unconnected, no permission
  requested. Proposed mapping and loss/ambiguity/fatigue rules are documented.
  `applyAtmosphereIntent` and `applyWeatherImpulse` share main/worker transport.
- Occupied-work probes distinguish density, light-cache access, flow/detail
  sensitivity and held lightning. v18 compiles probes as distinct shaders;
  complete rendering has no runtime diagnostic branches. No-detail/no-flow
  change the image and are never quality optimizations.

## Measurements and limits

One cloud renderer, full1920×1080 output/internal,384 steps,2s warmup. No builds,
tests or screenshots during the samples. Raw reports are in docs/benchmarks.

| Final v18 scenario | Duration | rAF fps | Max interval | >33.34ms | GPU mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Worker, mature, wind55%, neutral, no rain/flashes | 90s | 59.936 | 36.6ms | 4 | 14.772ms |
| Main, formation→mature, orbit, rain .3,6 flashes | 90s | 59.978 | 37.5ms | 1 | 11.365ms |

These are different scenarios, not proof that main is faster. They do not certify
perfect60 or compositor presentation. The worker result is less clean than the
prior v16 office run. Other GPUs, physical phones and acoustic acceptance remain
open. GPU timestamps are asynchronous pass samples.

Fixed30s probes showed no established illumination/cache saving, but reductions
when omitting flow or detail (changed density/early exits confound exact costs).
One full-mode comparison improved14.302→10.996ms after compile-time specialization.
Keep that bounded; no randomized attribution claim. A v19 aerial recurrence trial
was rejected after inconsistent fixed/animated timings. Its raw evidence remains;
**do not treat v19 files as the final implementation**.

## Visual QA and preview

Evidence: docs/images/product-2026-10-13 with checksum manifest and final-qa.json.
Desktop1280×720,tablet768×800,mobile390×844 and short1280×432 inspected. Short
viewport approximates a60vh height on720px; actual Elementor mounting was not
requalified. Main and worker console checks were clean. Main saturated dispersion,
recondensation, gust, orbit/recenter, weather transitions and hand-guide dismissal
were exercised. New-form kept the previous cloud visible and cycled families.

The final visible tab is the normal main preview:
http://127.0.0.1:4177/?seed=1571198069

State: window output100%,384 steps,1×,wind55%,neutral storm,automatic flashes,
rain .3,audio disabled,manual input,panels closed. It is animated, marked as a
browser deliverable, and temporary viewport overrides are reset. The previous
chat closed its cloud tab before measurement; only this preview is retained.
Local browser/server state does not transfer between machines.

## Safe restart

1. Stay in this local folder/feature branch, no new checkout and no simultaneous
   writer. Check `git status --short --branch`, `git log -3 --oneline`, then fetch
   and fast-forward only when appropriate. Preserve unrelated changes.
2. Earlier Dropbox repair recovered693 identical hash-verified objects.53 old
   unreachable placeholders remain preserved. Do not delete/reset history to
   make fsck pass; see OFFICE-REFINEMENT-2026-10-13.md.
3. Use the committed Bun lock for the current architecture. Build app before hero:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run build:hero
bun run preview -- --host 127.0.0.1 --port 4177 --strictPort
```

4. Keep one active renderer. Normal mode is main; add `worker=1` for worker.
   `profile=1&timing=stages` starts mature at fixed1080p. In diagnostics,
   **Fissa stato di confronto** freezes cloud time60/forcing0,wind55%,neutral
   sky,rain0,left light,camera0/0. Then choose a probe and measure. This is still
   GPU rendering, not idle pause. Restore Completo and animation for delivery.
5. Continue small commits and authorized feature-branch pushes. No force-push,
   main merge or website deployment without a new request.

## Active continuation: v20 solar transport

The owner explicitly approved publication and an autonomous improvement plan.
Read [the ordered roadmap](plans/2026-10-13-product-roadmap.md) and
[SOLAR-2026-10-13.md](SOLAR-2026-10-13.md) for the new low-sun implementation
and its current validation. The v18 data above remain historical evidence.

## Next useful work

1. Owner review of moving cap/scale and interface. Improve surrounding depth cues
   and lighting before claiming photorealism; preserve current detail budget.
2. Implement the requested camera pipeline next only on the owner's subsequent
   instruction: explicit permission/preview/stop, local inference worker, one
   frame in flight, no impulse on reacquisition, manual fallback. Mapping remains
   proposed. Continuous sun control needs cached/interpolated atmosphere states;
   do not rebuild the CPU LUT at camera inference frequency.
3. Low-sun cloud shadow transport remains approximate. Research directional cache
   expansion or another measured solution; do not merely recolor the sky and
   call it a physically complete sunset.
4. Repeat matched performance trials under controlled thermal/host conditions.
   Existing browser compositor-tracing policy block must not be bypassed.
