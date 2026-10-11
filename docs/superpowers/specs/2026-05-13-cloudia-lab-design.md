# Cloudia Lab Design

> October 2026: the new default WebGPU cumulonimbus scene is governed by [the approved rebuild spec](2026-10-11-cumulonimbus-rebuild-design.md). This document remains the legacy WebGL lab/embed design.

Date: 2026-05-13
Project root: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia`

## Goal

Build Cloudia Lab: a modular WebGL/Three.js prototype for volumetric raymarched clouds with two related experiences.

- Flow: a forward horizontal journey through a pastel cloud deck, using Maxime Heckel's cloudscape article as the primary technical and visual reference.
- Cumulus: a central hand-controllable cloud that can compress, expand, darken, and trigger storm/rain/mist states.

The lab must also prepare a future lightweight Elementor/WordPress hero export: a self-contained embeddable script/snippet with fixed defaults, no lab controls, and clean behavior inside a `width: 100%; height: 60vh;` flex/container layout.

## Success Criteria

Cloudia is successful when:

- Flow feels like travelling forward horizontally through a plane of clouds, not like a static background or generic smoke.
- The visual mood matches the reference feeling: dreamy, soft, pastel, lavender/blue/peach/pink light, creamy cloud edges, wide sky, soft horizon.
- Cumulus reads as a coherent cloud mass in the center of the viewport and responds clearly to mouse/touch and hand gestures.
- A closed fist compresses/condenses the cloud; opening the hand releases it into a larger darker cumulus/nimbus form.
- A closed left hand activates storm behavior: rain intensity rises, glass droplets appear, and the screen becomes misty/foggy.
- Reopening the left hand eases back to a clearer, calmer cloud state.
- Hand tracking can be disabled and the same controls remain testable with mouse/touch.
- Lab parameters can be tuned with lil-gui and copied as JSON presets.
- The render resizes correctly inside a hero container and does not require the lab UI to run.

## Primary References

- Maxime Heckel, "Real-time dreamy Cloudscapes with Volumetric Raymarching": https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/
- SardineFish `raindrop-fx`: https://github.com/SardineFish/raindrop-fx
- MediaPipe Hand Landmarker for Web: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js

## Experience Modes

### Flow

Flow is the reference-driven cloudscape mode. It must feel like moving forward through or just above a continuous cloud deck.

Key visual decisions:

- Camera direction: forward horizontal movement, with cloud features moving toward/under the viewer.
- Composition: wide sky above, cloud horizon around the lower-middle third, denser cloud mass in foreground.
- Color: pastel sky gradient with lavender, blue, peach, and pink; controllable time-of-day presets for dawn, afternoon, sunset, and night.
- Motion: slow cinematic forward travel with subtle lateral drift and noise animation.
- Lighting: soft directional light, warm highlights, muted violet/blue shadows, optional anisotropic scattering tuning.

### Cumulus

Cumulus is the interactive mode. It uses the same cloud rendering vocabulary but changes the staging from cloud-deck travel to a single controllable cloud mass.

Key visual decisions:

- Default shape: central cumulus with fluffy edges and visible density variation.
- Open hand / low compression: larger, brighter, calmer cloud.
- Closed fist / high compression: smaller, denser, brighter edge contrast or darker core depending on weather state.
- Release after compression: expansion burst into a larger darker cumulus/nimbus form.
- Storm state: denser cloud, lower light, rain, droplets, mist, and foggy screen effect.

## Architecture

Cloudia Lab will be implemented as a modular Vite + Three.js frontend project, with the lab UI separated from the visual engine.

Planned modules:

- `CloudEngine`: owns Three.js renderer, WebGL canvas, shader materials, resize, render loop, and shared uniforms.
- `CloudShader`: GLSL for raymarched cloud density, fbm/noise, lighting, scattering, sky gradient, and mode-specific shaping.
- `WeatherLayer`: rain, mist, glass droplets, and blur/fog overlay. It can start as a lightweight custom layer and borrow behavior concepts from `raindrop-fx`.
- `InputController`: normalizes mouse, touch, and optional MediaPipe hand data into a shared input state.
- `HandTracker`: MediaPipe setup, webcam lifecycle, hand landmark detection, handedness, and confidence handling.
- `GestureMapper`: converts landmarks into semantic values such as openness, fist amount, palm center, left-hand storm trigger, and smoothed confidence.
- `PresetStore`: serializes/deserializes all meaningful tuneable parameters and supports copy-to-clipboard JSON.
- `LabUI`: lil-gui controls, mode switching, hand tracking toggle, status readout, preset copy, and debug values.
- `EmbedAdapter`: mounts the same visual core into an arbitrary DOM element with fixed defaults and no lab chrome.

## Data Flow

The render loop reads a single normalized state object:

1. Raw input arrives from mouse/touch or MediaPipe.
2. `InputController` normalizes coordinates and active source.
3. `GestureMapper` converts normalized input into semantic controls:
   - `handPresence`
   - `primaryX`
   - `primaryY`
   - `openness`
   - `compression`
   - `leftHandClosed`
   - `stormIntent`
4. A smoothing layer damps jitter and transitions values over time.
5. `CloudEngine` updates shader uniforms for shape, density, lighting, time-of-day, camera travel, weather, and rain/mist intensity.
6. `WeatherLayer` samples the cloud canvas or receives weather values and renders droplets/mist over it.
7. `LabUI` displays controls and exports current settings as JSON.

## Gesture Model

The first gesture model must stay deliberately simple and tuneable:

- Hand openness: estimated from distances between wrist/palm and fingertip landmarks.
- Fist/compression: inverse of openness, smoothed over time.
- Palm center: average or weighted center of wrist and key palm landmarks, mapped to cloud position/light influence.
- Left hand storm trigger: when MediaPipe reports a left hand and its compression passes the storm threshold for a short hold duration.
- Release trigger: when compression drops below a release threshold after being high, start expansion/easing behavior.

Mouse/touch fallback:

- Pointer position maps to palm center.
- Pointer down or wheel/keyboard modifier can simulate compression.
- A lab toggle/button can simulate left-hand storm trigger for reliable testing without camera permissions.

## Preset Parameters

Presets must include:

- Mode: `flow` or `cumulus`.
- Time of day: dawn, afternoon, sunset, night, plus direct color values.
- Camera: speed, height, horizon, field of view, drift.
- Cloud: density, coverage, softness, fbm scale, fbm octaves profile, shape scale, vertical thickness, edge falloff.
- Lighting: sun direction, absorption, scattering anisotropy, highlight strength, shadow tint.
- Cumulus controls: base radius, compression amount, expansion amount, burst speed, darkness, storm darkening.
- Weather: rain intensity, droplet rate, droplet size, mist alpha, mist blur, storm easing.
- Input: hand tracking enabled, smoothing, openness threshold, compression threshold, storm hold time.
- Embed: autoplay, hand tracking default, reduced motion fallback, pixel ratio cap.

The lab must provide a "Copy params JSON" action that serializes the active preset.

## WordPress/Elementor Embed Direction

The embeddable version will be a later export from the same core, not a separate rewrite.

Expected usage shape:

```html
<div class="cloudia-hero">
  <div class="cloudia-brand">Brand or Logo</div>
  <div id="cloudia-mount"></div>
