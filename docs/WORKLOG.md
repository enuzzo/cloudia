# Cloudia Worklog And Milestones

This file tracks what has happened, what is next, and what must stay visible across machines.

## Current State

- Project folder: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia`
- Current local branch: `codex/cumulonimbus-webgpu`; legacy baseline retained in Git
- Foundation commit: `45795c9 chore: seed cloudia project docs`
- Operating protocol commit: `38df028 docs: add cloudia operating protocol`
- GitHub remote: `https://github.com/enuzzo/cloudia.git`
- GitHub visibility decision: public
- License decision: MIT for Cloudia's own code and docs
- Active delivery: `codex/cumulonimbus-webgpu` tracks `origin/codex/cumulonimbus-webgpu`; main is separate

## Work Completed

### 2026-10-12 — convective motion research queued by owner

- Owner asks that the next visual pass include internal and external cumulonimbus motion, with gestures still deferred.
- Studied primary NASA, NWS, WMO, NCAR and deep-convection research: rising thermal episodes, entrainment/evaporation at boundaries, lateral anvil outflow and differing lifecycle regions. Recorded sources and rendering implications in `docs/DYNAMICS-RESEARCH-2026-10-12.md`.
- Verified current motion is a small rigid-volume sinusoidal drift; morphology/detail remain static. Next pass must alter both silhouette and internal features, preserve matching shadows/support and remeasure sustained cadence.
- Research/docs only. Renderer, current browser scene and prior measurements preserved; no animation implementation or new FPS claim in this checkpoint.

### 2026-10-12 — sharper optical detail, measured resolution limits

- Removed repeated accumulated-shadow resampling with a fixed sheared light-space bake. Regression evidence verifies homogeneous optical depth and preserves a narrow shadow (old peak 0.374, new 1.565).
- Detail 128³, Massima 384 steps, separate body 18 / ice 6.5 extinction and greater strand/gap contrast; shared CPU/GPU density and conservative integer empty stride. Read-only review found no unresolved issue.
- Production port 4177, Full HD left/right 90-second runs: 59.98 fps, zero intervals >33.34 ms, GPU means 5.315/5.313 ms. Native 2515×2099: Massima 39.18 and Alta 59.39 fps; native output is not stable 60. Slower duplicate-renderer/ordinary-stride probes retained, not omitted.
- 40 tests / 11 files, typecheck, application and hero builds pass. Commissioner and legacy preserved. Photographic anvil still an open owner-review gate; a flatter depth-coherence candidate was rejected and reverted.
- Default-window orbit also passed at 59.98 fps for 90 seconds, zero intervals >33.34 ms. Before/after images committed in docs/images/cumulonimbus-sharpness. Responsive 390×844 controls and clean console checked; viewport restored.
- Source/docs/raw reports checkpointed locally; no gestures, online release or push. Current preview: http://127.0.0.1:4177/?seed=1571198069; port 4176 is an older static snapshot. Restart via `npm run dev` at port 5173; read the latest performance section before tuning further.

### 2026-10-12 — anvil optical detail and refined light

- Added tagged thin seeded ice streaks and bent fine density modulation, including inside full-density macro regions; gradual downwind thinning. Liquid lobe unions and seeded layout preserved. Bake and GPU share material/erosion formulas.
- Forward/back HG plus isotropic phase; less sky fill, warmer direct light and two attenuated multiple-scattering approximations. Existing resources/quality/empty-space skip retained.
- Full-HD/Massima 256/orbit production, both lights: 59.98 fps each over 90 seconds, zero intervals>33.34 ms, maximum 18.8/18.9 ms. GPU means3.859/3.866 ms. See latest section of `docs/PERFORMANCE-2026-10-11.md` and raw 2026-10-12 reports.
- 35 tests, typecheck, app and hero builds pass; code review and browser console clean. Desktop/narrow viewport verified; viewport override restored. Commissioner preserved.
- Local screenshots/probes in `output/ice-light-2026-10-12/`. Fibre detail remains subtle and broad regions still soft: owner visual acceptance open. Gestures remain deferred; no online deployment or push.


### 2026-10-11 — fine detail, fibrous anvil and sustained production cadence

