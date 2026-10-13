# Cloudia

A browser sky controlled by your hands. First, make the cloud worth looking at.

## Current scene — October 2026

The default page shows one bounded 3D cumulonimbus with **Three.js r186 / WebGPU**. A worker builds a deterministic 256³ density volume, three lighting caches and a tiled 128³ fine-detail field. Light-space integration avoids repeatedly blurring accumulated shadows. Liquid and ice use separate optical coefficients. The shader integrates cloud radiance with self-shadowing, approximate multiple scattering and early ray termination. Density and light are never regenerated on every frame. Fine erosion and domain displacement are evaluated in the shader; a conservative occupancy mask in the detail texture skips empty sky without clipping the displaced contour.

Controls now include **two-axis pointer drag**, keyboard arrows/Home and **Ricentra**. **Nuova forma** cycles three deterministic anatomy families: broad congestus, unequal multicell turrets and a sheared cell with an attached downwind incus. The seed remains reproducible; density and lighting regenerate together while the previous cloud keeps animating.

Five localized rising thermals, an offset descending lobe, upper outflow and edge entrainment run in the existing16³ GPU flow. Height-dependent shear moves density, detail and cached light together. Broader connected bases and replenished tower necks replace a single stretched stack. The38-second formation and explicit0.5×/1×/2×/4× controls are accelerated authored evolution, not CFD or calibrated wind speed.

**Nube e correnti** offers family selection, wind intensity, a transient **Raffica**, **Disperdi**, **Ricondensa** and a held dispersion slider. Dispersion broadens transport, fragments and thins material smoothly; the burst recovers automatically. `CumulonimbusApp.applyWeatherImpulse({type:'gust'|'disperse'|'condense'|'lightning', strength?:number})` uses the same main/worker protocol and is ready for future hand input. Camera recognition is still deferred. A bounded world-space rain/virga shaft is now available through the shared atmosphere intent API.

**Atmosfera e temporale** defaults to a neutral overcast sky, with matching neutral ambient fill. The permanent weather console exposes sun, sunset, rain and storm; clear/haze remain selectable. Sky radiance and ambient/solar colour transition together through two half-float LUTs. Approximate ozone absorption improves low-sun colour; cloud-shadow directions remain fixed, so sunset lighting is still approximate. Seeded bent and branched internal flash channels are attenuated by the cloud volume and emit short irregular pulses. Thunder remains gesture-enabled WebAudio with acoustic distance delay:1/3/8km →2.92/8.75/23.32seconds. Pause freezes cloud motion/gust/dispersion; explicit manual lightning can still be auditioned. Pause/reset/hide cancel already pending sound. Press **Attiva audio** before playback.

Quality remains 256³ macro /128³ detail, 384 nominal steps and full configured resolution. No hidden dynamic resolution or temporal reconstruction. Main remains default; `?worker=1` remains optional. The current renderer, `observatory-v18`, preserves conservative integer empty advances under shear/growth, adds uneven macro outflow billows and compiles diagnostic probes separately from complete rendering. CPU light baking and GPU material use matching density formulas.

The personal-observatory UI keeps weather scenes visible, separates measurement tools and offers a clearly labeled future **Mani** guide without accessing the camera. The gesture vocabulary is a proposal, not an active recognizer. `applyAtmosphereIntent({type:'scene',scene:'clear'|'sunset'|'rain'|'storm'|'haze'})` and `{type:'rain',amount:0…1}` share main/worker transport.

Latest FullHD/384,90s results on this Apple/Metal-3 Mac: mature worker59.936fps (4 intervals>33.34ms), main growth/storm/orbit59.978fps (1 interval>33.34ms,6 flashes). These do not certify perfect60 or compositor presentation. The worker sample is less clean than the earlier office v16 result. Photographic realism, physical-phone/other-GPU qualification and listening acceptance remain open.

Latest implementation, research, raw measurements and limitations: [observatory study](docs/OBSERVATORY-2026-10-13.md). [Current handoff](docs/HANDOFF-OFFICE-2026-10-13.md) contains the manual restart workflow. Historical [office refinement](docs/OFFICE-REFINEMENT-2026-10-13.md) and [morphology](docs/MORPHOLOGY-2026-10-13.md) preserve earlier evidence. [Cloud research](docs/CLOUD-REPOS-2026-10-13.md) compares candidate approaches; no external source or photographic asset was imported.

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

Use **Nuova forma** to vary the bounded tower/anvil proportions, lobes and erosion. Density and lighting are regenerated together in the worker. The seed is visible in diagnostics and captured in the report; open `/?seed=1571198069` to reproduce that morphology. Reset resets motion/light, not the seed.

Reports include seed/morphology family, camera angles/target, wind/dispersion, simulation timestamps, motion model and support bounds, CPU submission samples, output/internal dimensions, volume resolution, nominal integration steps, frame intervals, median/p95/p99, long frames and asynchronous GPU timestamp samples when available. RAF cadence and GPU timings do **not** prove compositor presentation, display refresh capabilities or performance on another computer. CSS pixel sizing and fixed 720p/1080p buffers are explicit choices.

See [measured browser results](docs/PERFORMANCE-2026-10-11.md) and [renderer research](docs/RENDERER-RESEARCH-2026-10-11.md).

## Next interaction

The old swipe/fist/pinch mapping was provisional. The current [gesture proposal](docs/OBSERVATORY-2026-10-13.md#proposed-hand-vocabulary--not-an-approved-or-working-recognizer) uses explicit tool selection, a pinched sun handle, comfortable palm movement for rain/wind, deliberate storm lightning and optional two-hand dispersion. Confidence hysteresis, loss-of-tracking behavior, cooldowns and camera onboarding are specified there. Detection must run independently, with at most one inference in flight; manual controls remain available. No camera is requested by the current scene.

## Design and project record

- [Approved rebuild design](docs/superpowers/specs/2026-10-11-cumulonimbus-rebuild-design.md)
- [Implementation plan and decisions](docs/superpowers/plans/2026-10-11-cumulonimbus-webgpu.md)
- [Worklog](docs/WORKLOG.md)
- [Gotchas](docs/GOTCHAS.md)
- [Original lab design](docs/superpowers/specs/2026-05-13-cloudia-lab-design.md)

## Credits and license

Cloudia-owned code is [MIT](LICENSE); dependencies retain their own licenses. Interface typography uses locally served [Commissioner](https://fonts.google.com/specimen/Commissioner), with its [SIL Open Font License](public/fonts/commissioner/OFL.txt). [NOTICE](NOTICE.md) contains the project attribution request.

References include [Three.js](https://threejs.org/), [Joshbrew's modern WebGPU cloud research](https://github.com/joshbrew/webgpu_realtime_clouds), [Takram three-geospatial](https://github.com/takram-design-engineering/three-geospatial), [Maxime Heckel's cloudscapes](https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/), [SardineFish raindrop-fx](https://github.com/SardineFish/raindrop-fx), [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) and [lil-gui](https://lil-gui.georgealways.com/). The new volume and integration code is authored for Cloudia; no commercial renderer source has been imported.