</div>
<script src="./cloudia-hero.min.js"></script>
<script>
  CloudiaHero.mount("#cloudia-mount", {
    preset: "approved-default",
    handTracking: false
  });
</script>
```

Embed requirements:

- It must render inside a parent container controlled by WordPress/Elementor.
- It must support `height: 60vh; width: 100%;`.
- It must keep canvas layers absolute and non-invasive.
- It must not require React, lil-gui, or lab-only debug UI.
- It must allow hand tracking to be omitted entirely for the lightest build.
- It must expose a small API: `mount`, `destroy`, `setPreset`, and optionally `setWeather`.

## Testing And Verification

Functional checks:

- App loads locally without a blank canvas.
- Flow mode renders a visible cloud deck and camera motion.
- Cumulus mode renders a central controllable cloud.
- Mouse/touch fallback controls cloud position/compression.
- Hand tracking can be toggled without breaking the app.
- Simulated storm trigger activates and deactivates rain/mist.
- Copy params produces valid JSON and can be re-applied.

Visual checks:

- Browser screenshot comparison against the provided Flow reference feeling.
- Desktop viewport check.
- Mobile/narrow viewport check.
- Hero container check at `100% x 60vh`.
- Console warnings/errors check.
- Canvas pixel check for nonblank render.

Performance checks:

- Pixel ratio cap available for slower devices.
- Raymarch step counts and lightmarch settings tuneable.
- GUI updates do not cause render loop stalls.
- Reduced-motion or low-quality preset available for embed.

## Plugin Usage Plan

- Superpowers: design spec, implementation plan, TDD/debugging/verification gates.
- Build Web Apps: frontend structure and implementation quality.
- Browser: local render inspection, screenshots, console checks, interaction tests.
- Frontend Testing Debugging: rendered QA loop after milestones.
- React Best Practices: only if the lab uses React for UI; keep transient render/input state outside React where practical.
- Imagegen: optional mood board or palette reference only; shader remains the primary visual medium.

## Non-Goals For The First Implementation

- No production WordPress plugin packaging yet.
- No backend.
- No account, persistence service, or database.
- No audio layer in the first pass, though the architecture must not block later thunder/rain sounds.
- No exact clone of the reference source code; the target is the visual and interaction behavior, with proper credit and sources.

## Documentation Location

All project documentation must live inside this Dropbox-synced project folder, under `docs/`, so it is available on other computers:

`/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs`

Project operating docs:

- `docs/PROJECT_OPERATING_RULES.md`: workflow, visual quality bar, documentation rules.
- `docs/WORKLOG.md`: work done, commit notes, and milestones.
- `docs/GOTCHAS.md`: traps and findings to preserve across sessions.