- Expanded macro volume to 256³; added nested convective lobes, flatter wind-stretched anvil, tiled 64³ fine erosion/domain warp and matching baked illumination. Texel-center registration aligns bake and GPU samples.
- Conservative empty-space mask shares detail alpha, lowering observed GPU cost from 9.115 to 3.827 ms at full HD / 256 steps.
- Two production orbit runs, both sun directions: 59.98 fps over 90 seconds each, zero intervals >33.34 ms, maximum 18.9 ms. Development run still had 25 long intervals; all evidence is retained. No 120 fps claim.
- 32 tests, typecheck, app and hero build pass; reviewed clipping/registration fixes and final mask. Browser console clean. Commissioner preserved.
- Images, raw results, interpretation and restart: `docs/REFINEMENT-2026-10-11.md`. Photographic visual acceptance still open; gestures remain deferred. No deployment.


### 2026-10-11 — Commissioner typography

- Owner requested Commissioner for the interface. Added official Google Fonts Latin variable WOFF2 (~37 KB) to local public assets with OFL license and source record.
- Root typography now uses Commissioner; cumulonimbus UI inherits it, including native select controls. Existing cloud seed/state preserved during CSS hot reload.
- Browser confirmed the font loaded and was applied to heading and diagnostics selectors; no console warnings/errors. Application and hero builds passed. This CSS-only change does not require new unit tests or a repeated performance claim.
- Local change only; no online deployment. Next renderer/gesture acceptance work remains as recorded below.

### 2026-10-11 — approved WebGPU cumulonimbus, local checkpoint

- User approved the Three.js/WebGPU scene and measured local browser validation, gestures afterwards.
- Upgraded Three.js and matching types to r186. New default route renders a deterministic 224³ density/optical-depth volume, worker-generated once, with a bounded cached-light WGSL ray integrator. Existing WebGL lab remains at `?legacy`; hero mounting API remains unchanged.
- Added pause/reset/orbit, two matching cached sun directions, explicit resolution/quality presets, 30/90-second RAF benchmarks, optional GPU timestamp and CPU submission samples, raw JSON export. No hidden resolution reduction.
- Added `Nuova nube`: bounded seeded tower/anvil/width/lean morphology plus varied lobes and erosion; regenerate density and lighting together. Report captures seed/parameters and `?seed=` reproduces a shape.
- Browser-verified two distinct generated clouds, light/orbit/pause, narrow-screen layout, contained output aspect, legacy routes, clean current console. Independent review led to regression tests for pending init cleanup, terminal device loss, regeneration teardown and single RAF after hidden-tab loading.
- Verification: 28 tests across 10 files, TypeScript, application build and hero build passed. Build warns about the size of Three's renderer bundle; startup optimization is separate from frame cost.
- Final random morphology (seed 1571198069), Massima 192 steps, **1920×1080 actual internal buffer**, 90 seconds: **57.09 fps rAF**, p95 17.7 ms / p99 34.0 ms, 128 intervals >33.34 ms, CPU mean 0.324 ms, GPU mean 1.863 ms. Earlier lower results are retained in the performance report. Backblaze/Dropbox were paused by the owner; other host/browser workload still shared.
- **Photographic visual acceptance and sustained 60/120 fps remain open.** This is an implemented and measured local checkpoint, not a claim that the full visual/performance brief has passed. No online deployment or push.
- Code checkpoint: `6ffa9e5` on `codex/cumulonimbus-webgpu`; preceding research checkpoint `0c3553c`.
- Next: preserve this checkpoint; deepen fine-scale cloud/anvil structure and the light model; isolate remaining browser/presentation cadence with controlled comparisons. Implement gestures only after the first-scene visual/performance gate.

### 2026-10-11 — rebuild research and interruption recovery

- User reset the brief: photographic central cumulonimbus, browser first on this Mac, online later, 60/120 fps ambition; swipes/fist/pinch control weather in subsequent stages.
- Inspected the clean legacy code and ran baseline verification: 16 tests and TypeScript passed. Central Cumulus is screen-space 2D; camera tracking is not connected.
- Surveyed 12 recent renderer/library/research candidates, including public GitHub metadata and pinned source inspection. Browser-inspected Three.js, Takram and Skydrift; no sustained performance claim made.
- Recorded findings in `docs/RENDERER-RESEARCH-2026-10-11.md` and proposed first-scene design in `docs/superpowers/specs/2026-10-11-cumulonimbus-rebuild-design.md`.
- Recovered after interrupted session and restarted Vite at `http://127.0.0.1:5173/`.
- Product code/dependencies unchanged. No purchase, deploy or push. Design review and measured prototype remain open.

### 2026-05-16

