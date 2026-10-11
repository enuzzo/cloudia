# Cloudia Visual QA

This document records visual comparisons against the accepted benchmark.

## Benchmark

- Flow benchmark: provided screenshot of Maxime Heckel-style forward cloud deck.
- Key requirements: forward horizontal travel, pastel sky, soft horizon, cloud plane depth, creamy cloud edges.
- Cumulus benchmark: same quality bar, but staged as one central controllable cloud mass.

## QA Entries

### M2 Flow Cloud Deck

Status: first upgrade verified locally, then performance-capped for demo

Comparison points:

- Forward motion: shader advances both raymarch and screen-space fbm depth; needs stronger parallax/depth pass.
- Horizon placement: cloud mass sits near lower-mid viewport, close to target composition.
- Pastel palette: lavender/blue/peach target is present.
- Cloud volume/depth: improved over baseline; still needs more true layered cumulus structure and less airbrushed blending.
- Edge softness: soft, with visible belt structure; needs more creamy billowed edges.
- Performance: first local user test was severely janky. Default render cost was reduced on 2026-05-16 by capping WebGL pixel ratio, capping weather canvas ratio, and reducing raymarch/fbm work.
- Desktop screenshot: verified via Browser plugin at `http://127.0.0.1:5173/`, title `Cloudia Lab`, 1 canvas, no console warnings/errors.
- Optimized desktop check: DPR 2 viewport `1280 x 720` now renders WebGL at `1088 x 612` and weather at `1280 x 720`, with no console warnings/errors.
- Hero 60vh screenshot: pending dedicated embed/fixture QA.

### M3 Cumulus Pointer Control

Status: first pointer-controlled baseline verified locally

Comparison points:

- Central mass: visible, coherent single cloud mass.
- Compression: GUI compression value changes shape density/scale.
- Pointer position: Browser drag moved the cloud center across the viewport.
- Palette: shares Flow palette and storm-darkening path.
- Visual gap: still too procedural/fbm-speckled; needs more cumulus lobes, smoother outer silhouette, and more physically plausible light/shadow.
- Desktop screenshot: verified via Browser plugin at `http://127.0.0.1:5173/`, mode `cumulus`, no console warnings/errors.
- Hand tracking: pending.

### M4 Weather Layer

Status: first storm overlay verified locally

Comparison points:

- Storm activation: setting `storm` to `1` in the lab visibly adds rain streaks, wet-screen droplets, and mist.
- Cloud/weather relationship: storm value now feeds both the shader darkening path and the overlay; first pass reads as weather, not just a UI toggle.
- Wet-screen feeling: droplets appear across the glass and drift subtly; this is a useful base but needs more refraction/drag trails to approach the reference ambition.
- Mist: softens the image and darkens the atmosphere enough to communicate storm onset; future pass should modulate mist by cloud luminance so it feels less uniform.
- Desktop screenshot: verified via Browser plugin at `http://127.0.0.1:5173/`, 2 canvas elements, 1 `.cloudia-weather-layer`, no console warnings/errors.
- Mobile/hero 60vh screenshot: pending dedicated embed/fixture QA.

### M6 Embed Fixture

Status: first `60vh` hero fixture verified locally

Comparison points:

- Hero shape: `examples/elementor-hero.html` renders Cloudia inside a `width: 100%; height: 60vh` section.
- Brand layer: large `CLOUDIA` text is visible over the cloud field with soft-light blending; first attempt placed it behind the opaque canvas and made it disappear.
- Cloud framing: Flow deck reads well in the shorter hero crop, with sky above and cloud mass through the middle.
- Remaining visual gap: the fixture proves integration, not final artistry. We still need stronger volumetric parallax, more sculpted billows, and a deliberate alpha/brand strategy if a client wants the logo truly behind translucent clouds.
- Browser QA: verified at `http://127.0.0.1:5173/examples/elementor-hero.html`, title `Cloudia Elementor Hero Fixture`, 2 canvas elements, 1 `#cloudia-mount`, no console warnings/errors.


### 2026-10-11 — central cumulonimbus fine refinement

Same-seed before/after desktop images, live orbit, left/right lighting, 32 tests and sustained production measurements are recorded in [refinement report](REFINEMENT-2026-10-11.md). Incus is now flatter with stretched fine detail; convection has smaller lobes and displaced contours. Remaining broad smooth anvil patches and approximate fill light prevent a blanket photographic-quality claim. Owner visual acceptance remains open. No gestures added in this checkpoint.
