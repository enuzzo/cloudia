# Cloudia Gotchas

This file is for traps we discover once, so we do not politely step on them again.

## October 2026 WebGPU scene

- Three r181 timestamp cleanup had a shadowed error-handler bug. Current implementation pins r186 and matching types. Dispose only after renderer init and pending timestamp resolve settle; device loss is terminal even if a worker message arrives late.
- Initial worker completion in a hidden tab must not schedule RAF. Visibility resume cancels an existing pending RAF before starting one. Multiple chains would invalidate the frame metric.
- Baked lighting supports exactly its two sun directions; continuous sun changes require rebuilding caches. Regeneration replaces density and all caches together, and disposes the old texture/material.
- Hard height thresholds in erosion cause visible horizontal seams; use smooth transitions. Apply the same sky tone mapping on AABB hits and misses. Fullscreen quad UV needs the explicit vertical orientation correction.
- Output buffers and internal resolution are explicit. Fixed-aspect output is contained/letterboxed, not stretched; the default window mode uses one canvas pixel per CSS pixel, not devicePixelRatio.
- RAF cadence is not presented FPS; GPU timestamps only cover GPU work. CPU submission measurements also exclude GPU waits and compositor work. Preserve low-FPS samples and percentile tails. Current sustained 60/120 fps and photographic acceptance are still open.
- Export filenames must use the captured report metadata, not current controls. A previous completed report can remain exportable after controls change; its recorded seed/resolution stay authoritative.
- Application build cleans `dist`; hero build uses `emptyOutDir:false`. Run app then hero to retain both outputs. Do not run app build last if both are needed.

## Environment And GitHub

### GitHub CLI token is invalid

Observed on 2026-05-13:

```text
X Failed to log in to github.com account enuzzo
The token in default is invalid.
```

Fix:

```bash
gh auth login -h github.com
```

After auth works, create/push the remote repo.

### Repository visibility is public

Creating a public GitHub repository publishes local project files externally. The user confirmed on 2026-05-13 that `cloudia` can be public.

### License is MIT for Cloudia-owned work

Cloudia's own code and documentation use MIT. Third-party dependencies, references, and inspirations keep their own licenses and notices.

`NOTICE.md` contains a polite, non-binding attribution request. It must not be treated as an extra license condition.

Useful license references checked on 2026-05-13:

- Three.js: MIT
- lil-gui: MIT
- SardineFish `raindrop-fx`: MIT
- MediaPipe: Apache-2.0

### GitHub repo naming and description

Repository name must be all lowercase:

```text
cloudia
```

Short description:

```text
Volumetric WebGL clouds with hand-tracked weather control. Partly cloudy, fully shadered.
```

### Dropbox-synced folder is the canonical project home

All project docs and implementation files must stay under:

`/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia`

This keeps the work available from office/home machines.

### Initial git setup needed elevated filesystem permission

`git init -b main` initially failed with:

```text
.git: Operation not permitted
```

The command succeeded after approval. Expect sandbox/file-provider weirdness around Dropbox-synced folders.

### `bun install` may need elevated tempdir access in this environment

Observed on 2026-05-14:

```text
bun is unable to write files to tempdir: PermissionDenied
```

The same `bun install` succeeded after approval. This is likely a sandbox/tempdir permission issue rather than a package problem.

### Vitest `jsdom` environment requires explicit `jsdom` dependency

Observed on 2026-05-14 while running the first preset test:

```text
MISSING DEPENDENCY Cannot find dependency 'jsdom'
```

The project uses `environment: "jsdom"` in `vitest.config.ts`, so `jsdom` must be listed in `devDependencies`.

### Three.js TypeScript declarations need `@types/three`

Observed on 2026-05-14 during the first `CloudEngine` typecheck:

```text
Could not find a declaration file for module 'three'
```

Install `@types/three` alongside `three` for strict TypeScript builds.

### Lab bundle is allowed to be heavier than embed

Observed after adding Three.js + lil-gui:

```text
Some chunks are larger than 500 kB after minification
```

This is acceptable for the local lab while we tune shaders. The future Elementor/WordPress embed must use a separate lightweight build path without lab UI and with hand tracking omitted unless explicitly enabled.

### Do not reuse `uHorizon` for different shader meanings

During the Flow raymarch upgrade, the implementation plan wanted a camera horizon uniform named `uHorizon`, but the shader already used `uHorizon` as a color. Use `uHorizonHeight` for camera/composition and keep `uHorizon` for the palette color.

## Reference And Documentation