- Investigated severe demo jank reported during local testing.
- Root cause found through Browser QA:
  - viewport `1280 x 720` on DPR 2 was rendering WebGL at `2240 x 1260`
  - weather overlay was rendering at `2560 x 1440`
  - Flow shader still ran up to 72 raymarch steps plus fbm work per fragment
- Added render quality helper with TDD:
  - `src/core/renderQuality.ts`
  - `src/core/renderQuality.test.ts`
- Changed default demo performance budget:
  - WebGL pixel ratio cap from `1.75` to `0.85`
  - default Flow raymarch steps from `72` to `32`
  - default light steps from `6` to `4`
  - fbm octaves from `5` to `4`
  - weather overlay pixel ratio capped to `1`
  - clear weather overlay skips repeated full-canvas clears
- Verified optimized Browser QA:
  - same viewport now renders WebGL at `1088 x 612`
  - weather canvas now renders at `1280 x 720`
  - no console warnings/errors
- Verified:
  - `bun run test`
  - `bun run typecheck`
  - `bun run build`
  - `bun run build:hero`

### 2026-05-14

- Started implementation on `main ` with user approval.
- Began M1 Lab Scaffold from `docs/superpowers/plans/2026-05-13-cloudia-lab-implementation.md`.
- Added Vite/TypeScript/Vitest config, base `index.html`, lab CSS shell, and initial `src/main.ts`.
- Installed dependencies with Bun after sandbox tempdir approval.
- Verified scaffold:
  - `bun run typecheck`
  - `bun run build`
- Added preset store with TDD:
  - first run exposed missing `jsdom` dependency for Vitest
  - second red run failed on missing `defaultPreset`
  - green run: `bun run test src/core/presetStore.test.ts` passed 3 tests
  - `bun run typecheck` passed
  - `bun run test` passed 1 file / 3 tests
  - `bun run build` passed
- Added gesture/weather runtime model with TDD:
  - red run failed on missing `easing` and `gestureMapper`
  - second red run failed on missing `stateMachine`
  - targeted tests passed 3 files / 6 tests
  - full `bun run test` passed 4 files / 9 tests
  - `bun run typecheck` and `bun run build` passed
- Added baseline Three.js cloud renderer:
  - created `CloudEngine`, vertex shader, and baseline fragment shader
  - fixed strict TypeScript with `@types/three`
  - `bun run typecheck`, `bun run build`, and `bun run test` passed
  - Browser QA at `http://127.0.0.1:5173/`: title `Cloudia Lab`, 1 canvas, no warnings/errors, visible nonblank pastel cloud render
- Added lab controls:
  - `LabApp` composes engine and lil-gui
  - `LabUI` exposes mode, density, coverage, storm, compression, and copy params JSON
  - `bun run typecheck`, `bun run build`, and `bun run test` passed
  - Browser QA verified Flow/Cumulus switch, storm/compression controls, JSON clipboard copy, and no warnings/errors
- Upgraded Flow visual baseline:
  - added first raymarch cloud deck pass plus hybrid screen-space fbm belt for reliable visible cloud mass
  - preserved blue/lavender/peach palette and lower-mid cloud horizon composition
  - documented current visual gap in `docs/VISUAL_QA.md`: needs stronger parallax, billowed edges, and richer volume
  - `bun run build` and `bun run test` passed
  - Browser QA verified 1 canvas, no warnings/errors, nonblank Flow cloud belt render
- Added Cumulus pointer control:
  - created `InputController` for pointer position and press/compression fallback
  - extended `CloudEngine` runtime with primary pointer coordinates
  - improved Cumulus shader shape and storm darkening path
  - `bun run typecheck`, `bun run build`, and `bun run test` passed
  - Browser QA verified Cumulus mode, GUI compression, pointer drag movement, and no warnings/errors
- Added first Weather layer:
  - created `WeatherLayer` canvas overlay for storm rain, mist, and wet-screen droplets
  - added TDD coverage for weather overlay parameter clamping and droplet density
  - wired lab storm state through `updateWeatherState` into both the shader and weather canvas
  - `bun run typecheck`, `bun run build`, and `bun run test` passed
  - Browser QA verified 2 canvas elements, 1 `.cloudia-weather-layer`, storm control to `1`, visible rain/droplets/mist, and no warnings/errors
- Added first embed adapter:
  - created `CloudiaHero.mount(...)` with no lab GUI and fixed defaults
  - added `build:hero` and `vite.hero.config.ts` so the hero bundle does not replace the lab build
  - created `examples/elementor-hero.html` as a `100% x 60vh` flexbox-style fixture with large brand text
  - `bun run typecheck`, `bun run test`, `bun run build`, and `bun run build:hero` passed
  - Browser QA verified the fixture at `/examples/elementor-hero.html`, 2 canvas elements, 1 mount, visible logo/cloud composition, and no warnings/errors

