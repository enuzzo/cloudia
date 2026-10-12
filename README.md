# Cloudia

A browser sky controlled by your hands. First, make the cloud worth looking at.

## Current scene — October 2026

The default page shows one bounded 3D cumulonimbus with **Three.js r186 / WebGPU**. A worker builds a deterministic 256³ density volume, three lighting caches and a tiled 128³ fine-detail field. Light-space integration avoids repeatedly blurring accumulated shadows. Liquid and ice use separate optical coefficients. The shader integrates cloud radiance with self-shadowing, approximate multiple scattering and early ray termination. Density and light are never regenerated on every frame. Fine erosion and domain displacement are evaluated in the shader; a conservative occupancy mask in the detail texture skips empty sky without clipping the displaced contour.

Controls: pause, slow orbit, two sun directions, reset, seeded random regeneration, explicit quality/resolution presets and 30/90-second performance measurements with JSON export. Default quality uses 384 nominal steps and full configured resolution. The screen preset explicitly uses device pixel ratio; the default window preset uses one buffer pixel per CSS pixel. No hidden dynamic resolution or temporal reconstruction.

The cloud grows upward and spreads its anvil later. Five local rising thermals, peripheral erosion and upper shear are evaluated in a small16³ GPU compute field; the former68-second atlas loop is no longer used by the live scene. Ice fibres separate more strongly. Press **Ricomincia** for the38-second accelerated formation, or use **Nube matura** and the explicit0.5×/1×/2×/4× cloud speed controls. This is authored evolution with approximate co-deformed cached lighting, not CFD.

**Atmosfera e temporale** provides clear/hazy/storm skies, automatic or manual internal flashes, a held-light inspection mode and gesture-enabled thunder audio. A shared atmosphere table supplies sky radiance and the cloud's solar/ambient colors. Thunder delay follows acoustic distance:1/3/8km →2.92/8.75/23.32seconds, independent of cloud speed; this audition control does not move the camera. Pause/reset/hide cancel pending sound. The browser requires pressing **Attiva audio** before playback.

**Stable60fps remains an open gate.** The new FullHD/384 worker runs measured59.96fps for90s during clear formation,58.47with automatic flashes/audio, and58.00with haze/right light/orbit. The final storm repeat after coordinate review measured58.88fps,40long intervals and5.998ms GPU rendering. Earlier rendering GPU means were5.68/5.76/5.34ms; RAF submission intervals are not compositor presentation. No hidden resolution reduction or TAA. Main remains default; `?worker=1` remains optional. Photographic quality and listening acceptance remain owner-review gates. See [current implementation, temporal evidence, failures and restart](docs/WEATHER-2026-10-13.md). Gestures stay deferred.

The original WebGL laboratory is preserved at `/?legacy`. The existing `CloudiaHero.mount(...)` embed build still uses that engine.

## Run and verify

```sh
bun install --frozen-lockfile
bun run dev
```

Open `http://127.0.0.1:5173/`. WebGPU requires a supported browser/GPU and a secure context; localhost is supported. If initialization fails, the scene displays the reason instead of silently switching to a different rendering pipeline.

```sh
bun run test
bun run typecheck
bun run build
bun run build:hero
```

Build the application first, then the hero, to retain both outputs in `dist`. The application build cleans the directory; the hero build preserves existing application assets. The browser QA script in the legacy package scripts is not currently supplied; browser verification is performed in the Codex in-app browser.

## Performance methodology

Open **Qualità e misure**, choose an output resolution and quality, then start a measurement. It warms up for two seconds and records complete visible `requestAnimationFrame` intervals for 30 or 90 seconds. Changes to scene controls, size or visibility cancel the running test. Closing the measurement panel does not cancel it.

Use **Nuova nube** to vary the bounded tower/anvil proportions, lobes and erosion. Density and lighting are regenerated together in the worker. The seed is visible in diagnostics and captured in the report; open `/?seed=1571198069` to reproduce that morphology. Reset resets motion/light, not the seed.

Reports include seed/morphology, simulation timestamps, motion model and support bounds, CPU submission samples, output/internal dimensions, volume resolution, nominal integration steps, frame intervals, median/p95/p99, long frames and asynchronous GPU timestamp samples when available. RAF cadence and GPU timings do **not** prove compositor presentation, display refresh capabilities or performance on another computer. CSS pixel sizing and fixed 720p/1080p buffers are explicit choices.

See [measured browser results](docs/PERFORMANCE-2026-10-11.md) and [renderer research](docs/RENDERER-RESEARCH-2026-10-11.md).

## Next interaction

- An open-hand swipe to the left/right changes the weather scene.
- A closed fist produces rain.
- Closing thumb and index finger triggers lightning.

Detection must run independently from the rendering loop, with at most one inference in flight and gesture hysteresis/cooldowns. Pointer/touch controls will remain useful while camera recognition is tuned.

## Design and project record

- [Approved rebuild design](docs/superpowers/specs/2026-10-11-cumulonimbus-rebuild-design.md)
- [Implementation plan and decisions](docs/superpowers/plans/2026-10-11-cumulonimbus-webgpu.md)
- [Worklog](docs/WORKLOG.md)
- [Gotchas](docs/GOTCHAS.md)
- [Original lab design](docs/superpowers/specs/2026-05-13-cloudia-lab-design.md)

## Credits and license

Cloudia-owned code is [MIT](LICENSE); dependencies retain their own licenses. Interface typography uses locally served [Commissioner](https://fonts.google.com/specimen/Commissioner), with its [SIL Open Font License](public/fonts/commissioner/OFL.txt). [NOTICE](NOTICE.md) contains the project attribution request.

References include [Three.js](https://threejs.org/), [Joshbrew's modern WebGPU cloud research](https://github.com/joshbrew/webgpu_realtime_clouds), [Takram three-geospatial](https://github.com/takram-design-engineering/three-geospatial), [Maxime Heckel's cloudscapes](https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/), [SardineFish raindrop-fx](https://github.com/SardineFish/raindrop-fx), [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) and [lil-gui](https://lil-gui.georgealways.com/). The new volume and integration code is authored for Cloudia; no commercial renderer source has been imported.