### ScryBar and Retina Cannon style references are available locally

Useful tone references:

- `../scrybar/README.md`
- `../scrybar/firmware_readme.md`
- `../TaleVision/archive/readme_examples/RETINACANNON-README.md`

`faceto` was not found locally during the first search. If its README is needed, ask for the repository/path.

### Credits must stay specific

Primary references currently recorded:

- Maxime Heckel: https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/
- SardineFish `raindrop-fx`: https://github.com/SardineFish/raindrop-fx
- MediaPipe Hand Landmarker: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
- Three.js: https://threejs.org/
- lil-gui: https://lil-gui.georgealways.com/

Do not replace these with vague "inspired by several projects" wording.

## Visual Benchmark

### Flow is forward travel, not decorative fog

The benchmark screenshot shows a horizontal forward journey through a cloud plane with wide sky and a soft horizon. If the first Flow shader feels like a flat smoke overlay, it is not done.

### Cumulus must share the same quality bar

The interactive hand-controlled cloud needs the same visual ambition as Flow. It cannot become a debug sphere with noise just because gesture work is hard.

### Hero container compatibility is a real constraint

The target embed is a WordPress/Elementor hero-like container, around:

```css
width: 100%;
height: 60vh;
position: relative;
overflow: hidden;
```

Resize and composition must be tested in that shape, not only in a full browser window.

## Implementation Gotchas To Watch

### WebGL cloud quality can collapse under performance shortcuts

Raymarch step counts, fbm octaves, lightmarch steps, and pixel ratio caps need tuning as visible controls. Low-quality mode is useful, but the default benchmark mode must remain beautiful.

### Retina defaults can quietly murder the demo

Observed on 2026-05-16 after the first local demo felt under 5 fps:

```text
viewport: 1280 x 720
devicePixelRatio: 2
WebGL canvas before fix: 2240 x 1260
weather canvas before fix: 2560 x 1440
```

That meant the shader and overlay were doing multi-megapixel work per frame before the raymarch cost even started.

Current demo default:

```text
WebGL pixelRatioCap: 0.85
weather pixelRatioCap: 1
raymarch steps: 32
fbm octaves: 4
```

High-fidelity benchmark mode should come back as an explicit quality preset, not as the default first impression.

### Hand tracking must be optional

MediaPipe/camera permissions are fragile in real websites. Mouse/touch fallback and simulated storm controls are required for local QA and embed safety.

### Rain and mist should be atmospheric, not a sticker layer

Storm visuals need to interact with the cloud state and background luminance. If rain looks pasted over the scene, revise the layer blending and timing.

### Browser QA sees lil-gui sliders as textboxes

The visible lil-gui controls render as sliders, but the Browser DOM snapshot exposes them as named textboxes such as `storm`, `density`, and `coverage`.

For reliable QA, use the labeled textbox and press Enter:

```text
storm = 1
```

Coordinate dragging on the tiny slider track can miss, especially when the in-app browser viewport changes size.

### Weather canvas density is tied to rendered pixel area

The weather overlay runs on a second canvas above the WebGL canvas. Droplet and rain counts scale with rendered canvas area and are capped in `computeWeatherOverlay`; keep that cap visible when tuning retina/high-DPI displays so storm mode does not silently turn into a tiny GPU tax.

### The shader canvas is currently opaque

Observed during the Elementor fixture QA: placing a brand/logo "behind" the Cloudia mount makes it disappear because the fragment shader outputs `alpha = 1.0`.

Current fixture solution: keep the brand text above the canvas with low opacity and `mix-blend-mode: soft-light`.

Future production choice:

- keep brand in front and style it as part of the hero composition;
- add an explicit embed alpha/compositing mode;
- or render Cloudia as a background behind text rather than as an overlay above text.


## 2026-10-11 — fine density, cache registration and empty space

- Domain-warp density must be evaluated before the raw-envelope empty test. Otherwise outward displaced features are clipped; the light bake must use the same support.
- Normalized linear texture samples place voxel i at (i+.5)/size, not i/(size-1). Use the former in geometry rasterization, fine-density bake and light transport, especially for anisotropic ice detail.
- Fine noise over every ray sample raised full-HD GPU cost to 9.1 ms. Packing a conservatively dilated occupancy mask into unused detail alpha reduced it to 3.8 ms without lowering quality. Mask is sampled in normalized world coordinates; RGB noise uses repeated cloud coordinates.
- Near-60 averages can hide very long stalls. Keep max and count >33.34 ms. Production left/right 90-second runs reached 59.98 with max18.9 and no long intervals, while a development run averaged59.20 with a250ms stall. Host load changed too; Vite is not an established exclusive cause.