### 2026-05-13

- Defined Cloudia as a WebGL/Three.js cloud lab with two modes:
  - `Flow`: forward travel through a cloud deck.
  - `Cumulus`: hand/mouse controlled central cloud with storm behavior.
- Confirmed future WordPress/Elementor embed as a lightweight export from the same core.
- Studied reference direction:
  - Maxime Heckel cloudscape/raymarching article.
  - SardineFish `raindrop-fx`.
  - MediaPipe Hand Landmarker for Web.
- Studied local README tone from:
  - `../scrybar/README.md`
  - `../TaleVision/archive/readme_examples/RETINACANNON-README.md`
- Created project docs/spec:
  - `docs/superpowers/specs/2026-05-13-cloudia-lab-design.md`
- Created repository bootstrap:
  - `README.md`
  - `.gitignore`
  - `LICENSE`
- Initialized local git repository.
- Committed initial docs/bootstrap:
  - `45795c9 chore: seed cloudia project docs`
- Added operating docs:
  - `docs/PROJECT_OPERATING_RULES.md`
  - `docs/WORKLOG.md`
  - `docs/GOTCHAS.md`
- Committed operating docs:
  - `38df028 docs: add cloudia operating protocol`
- Confirmed GitHub visibility:
  - public
- Confirmed license:
  - MIT for Cloudia's own code and documentation; third-party dependencies keep their original notices.
- Added polite attribution request:
  - `NOTICE.md`
- Created implementation plan:
  - `docs/superpowers/plans/2026-05-13-cloudia-lab-implementation.md`

## Milestones

### M0: Project Foundation

Status: in progress

Definition of done:

- Local git repo initialized.
- README, license, gitignore, design spec, worklog, gotchas, and operating rules committed.
- GitHub repo created.
- Initial commit pushed.

### M1: Lab Scaffold

Status: completed locally

Definition of done:

- Vite + Three.js project created.
- Full-bleed canvas renders.
- Lab shell includes mode switch, status readout, and lil-gui.
- Preset object exists with JSON copy action.
- Browser QA confirms app loads, canvas is nonblank, and console is clean.

### M2: Flow Cloud Deck

Status: pending

Definition of done:

- Raymarched cloud deck renders.
- Forward horizontal travel is legible.
- Time-of-day gradient presets exist: dawn, afternoon, sunset, night.
- Visual screenshot is compared against the benchmark screenshot and Maxime reference.
- Desktop and hero-container `60vh` checks pass.

### M3: Cumulus Cloud

Status: first pointer baseline completed locally

Definition of done:

- Central cloud mass renders.
- Compression and expansion uniforms are tuneable.
- Mouse/touch fallback controls position and compression.
- Release expansion into darker cumulus/nimbus shape is implemented.
- Visual QA confirms it reads as a coherent cloud, not generic smoke.

### M4: Weather Layer

Status: first storm overlay completed locally

Definition of done:

- Storm value controls cloud darkness, rain intensity, droplets, and mist. (first pass complete)
- Droplet/mist layer resizes with the canvas. (first pass complete)
- Storm on/off transitions are smooth. (first pass complete through `updateWeatherState`)
- Performance remains acceptable with rain enabled.

### M5: Hand Tracking

Status: pending

Definition of done:

- MediaPipe hand tracking toggles on/off.
- Mouse/touch fallback still works when camera is unavailable or denied.
- Gesture mapper exposes openness, compression, handedness, and left-hand storm trigger.
- Simulated and real hand tests are documented.

### M6: Embed Adapter

Status: first adapter and fixture completed locally

Definition of done:

- Lightweight no-GUI entry exists. (first pass complete)
- Mount API works in a `100% x 60vh` container. (first pass complete)
- Hand tracking can be excluded or disabled.
- Default approved preset is embedded.
- Minimal Elementor-style HTML snippet is documented. (first fixture complete)

## Next Actions

1. Owner review of the new ice ribbons and moving cloud. Latest record: `OFFICE-REFINEMENT-2026-10-13.md`; restart: `HANDOFF-OFFICE-2026-10-13.md`. The cap remains too smooth at some angles.
2. Profile occupied-cloud shading versus empty traversal. The integer jump is proven safe, but v15 alone did not lower GPU mean; do not claim it did. Qualify formation/storm/orbit and presentation separately from the three successful mature ARM64 worker samples.
3. After scene acceptance, agree gesture mapping and connect independent hand inference via `applyWeatherImpulse`. One inference in flight, hysteresis/cooldowns and pointer fallback; camera permission, rain and listening acceptance remain pending.

