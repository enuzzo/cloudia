# Cloudia Worklog And Milestones

This file tracks what has happened, what is next, and what must stay visible across machines.

## Current State

- Project folder: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia`
- Local git repo: initialized on `main`
- Foundation commit: `45795c9 chore: seed cloudia project docs`
- Operating protocol commit: `38df028 docs: add cloudia operating protocol`
- GitHub remote: `https://github.com/enuzzo/cloudia.git`
- GitHub visibility decision: public
- License decision: MIT for Cloudia's own code and docs
- Push status: `main` tracks `origin/main`

## Work Completed

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

- Started implementation on `main` with user approval.
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

1. Have the user test the optimized local demo subjectively.
2. If still janky, add an explicit quality selector and/or frame skipper for the weather overlay.
3. Continue implementation plan with MediaPipe hand-tracking toggle.
