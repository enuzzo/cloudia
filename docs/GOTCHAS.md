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