## 2026-10-12 — local convective evolution

Implemented38-second formation, two unequal rising local pulses and upper outflow undulation, plus thinner tagged incus cores/48streaks. A64-phase half-float atlas is prepared once; a4096-cell compute interpolates the16³ flow each frame. Detail/density/cached light deform together. Expanded support uses efficient difference-cuboid/prefix dilation; ray box follows conservative seeded bounds. Fixed quality256³/128³/384/full output retained.

49tests/12files, TypeScript, application and legacy hero builds pass; read-only review corrected initial compute ordering and render-only timestamp labelling. Temporal phases, both lights, orbit/narrow layout and console inspected. Final90s runs53.23fps Full-HD formation,43.28right mature,57.65window orbit,53.18left mature repeat. **Stable60 and photographic incus acceptance are still open.** Old-v5 control55.62 and browser-only59.98 do not establish an exclusive cause. All slow/final raw evidence and a restart prompt are in docs/MOTION-2026-10-12.md. Local checkpoint only; no camera/gestures, publication or GitHub push.


## 2026-10-12 — profiling checkpoint,60gate still open

Added53-test-covered separateGPUcompute/render, CPU submission stages, callback delay and optional queue completion. Some30s and one90s run hold60, but right/growth/capped long runs remain49.95/54.45/52.21fps with unchanged~5.5ms GPU rendering. Same-context A/B does not establish a cap benefit; cap remains diagnostic. Owner confirms backups paused; service CPU is not proof of upload. Full evidence in PROFILE-2026-10-12.md. Next: shared renderer core plus optionalOffscreenCanvas worker to isolate main-thread dispatch contention, preserving all visual settings and lifecycle. No gestures or publication.


## 12–13 October — render worker, qualification still open

Extracted shared GPUSceneEngine and added opt-in OffscreenCanvas worker with single-transfer ownership, DOM/engine protocol, terminal errors and bounded cleanup.58tests pass, typecheck/application/hero builds pass. Reviewed constructor/message/loss failures; live controls and regeneration verified. Full-HD growth59.99/90s zero>18; right repeat59.83/7long frames; earlier worker57.46/57.19, capped right50.95. Main/worker30s both59.99, so no proven causal improvement. Keep main default and all raw failures; quality256³/128³/384 unchanged. WORKER-2026-10-13.md is the latest restart/evidence record. Next useful step is actual Chromium GPU/compositor trace, then qualification before visual fibres/local boiling and gestures. No deployment/push/camera.


## 2026-10-13 — Chrome trace handoff

Chrome154 reproduces55.67fps/30s at FullHD/384 with GPU5.65ms and queue completion71.1ms mean. No shader change. Browser security policy blocks chrome://tracing and expressly forbids alternative control paths; manual DevTools export requested, GPU/compositor trace not yet captured. TRACE-2026-10-13.md contains exact protocol and raw evidence. Chrome tab stays open; former in-app cloud tab closed to avoid duplicate rendering.


## 2026-10-13 — convection, atmosphere and storm

Implemented five local thermals and upper shear in an analytic16³ GPU field, dynamic entrainment, stronger ice fibre separation, a shared128² RGBA16F atmospheric LUT, irregular volumetric intracloud flashes/sky spill and gesture-enabled stereo thunder with physical acoustic delay. Explicit cloud speed, sky, automatic/manual flash, held-light and acoustic-distance controls. Initial float32-sampler shader failure diagnosed and retained; GPU validation now precedes ready.68tests/16files, TypeScript, application and hero builds pass. Live same-seed temporal/flash evidence and narrow-layout checks retained. FullHD/384 worker90s:59.96(cleargrowth),58.47(storm/audio),58.00(haze/right/orbit); stable60 still open. Static review corrected the shared cloud/sky flash coordinates; final v13 storm/audio58.88fps/40long intervals with5.998ms GPU rendering. Main-thread GPU/console and corrected narrow layout verified. Details and limitations in WEATHER-2026-10-13.md. Owner photography/listening acceptance remains open. No camera, gestures, publication or push.


## 2026-10-13 — morphology, circulation and office publication

