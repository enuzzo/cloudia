# Cloudia

[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![GLSL](https://img.shields.io/badge/GLSL-Raymarched_clouds-7C3AED?style=for-the-badge)](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand_tracking-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
[![WordPress](https://img.shields.io/badge/WordPress-Hero_embed-21759B?style=for-the-badge&logo=wordpress&logoColor=white)](https://wordpress.org/)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](./LICENSE)

> _"What if the hero section was not a JPEG of clouds, but an anxious little weather god living in WebGL?"_
> - someone who saw volumetric raymarching at the wrong hour and immediately forgot how normal websites work.

**Cloudia** is a WebGL cloud lab for volumetric, hand-controllable weather.

It is part shader playground, part atmospheric hero engine, part tiny meteorological possession ritual for a browser canvas. The goal is simple enough to sound reasonable: dreamy raymarched clouds, rain on glass, mist, storm transitions, and optional MediaPipe hand tracking. The implementation will be less simple, because apparently we looked at a static hero background and decided it needed opinions, gesture recognition, and a copy-to-JSON button.

This is not a weather app. Weather apps tell you whether to carry an umbrella. Cloudia lets you close your left hand and summon a small front-end thunderstorm. Different department.

---

## What it is

Cloudia has two related modes.

### Flow

The cinematic one.

A forward horizontal journey through a soft plane of volumetric clouds: pastel sky, fluffy cloud deck, slow camera drift, lavender shadows, peach highlights, that specific sensation of flying through a screensaver that learned GLSL and became emotionally unavailable.

The visual target is inspired by Maxime Heckel's cloudscape work: wide sky, soft horizon, cloud features moving toward and under the viewer, not a flat smoke texture pretending to be depth.

### Cumulus

The possessed one.

A central cumulus cloud reacts to input:

- open hand: calm, airy, expanded cloud
- closed fist: compression and condensation
- release: expansion into a darker cumulus/nimbus mass
- closed left hand: storm state, rain, droplets, mist, gloom
- reopened left hand: weather forgives you and returns to clear mode

Mouse and touch remain first-class fallbacks, because browser camera permissions are a social contract with a popup.

---

## Why this exists

Because hero sections are usually either:

1. a stock video that loads like a piano falling down the stairs,
2. a gradient with three divs named `blob`,
3. or a 4 MB photo of a cloud that has never done anything interactive in its life.

Cloudia is the fourth option: a shader-driven atmosphere that can run as a lab while we tune it, then shrink into an embeddable WordPress/Elementor hero when it grows up and stops needing lil-gui supervision.

The lab is where we tune the beast. The embed is the polite version you invite onto a client site.

---

## Planned shape

```
Cloudia Lab
    │
    ├── CloudEngine
    │   └── Three.js renderer, raymarch shader, uniforms, resize, render loop
    │
    ├── Flow mode
    │   └── forward travel through a volumetric cloud deck
    │
    ├── Cumulus mode
    │   └── central compressible cloud with storm transitions
    │
    ├── InputController
    │   └── mouse, touch, optional MediaPipe hands
    │
    ├── GestureMapper
    │   └── openness, fist/compression, left-hand storm trigger
    │
    ├── WeatherLayer
    │   └── rain, glass droplets, mist, fog/blur overlay
    │
    ├── PresetStore
    │   └── tunable params, JSON import/export, copy params
    │
    └── EmbedAdapter
        └── no GUI, fixed defaults, Elementor-friendly mount API
```

The future embed target is deliberately boring:

```html
<div class="cloudia-hero">
  <div class="cloudia-brand">Your enormous logo, minding its business</div>
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

Expected container: `width: 100%; height: 60vh; position: relative; overflow: hidden;`.

If the embed needs a PhD to install, we failed.

---

## Current status

Design/spec phase.

The project spec lives here:

- [`docs/superpowers/specs/2026-05-13-cloudia-lab-design.md`](docs/superpowers/specs/2026-05-13-cloudia-lab-design.md)
- [`docs/PROJECT_OPERATING_RULES.md`](docs/PROJECT_OPERATING_RULES.md)
- [`docs/WORKLOG.md`](docs/WORKLOG.md)
- [`docs/GOTCHAS.md`](docs/GOTCHAS.md)

Implementation is next: Vite, Three.js, shader scaffolding, GUI, presets, then hand tracking and weather layers.

---

## Technical direction

| Area | Direction |
|---|---|
| Rendering | Three.js + custom GLSL fragment shader |
| Cloud technique | Volumetric raymarching, fbm/noise density, directional lighting |
| Motion | Forward camera travel for Flow, shape uniforms for Cumulus |
| Input | Mouse/touch baseline, MediaPipe hand tracking optional |
| Weather | Rain/mist/droplet layer over cloud canvas |
| Tuning | lil-gui plus JSON preset export |
| Embed | Separate lightweight entry with fixed defaults and no lab UI |
| QA | Browser screenshots, console checks, mobile/desktop, `60vh` hero test |

---

## Credits and inspirations

Cloudia is original project work, but it is absolutely standing on the shoulders of people who were already deep in the cloud mines before us.

### Maxime Heckel

Primary visual and technical inspiration:

- [Real-time dreamy Cloudscapes with Volumetric Raymarching](https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/)

This is the big one: volumetric cloudscape mood, raymarching structure, density sampling, lighting direction, dithering/optimization notes, and the general feeling of travelling through a soft cloud plane while your GPU quietly negotiates with reality.

### Inigo Quilez

Referenced through Maxime's article and the broader shader canon:

- [Inigo Quilez](https://iquilezles.org/)
- [Shadertoy](https://www.shadertoy.com/)

If you write procedural shaders and do not eventually end up in an Inigo Quilez article, check your coordinates. You may be in a spreadsheet.

### SardineFish

Rain/glass effect inspiration:

- [SardineFish/raindrop-fx](https://github.com/SardineFish/raindrop-fx)

Cloudia's storm layer is inspired by the idea of rendering convincing raindrops and mist as a WebGL overlay. We are not pretending to have invented wet glass. We are merely planning to make the glass emotionally manipulative.

### MediaPipe / Google AI Edge

Hand tracking reference:

- [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)

Used for optional webcam-based hand landmarks: openness, fist compression, handedness, and the left-hand storm trigger. The camera remains optional; mouse/touch fallback is not a pity mode, it is the sane baseline.

### Three.js

Rendering foundation:

- [Three.js](https://threejs.org/)

The part where JavaScript looks at WebGL and says, "I can make this slightly less ceremonial."

### lil-gui

Lab controls:

- [lil-gui](https://lil-gui.georgealways.com/)

Because every shader project eventually needs 47 sliders and one of them is called `stormForgiveness`.

### Sample Focus

Potential source for future sound effects:

- [Sample Focus](https://samplefocus.com/)

Audio is not in the first pass. Thunder can wait outside until the clouds behave.

---

## Documentation tone policy

Be accurate. Credit real sources. Link the actual work. Do not launder inspiration through foggy hand-waving unless the reference is genuinely unknown.

Also: do not write like a B2B SaaS homepage that discovered meditation. Cloudia is allowed to be precise, nerdy, and a little unwell.

---

## License

MIT - Netmilk Studio sagl.

Use it, fork it, perform a small weather event in a browser tab. Attribution appreciated. Do not blame us if someone asks why the hero section needs hand tracking and you realize you agree with them.