## 2026-10-12 — transparent ice detail

- ErodeDensity(1,e)=1 preserves liquid interiors but also erased filament contrast in dense ice. Ice uses additional smooth density modulation/taper, and the same model must enter the light bake.
- Strong fine variation along the view-depth axis averages into a flat-looking slab. Coherent stretched fields help, but inspect orbit for artificial sheets; source coordinates and snapshot labels must track actual lighting/state after HMR resets.
- Thin ellipsoids need narrower smooth union and gentler macro erosion to survive. Tag ice explicitly: a radius-only blend condition also catches small liquid convective lobes and changes their accepted morphology.
- Realistic-looking ice does not imply measured crystal scattering. Distinguish authored material coefficients from HG phase theory and separate measured60Hz RAF cadence from actual compositor presentation.


## 2026-10-12 — shadow diffusion and output sharpness

- Repeatedly bilinear-resampling accumulated optical depth diffuses narrow shadows even when density has detail. Keep parallel light rays on a fixed sheared grid; resample into the world cache once. Validate homogeneous path length and a distant narrow blocker.
- Increasing detail resolution shrinks the occupancy halo. Never retain an unconditional old double stride: derive the minimum margin including warp, texture interpolation and macro support. Integer skip multiples preserve the occupied sampling grid; use ordinary steps when no proven accelerated stride fits.
- Native-DPR buffers and CSS buffers are different budgets. Here DPR 2.2 produced2515×2099 and39.18fps at384 steps; full1920×1080 held59.98. Explicit mode labels and actual dimensions are mandatory; do not call CSS rendering Retina-native.
- Two active cloud tabs contaminated a90-second run (21.22fps). A queued app-panel open created a second tab rather than repairing an error page. Check tab inventory and one active renderer before measurement. Do not infer all low FPS is caused by backups.
- Port4176 was an older Python static snapshot, not the new Vite build. Current production preview4177 servesdist; inspect server identity/build assets before interpreting a shader change.
- Making ice detail nearly invariant through depth can create a flat opaque-looking cap. A .003 Z-frequency probe was visually rejected and reverted; inspect both fixed view and orbit before accepting coherent sheets.


## 2026-10-12 — animated flow and profiling

- Analytic flow at every ray sample and broad mask dilation are costly. Per-frame CPU field uploads also performed poorly on this shared host. A64-phase atlas avoids uploads; interpolating once per voxel in a4096-invocation compute pass avoids repeated temporal sampling along every ray. Keep density/detail/light in the same material coordinates.
- Compute must run before the initial shader-compile draw, not only during later rAFs. Update lifecycle mocks when worker data gains support bounds, and verify compute precedes the first draw.
- Render GPU timestamps exclude compute and presentation. A5.6ms render pass did not deliver stable60; retain failed interval measurements and profile other passes/queue waits. A paused trial slower than a moving trial rules out claiming texture uploads as the sole cause.
- Browser panel presentation and document visibility are distinct. Earlier hidden-panel trials are labelled; final timings use visible presentation. Browser-only59.98 does not certify a GPU scene, and the old renderer measured55.62 under the current host conditions.
- Tight ray bounds include raw linear interpolation footprint, fine warp, flow bounds and growth anchors. Keep global texture coordinates unchanged. Moving ray entry changes sample phase, so inspect rendered output despite conservative support coverage.
- Growth invalidates old stride assumptions. Ordinary steps remain until growth reaches identity at38s, when the expanded support margin permits the proven integer double stride. Broad cap softness and subtle local convection are remaining visual gaps.


### 12–13 October — render-worker ownership

- Worker RAF clocks are local: retain actual timestamp/timeOrigin evidence before interpreting dispatch delay. OffscreenCanvas moves submission off the document thread but does not isolate compositor/whole-host scheduling. Do not infer improvement from one60fps run when both main and worker controls hold60.
- Transfer the HTML canvas once. Catch synchronous constructor/postMessage failure; errors are terminal and late ready/metrics messages must not revive controls. Send device-loss text before terminal status, then stop and await cleanup with bounded worker termination.
- `?worker=1` is experimental; main remains default. Keep shared rendering logic and explicit executionThread metadata, frozen-flow initialization and visibility cancellation. See WORKER-2026-10-13.md.


### 13 October — atmosphere and storm