Added three seed-selected anatomy families with broader connected bases/unequal towers, stronger attached sheared incus, rising/sinking/outflow displacement, coherent height-dependent shear, neutral overcast sky/ambient, seeded branched intracloud channels, two-axis pointer/keyboard orbit and recenter. Smooth gust/dispersion/recovery controls share a main/worker impulse API for later hand input. Research compares four dedicated cloud repositories with primary meteorology and provenance notes; no external code/dependency imported.

Initial browser review corrected fragmented necks/weak cap; static review corrected pause and regeneration visibility/queue-drain races. 88 tests/19 files, TypeScript, application and legacy hero builds pass. Main/worker, real drag/recenter/keyboard, family cycling/regeneration, wind/dispersion/recovery, flash/audio enable and narrow390×844 inspected; no GPU/console errors observed. FullHD/384 worker90s: 57.40fps formation/storm (GPU13.415ms), 59.75fps mature/right/orbit/partial dispersal (GPU13.795ms). Stable60 and owner photographic/listening acceptance remain open. Sparse temporal captures are qualitative evidence, not compositor or60fps video. All raw results/evidence and limitations: `MORPHOLOGY-2026-10-13.md`.

Owner explicitly requested GitHub publication of `codex/cumulonimbus-webgpu` and a manual office handoff. Implementation checkpoint and office workflow are recorded in `HANDOFF-OFFICE-2026-10-13.md`; final remote SHA verification is reported in the completion message. Animated preview retained at normal speed with neutral sky/55%wind/automatic flashes. No website deployment or main merge requested.


## 2026-10-13 — office continuation, conservative traversal and ice ribbons

Recovered 693 Dropbox-placeholder Git objects from identical hash-verified GitHub contents; all 743 objects reachable from the initial refs verified. Fetch/ancestry succeeded; 53 unreachable placeholders preserved. Clean starting branch matched `864f5c1`. Installed locked dependencies for darwin/arm64, Bun 1.3.11.

Implementation `c457bfc`: derive the safe empty stride from the flow-expanded mask and inverse growth/shear Jacobian; keep occupied sampling and fixed 256³/128³/384 quality. Three new tests cover sparse displaced density, transition/shear bounds and ordinary early/coarse steps. Ice ribbons gain depth variation and breakup using existing RGB channels; CPU/GPU material parity retained. Final renderer `fibrous-flow-v16`.

91 tests/20 files, typecheck and application → hero builds pass. Worker/main startup, three families, side/oblique pointer/keyboard views, recenter, held 100% dispersion/recondensa, gust, manual flash and main narrow 390×844 inspected; no relevant console errors. Three complete mature FullHD worker 90s samples: v14 59.996fps/GPU13.242ms, traversal-only v15 59.985fps/GPU13.431ms, final v16 59.996fps/GPU11.143ms. All zero intervals >33.34ms; final maximum17.8ms. Similar settings, slightly differing start times/focus; not bit-identical causal A/B. The final reduction includes material changes, and no isolated traversal benefit is established.

Raw JSON, screenshots and limitations are retained in `OFFICE-REFINEMENT-2026-10-13.md`. Owner photographic/listening acceptance, formation/storm/orbit/compositor/other-device qualification and hands/rain remain open. Manual handoff updated; publish only the existing feature branch. Preview remains animated at normal speed, neutral sky, 55% wind and automatic flashes, with window-sized full-resolution output. No main merge or site deployment.

## 2026-10-13 — Observatory continuation, first implementation

Resumed dd07846 in the clean local feature checkout. Read the operating/handoff
records and inspected animated front/side views against NASA S'COOL photography.
Added uneven macro outflow shoulders, neutral elevation-dependent surroundings,
per-sample aerial perspective, interruption-safe sky transitions, approximate
low-sun colour with ozone absorption and a bounded world-space rain shaft.
Prepared a personal-observatory interface, explicit future hand guide, shared
atmosphere intents and occupied-work probes. See OBSERVATORY-2026-10-13.md for
research, assumptions and proposed gestures. First real WGSL test caught reserved
`diagnostic`; renamed to `probeMode`. No camera activation, renderer fallback,
quality reduction, deployment or main merge. Final qualification follows.

### Qualification and final choice

94 tests/21 files, typecheck and application→hero builds pass. Real WGSL compiled
on both main and worker; console inspection found no remaining errors/warnings.
Desktop1280×720,tablet768×800,mobile390×844 and short1280×432 inspected. The short
layout has the height of a60vh hero on a720px viewport; this is layout evidence,
not a new Elementor/embed integration test. Family seeds and screenshots are in
the observatory report. Main dispersion reached100%, gust/recondensation and
Escape were exercised; camera never requested.

