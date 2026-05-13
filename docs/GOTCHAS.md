# Cloudia Gotchas

This file is for traps we discover once, so we do not politely step on them again.

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

### Hand tracking must be optional

MediaPipe/camera permissions are fragile in real websites. Mouse/touch fallback and simulated storm controls are required for local QA and embed safety.

### Rain and mist should be atmospheric, not a sticker layer

Storm visuals need to interact with the cloud state and background luminance. If rain looks pasted over the scene, revise the layer blending and timing.