- Float32 sky textures can omit a WGSL sampler on devices without float32-filterable. Use the128² half-float LUT; startup scopes validation before emitting ready. Unit tests/build do not compile actual WGSL.
- Live flow now evaluates five analytic thermals into16³; historical atlas helpers are reference utilities, not live animation. Saturation preserves the occupancy displacement bounds. Dynamic erosion and changed fibre microstructure make cached optical-depth lighting approximate.
- Cloud speed and acoustic delay use separate clocks. Start thunder from the first illuminated submitted frame and compensate worker-message delivery; pause/reset/hide/regeneration/teardown cancel pending sound. Audio activation/synthesis happen after the user click, never on each flash/frame.
- Short strokes can be missed by screenshot capture; record timestamps and do not present held-light preview as an actual temporal flash. The sparse replay is not a60fps recording.
- Diagnostic/weather panels sit above the full wrapped controls height (`100% +12px`), not a fixed mobile offset. Viewport overrides can report different CSS dimensions under zoom: record actual buffer/CSS sizes.
- Current90s failures58.47/58.00 remain alongside59.96. Render GPU means around5.3–5.8ms do not certify presentation or stable60. WEATHER-2026-10-13.md is the latest handoff.


## Morphology, interaction and storm forcing — 2026-10-13

- `seed%3` chooses congestus/multicell/sheared. New-form cycles the family; explicit family selection produces a new seed in that family. Preserve the visible seed in evidence and reproduce with `?seed=...`.
- Fine carving must preserve a connected replenished core; thin macro overlaps disappear after shader erosion. CPU/GPU ice erosion and material must match the optical-depth bake. Geometry continuity and fibre opacity both affect anvil readability.
- Height-dependent inverse shear expands world support. Ray bounds include a1.3X/0.65Z halo; occupied-mask coordinates clamp to half texels instead of wrapping. Integer empty skips are disabled while shear or dispersal is active. Keep displacement limits conservative.
- Camera yaw/pitch is independent of weather and cloud time. Drag cancels auto-orbit and benchmarks. Recenter resets only view, aims at seeded support/current drift; it does not regenerate the cloud.
- Pause freezes forcingTime (gust/dispersion) and cloud time. Flash/audio use a separate wall clock, so manual lightning works paused. Auto-flashes require unpaused growth. No hand camera access is introduced.
- During volume generation the installed old cloud keeps animating. Visibility may restart it only before the final GPU drain. Disable the regeneration flag before cancelling/draining so hide/show cannot create duplicate RAF loops.
- The held dispersion slider indicates persistent forcing; transient disperse/condense/reset clear that hold. Live status shows actual interpolated dispersion. A temporary burst recovers after3.5seconds.
- Neutral sky chromaticity must also reach cloud ambient illumination; merely dimming a blue sky leaves blue shading.
- Four studied repositories are reference-only; root MIT alone does not resolve all derived shader provenance. PI-CloudSim's dependency license does not establish a license for its simulation.


### 13 October — office ARM64 and traversal qualification

- Dropbox can leave `.git/objects` as dataless placeholders even when `git status`/recent log work. Fetch/ancestry may fail with `mmap failed: Operation timed out`. The office recovered693 objects from identical SHA-1-verified GitHub copies and verified all743 initially reachable objects;53 unreachable placeholders remain preserved. This is not a full unreachable-history fsck. Never reset/delete unknown objects to make the check pass.
- The live occupancy alpha includes bounded flow, so derive its actual per-axis margin rather than reusing the historical fine-warp-only `.04` constant. Inverse growth mixes width/anvil across the ice transition; bound that cross derivative as well as height-dependent shear. Quantize advances to original step multiples. Dispersion is already inside the saturated flow halo.
- A proven three-step empty advance is not a measured speedup. On this Apple adapter, v14/v15 GPU means13.242/13.431ms; final v16 with changed material measured11.143ms. Keep all samples, start-time/focus differences and distinguish the combined result from causal traversal evidence.
- Similar mature90s results do not certify growth/storm/orbit, compositor presentation or another GPU. The office main/worker browser QA and390×844 inspection do not constitute physical-phone or acoustic acceptance.

### 13 October — observatory continuation

- `diagnostic` is a WGSL reserved keyword. TypeScript and mocked unit tests
  accepted the new argument; real GPU startup rejected it. Renamed it `probeMode`.
- Low solar elevation with only Rayleigh/Mie scattering produced an excessive
  green/yellow band. Add approximate ozone absorption to both sun and view paths,
  not an unrelated decorative background gradient. Sunset still uses fixed
  cloud light-cache directions and is explicitly an approximate colour study.