Seven occupied-work probes showed density/detail sensitivity, no established
cache/scattering savings, and held-lightning overhead. Compile-time specialization
kept full rendering and improved the single fixed comparison14.302→10.996ms.
A recurrence experiment (v19) gave inconsistent timings and was reverted; all
raw results remain. Final v18 mature-worker90s59.936fps/max36.6ms/4 long frames;
main growth+storm+orbit90s59.978fps/max37.5ms/1 long frame,6 flashes. No perfect60,
compositor, physical-device, photographic or listening acceptance claim.


## 2026-10-13 — authorized publication and v20 solar continuation

Explicit owner approval resolved the automatic publication block. Pushed the
four v18 checkpoints through85d6919 and verified the exact remote SHA. Owner
also asked for an ambitious autonomous improvement plan:18 ordered work items
with acceptance criteria now live in plans/2026-10-13-product-roadmap.md.

First implementation c6a8621 aligns low-sun sky, phase and two new256³ RG8
cloud-shadow caches. Dominant-axis signed baking handles horizontal light
without the old ray-plane growth. Approximate sunset bounce follows solar
colour; established day cache output remains byte-identical in the synthetic
CPU comparison. +32MiB GPU plus32MiB CPU backing payload.97tests/21files,
TypeScript, app/hero builds and main/worker GPU validation pass. Fixed30s
main day59.9996fps and sunset59.9978fps; animated worker orbit90s59.9991fps,
all zero>33.34ms. These are rAF samples, not compositor proof or causal speedup.
Desktop/mobile, interrupted transitions and regeneration checked; camera off.
See SOLAR-2026-10-13.md for evidence and the remaining synchronous sky-LUT
latency. Next: asynchronous/cached sky transitions, then depth/scale cues.


## 2026-10-14 — v21 environment and close observation

Implemented2b880b9 after owner requested visible photographic rain, close
camera approach, maximum quality, dismissible panels and altitude cues.
Cloud-column64² precipitation source replaces the fixed ellipse; world-space
curtains share cloud transmittance. Native maximum output, logarithmic dolly
toward a probed density boundary, finer near sampling, reversible procedural
Earth sphere and global outside/Escape dismissal. Sky LUT changes use a
dedicated worker and bounded preset cache; first startup remains synchronous.

104tests/23files and application→hero builds pass. Main rain FullHD90s:
50.486rAF/s before empty-column guard,59.874 after (3 long intervals,134.3ms max).
Not a causal isolated A/B. Near animated30s47.237rAF/s; maximum quality costs
more at close range. Desktop/mobile and main/worker rendered QA; photographic
quality and physical-device acceptance remain open. See ENVIRONMENT report.

Recovered Git add blocked in Dropbox dataless object directory: preserved c2
and142 more directories outside active objects, refetched remote, verified
920 reachable objects/zero missing before implementation commit. No deletion,
main merge, deploy or camera access. Publish only authorized feature branch.

Final worker solar panorama30s59.998rAF/s,0 intervals>33.34ms, paused cloud.
Rapid interrupted skies, worker zoom and ground off also passed rendered QA.
Raw reports and screenshot SHA256 manifest retained with the environment report.


## 2026-10-14 — wilderness landscape correction

Owner prefers forests, mountains and sea with nothing urban. Removed the
sinuous river line (read as a road from cloud altitude) and field-like palette.
Added an irregular coast with shallow/deep water, continuous forest canopy,
rocky ridges and small high-altitude pale patches. Approximate heightfield
intersection refines the sea sphere with six bounded iterations; relief fades
between90 and180km to avoid unstable grazing rays. No buildings, roads,
settlements, map data or photographic assets.

104tests/23files pass; TypeScript and application→hero builds pass. Real WGSL
compilation and desktop sun render verified. Detailed final checks and raw
measurements: images/wilderness-2026-10-14 and ENVIRONMENT-2026-10-14.md.
The heightfield is an authored approximation, not a DEM or fully converged
terrain ray tracer. No new photographic-acceptance claim.

Final wilderness QA: desktop sun/sunset and mobile390×844 pass; no console
errors. Main paused solar FullHD30s59.996rAF/s, zero intervals>33.34ms,
GPU mean15.063ms. No new worker/animated/physical-device qualification.


## 2026-10-14 — cloud source study and observatory UI

