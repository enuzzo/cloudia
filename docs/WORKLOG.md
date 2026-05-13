# Cloudia Worklog And Milestones

This file tracks what has happened, what is next, and what must stay visible across machines.

## Current State

- Project folder: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia`
- Local git repo: initialized on `main`
- Foundation commit: `45795c9 chore: seed cloudia project docs`
- Operating protocol commit: `38df028 docs: add cloudia operating protocol`
- GitHub remote: not set yet
- Push status: blocked by invalid `gh` auth and pending public/private visibility confirmation

## Work Completed

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

## Milestones

### M0: Project Foundation

Status: in progress

Definition of done:

- Local git repo initialized.
- README, license, gitignore, design spec, worklog, gotchas, and operating rules committed.
- GitHub repo created.
- Initial commit pushed.

### M1: Lab Scaffold

Status: pending

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

Status: pending

Definition of done:

- Central cloud mass renders.
- Compression and expansion uniforms are tuneable.
- Mouse/touch fallback controls position and compression.
- Release expansion into darker cumulus/nimbus shape is implemented.
- Visual QA confirms it reads as a coherent cloud, not generic smoke.

### M4: Weather Layer

Status: pending

Definition of done:

- Storm value controls cloud darkness, rain intensity, droplets, and mist.
- Droplet/mist layer resizes with the canvas.
- Storm on/off transitions are smooth.
- Performance remains acceptable with rain enabled.

### M5: Hand Tracking

Status: pending

Definition of done:

- MediaPipe hand tracking toggles on/off.
- Mouse/touch fallback still works when camera is unavailable or denied.
- Gesture mapper exposes openness, compression, handedness, and left-hand storm trigger.
- Simulated and real hand tests are documented.

### M6: Embed Adapter

Status: pending

Definition of done:

- Lightweight no-GUI entry exists.
- Mount API works in a `100% x 60vh` container.
- Hand tracking can be excluded or disabled.
- Default approved preset is embedded.
- Minimal Elementor-style HTML snippet is documented.

## Next Actions

1. Fix GitHub CLI auth: `gh auth login -h github.com`.
2. Confirm repo visibility: public or private.
3. Create GitHub repo `cloudia`.
4. Push local `main`.
5. Start implementation plan in `docs/superpowers/plans/`.