- A hand-guide disclosure is not an active input mode. Keep Manuale selected,
  state that the camera is unconnected and avoid calling getUserMedia until the
  actual tracking implementation is requested.
- Uniform-controlled ablations add branches/register pressure to the production
  shader. Compile probe variants separately, label them visibly and record them
  in raw JSON. Omission timings are not additive; changed density changes exits.
- An algebraically equivalent aerial-transmittance recurrence did not establish
  a repeatable speedup (v19); it was reverted. Keep both slow and fast samples.
- A paused cloud can still accept sky changes: sky interpolation uses wall time,
  while precipitation/flow evolution remains paused. Future continuous hand sun
  control must not synchronously rebake the whole LUT for each inference frame.


## 2026-10-13 — v20 low-sun transport

- A vertical-axis light bake grows its ray plane with direction.x/direction.y.
  Near-horizontal sunlight must sweep the dominant voxel-space axis; testing
  only daytime angles hides this memory issue. Signed-axis Beer–Lambert and
  blocker tests now cover it.
- Lowering only the sky sun gives mismatched cloud shadows/phase. Direction
  comes from sun.ts for atmosphere and bake; low-sun bounce also follows the
  solar spectrum. Cache interpolation and deformed shadows remain approximate.
- Two RG8 channels at256³ mean32 MiB GPU payload plus the32 MiB CPU backing
  array, not total app memory. Regeneration retains old resources until swap.
- The in-app tab briefly reported0-width after the user hid the surface. An
  explicit QA viewport restored interaction; this was not a renderer error.
- Scene switches still build a CPU sky LUT synchronously; stable-scene fps does
  not certify switch latency. Async/cache work is now explicit P0 roadmap work.


## 2026-10-14 — v21 camera, precipitation and asynchronous sky

- Worker entry imports a pure skyModel module. Importing SkyCache there would
  also pull in its own new Worker URL and can create recursive worker bundling.
- Snapshot the displayed sky only when the latest async result arrives;
  request order is not completion order. Dispose rejects pending promises.
- Near camera requires finer initial jitter as well as finer occupied steps;
  using the old coarse initial offset could skip the nearby cloud boundary.
- A density boundary is not a physical surface. CPU probing approximates GPU
  filtering/flow and cannot guarantee a3m clearance during all deformation.
- Native display pixels can multiply the rendering workload versus CSS pixels;
  FullHD tests do not certify a large Retina surface. No adaptive reduction.
- Procedural ground shading is not displaced relief; documenting it as terrain
  geometry or real geography would overstate this implementation.
- UI input invalidates performance samples. Avoid screenshots during captures;
  preserve complete reports and distinguish paused from animated measurements.

- Dropbox can evict whole .git/objects/xx directories even after reachable
  objects were recovered. git add may hang in access()/odb_freshen_object.
  In this session the dataless directories were preserved outside active
  objects, remote history refetched,920 reachable objects checked with zero
  missing. Never delete an unknown lock or discard the preserved directories.

- At cloud altitude a thin dark procedural river can read as a road. Owner
  explicitly prefers only forests/mountains/sea; remove ambiguous linear
  decoration and agricultural patchwork. Six-step heightfield refinement is
  approximate, especially at grazing angles; fade distant relief and retain
  the spherical horizon. Canopy shading is not individual tree geometry.


## 2026-10-14 — disclosure layout and evidence boundaries

- A fixed inspector inside a transformed centered dock would use the dock as its containing block. Center the dock with left/right + auto margins, not transform. Inspectors then keep viewport anchoring. Actual small-screen browser verification remains pending.
- UI-only buttons (tabs/close) must not forward an undefined scene action. SVG targets must resolve to their parent button; pause updates its accessible name alongside the icon.
- The browser policy denied acquiring the existing localhost tab even though the supplied URL used HTTP. Do not bypass through another browser, raw protocol or renamed local address. Tests/builds and public-reference research remain independent; they do not substitute for rendered visual acceptance.
- A generated UI concept can embellish the cloud/landscape. Preserve the actual renderer and explicitly distinguish the concept from proof. Third-party demo FPS overlays are not matched measurements.


## 2026-10-14 — camera boundary sampling

A fixed sample count across the entire panorama-to-target segment becomes coarser in portrait view. Restrict to conservative support before choosing sample spacing; expose the cap/spacing/no-hit result. Bisection cannot recover a thin layer never hit by the initial march. The CPU ice fraction must match WGSL smoothstep, not a linear height fraction. A refined numerical crossing is not proof of a physical3m gap to animated vapor.