- Read pinned shader sources from Takram, Sebastian Lague and Joshbrew; tried Takram Minimal Setup/Custom Layers and Jeantimex coverage 0.8→0.5 in the in-app browser. Reviewed public commercial UDS9.7 and CloudScapes material; no purchase or code import. [Research](CLOUD-RESEARCH-2026-10-14.md).
- Generated an agent-selected UI concept before implementation; retained the live renderer, not the AI background. Unified dock, SVG controls, Nube/Atmosfera/Misure inspector, percentages, focus/keyboard/dismissal, mobile and reduced-motion CSS. Existing actions preserved. [Design/acceptance ledger](UI-DESIGN-2026-10-14.md).
- Validation: 108 tests/24 files, TypeScript, app and hero builds passed. Browser acquisition of the local preview was denied by policy; no bypass attempted. Public demos remained accessible. New UI screenshots and full runtime/layout QA are explicitly pending, not passed.
- Dropbox: original node_modules lacked its local exclusion; verified ignored/untracked, applied/read back attribute1 and restored dependencies with frozen Bun lockfile. Attribute1 remained after builds. Existing `node_modules 2/` was preserved untracked; no broad staging/deletion.
- No renderer tuning, new benchmark, deployment, main merge or camera activation in this revision.


## 2026-10-14 — bounded approach probe and reproducible CPU audit

- Reproduced a thin40m layer missed by the former192-sample camera search. Clipped search to conservative cloud bounds, targeted12.5m spacing, capped2048 intervals and refined the first detected edge. Invalidated on rotation and matched CPU ice smoothstep to shader. Added probe diagnostics to benchmark context.
- Ran full256³/128³ CPU audit over18 poses: maximum error vs dense reference0.0110m (previous0.1463m), median0.0895ms, maximum0.3521ms. These are CPU/reference results, not GPU or visual acceptance. [Details](APPROACH-2026-10-14.md).
- Fixed diagnostic reference slider readouts and softened the maximum-approach wording to reflect an estimate. No shader change or quality reduction. Local-browser visual gate remains blocked.
- Final validation:113 tests/24 files and both builds passed; dependency exclusion remained1. Existing unrelated `node_modules 2/` left untouched.


## 2026-10-15 — local continuation handoff

- Recorded the verified 971ce25 baseline, current quality contract and ordered
  implementation/acceptance plan in [HANDOFF-2026-10-15.md](HANDOFF-2026-10-15.md).
- Next cycle covers cloud anatomy, near-boundary light, precipitation/landscape
  coherence and rendered UI validation, followed by scoped regression checks.
- Preserved the distinction between the 14 October test/build evidence and open
  visual/GPU/device acceptance. The declared browser smoke script is absent and
  must not be reported as an available or successful check.
- Rechecked dependency exclusion=1 and preserved the pre-existing untracked
  `node_modules 2/`. This checkpoint changes documentation only; no runtime
  tests/builds rerun, no rendering claim or deployment.


## 2026-10-15 — anatomy, mixed transport and responsive qualification

- Replaced shared tower levels and uniform peripheral billows with seeded local
  shoulders and summit collars. Rendered review exposed an overly hollow sheared
  body; added an intermediate replenished core derived from the actual summits.
- Area-filtered rain mass and matching base heights, including the bilinear halo.
  Added world-space evaporation, conservative source bounds and independent 6 m
  rain sampling. Cloud and rain now share one exponential segment; land remains
  visible under overcast. Calibrated rain extinction to 0.85 after the original
  2.6 produced an opaque-looking curtain.
- Improved desktop readability, safe-area offsets, keyboard focus/dismissal and
  explicit range-label association. Real IAB checks include 1672×941, 390×844
  and 1280×432; scrolling and keyboard can reach controls below the initial panel.
- 131 tests/25 files, TypeScript and application→hero builds pass. Full256³/128³
  CPU approach audit remains within0.01071m of its dense reference in18poses;
  macro connectivity and mixed-medium integration have separate CPU artifacts.
- Exact IAB localhost access is permitted in this context; actual main/worker
  WebGPU compilation/drawing observed. No alternative route around the historical
  denial. Evidence, measurements and remaining quality limits are recorded in
  [QUALIFICATION-2026-10-15.md](QUALIFICATION-2026-10-15.md).
- Near95–100 can still become nearly uniform fog; anvil/body material and
  photographic acceptance remain open. No compositor, physical-device or audio
  acceptance inferred from rAF/CPU numbers. Dependency exclusion stays1;
  unrelated `node_modules 2/` preserved. No main merge or deployment.
