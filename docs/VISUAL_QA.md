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


### 2026-10-12 — ice filaments and light

Bent anisotropic density and downwind taper distinguish the outflow from liquid convection. Tagged thin streaks add edge variation; light uses a forward/back phase and stronger shadow separation. Same-seed before/after captures, both light directions, live orbit and 390×844 composition inspected; no production console warnings/errors.35 tests and builds pass; two full-HD256-step 90-second orbit runs retained 59.98 fps without >33.34 ms intervals. Refer to latest section of [performance report](PERFORMANCE-2026-10-11.md) and local `output/ice-light-2026-10-12/` images. Fibre changes are subtle; broad patches remain soft. Owner photographic acceptance still open before gestures.


### 2026-10-12 — optical/detail sharpness

Same seed 1571198069, reset camera and both sun directions inspected. Fixed light-space integration sharpens internal shadows; 128³ detail adds surface definition, separate body/ice extinction gives stronger tower relief, and ice strand/gap contrast is higher. Native-DPR and CSS views compared. The broad incus still reads softer than a photographic reference; owner acceptance remains open. A depth-coherence probe made it more slab-like and was rejected/reverted. Preserve this mismatch as the next morphology task, rather than claiming a contrast pass has completed photography.

Full-HD384 steps: both lights59.98fps over90 seconds with zero intervals>33.34ms; native2515×2099 measured39.18 at384 and59.39 at128, neither stable60. See current performance section and raw reports.40 tests and both builds pass. Screenshots/probes are under `output/sharpness-2026-10-12/`. No gestures or deployment.


Final orbit/default-window1143×954 /384-step run also held59.98fps for90 seconds, zero long intervals. Console clean; temporary390×844 controls/composition inspected and native viewport restored. [Before](images/cumulonimbus-sharpness/before.jpg), [after](images/cumulonimbus-sharpness/after-left.jpg), [opposite sun](images/cumulonimbus-sharpness/after-right.jpg), [orbit](images/cumulonimbus-sharpness/orbit.jpg). Tower relief improves substantially; broad incus softness remains the next structural refinement.


### 2026-10-12 — formation, local motion and anvil structure

Rendered phases at.3/25.6/55.4/89.7seconds, same seed and fixed left camera, show vertical growth followed by upper spreading. Local body changes remain subtle compared with initial growth; upper strands still merge into broad soft areas. Right light, orbit and390×844 layout inspected; viewport restored, no console warnings/errors.49tests and both builds pass. Stable60 is **not** accepted: final full-HD53.23/43.28/53.18fps and window-orbit57.65fps over90seconds have long intervals. See [motion record and images](MOTION-2026-10-12.md). Owner photographic review remains separate. Gestures and publication stay deferred.
