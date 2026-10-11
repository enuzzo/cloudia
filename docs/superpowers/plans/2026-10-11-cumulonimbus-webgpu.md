# Central cumulonimbus implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution.

**Goal:** Render one framed, naturally lit 3D cumulonimbus in the local browser and record honest performance evidence before hand tracking.

**Architecture:** Three.js WebGPU fullscreen ray integration over a bounded, deterministic density volume. A worker generates density, two directional solar optical-depth caches and a vertical sky cache once. One animation loop drives camera, slow motion, rendering and measurements. The old lab remains at `?legacy`.

**Tech Stack:** Three.js r186 WebGPU/TSL, native WGSL function, TypeScript, Vite, Web Worker, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-cumulonimbus-rebuild-design.md` — approved by user on 2026-10-11.

## Global Constraints

- Preserve legacy lab and hero API; no deployment in this milestone.
- No per-frame CPU density generation, no nested per-pixel sun march.
- Explicit quality presets, output/internal resolution, RAF intervals and GPU timing availability. Never imply RAF proves compositor presentation or 120 Hz capability.
- Cancel worker and animation loop on teardown, pause hidden-tab work and invalidate interrupted benchmarks.
- Browser image and animated behavior are the visual acceptance evidence; unit tests cannot establish photographic quality.

## Review Focus

Silhouette, cloud opacity and dimensionality, cache/shader agreement on extinction, actual WebGPU backend, benchmark denominator, hidden-tab interruption, resize/disposal and legacy routes.

### Task 1: deterministic volume and measurement primitives

- [x] Add meaningful tests for density bounds/seed repeatability and frame statistics including slow-frame tails and hidden interruptions. Watch missing APIs fail.
- [x] Implement `src/cumulonimbus/volume.ts`, `volume.worker.ts`, and `performance.ts`. Volume interface: `{size, data: Uint8Array}` with RGBA density, left sun, right sun, vertical sky optical depths (0–16). Statistics consume actual frame intervals; benchmark has warmup and fixed visible duration.
- [x] Verify targeted tests and suite. Texture generation belongs to worker; light direction choices use matching cached directions.

### Task 2: WebGPU scene and visible controls

- [x] Implement `cloudShader.ts` bounded front-to-back integration, stable jitter, transmittance early exit, cached light and approximate multiple scattering. Use explicit texture LOD in nonuniform loops.
- [x] Implement `CumulonimbusApp.ts`: WebGPU initialization, one RAF, worker progress, explicit resolution/steps presets, orbit, pause/reset, two light directions, diagnostics and 30-second benchmark/export. Handle unsupported GPU/init failure with an actionable visible error.
- [x] Route `src/main.ts` to new scene by default and dynamic-import old lab with `?legacy`. Refine `index.html` and scoped styles for sparse Italian controls.
- [x] Typecheck/build/tests, then inspect first rendered image, shader console and controls in local browser. Refine density/light using captured evidence.

### Task 3: browser measurements and handoff

- [x] Capture fixed image, orbit and abrupt light changes. Inspect warnings/errors and legacy route.
- [x] Run visible warmed 30-second benchmarks at 1280x720 and 1920x1080, disclose internal dimensions and actual browser/device. Repeat the most useful preset longer for sustained behavior.
- [x] Save sanitized benchmark evidence and screenshots, update WORKLOG/GOTCHAS/spec status and performance notes. Review diff and run final relevant suite/build.
- [x] Commit coherent local change, leave the new scene visible; report observed quality and performance limits honestly. Gestures are next.

## Execution ledger

- Authorization: user explicitly approved implementation and local browser validation; proceed inline without another plan approval.
- Ruling: upgrade to r186 after observing a concrete r181 timestamp-query teardown bug; keep WebGPU types explicit. Cost: legacy renderer compatibility must be checked.
- Ruling: two baked sun directions first, rather than continuous direction with stale caches. Cost: limited lighting controls until GPU cache regeneration is added.

- Task 1 complete: five tests failed against empty APIs, then passed for density bounds/determinism/light and frame statistics/cancellation.
- Task 2 complete: authored cellular volume, cached optical depths, ACES shoulder, bounded ray integration, fixed jitter, one RAF, explicit presets, diagnostics and JSON export.
- Final independent review: two important async lifecycle findings reproduced by failing tests and corrected (post-init disposal and terminal device loss); preset aspect deformation also corrected with contained canvas rendering.
- Visual refinements: corrected quad UV orientation and inconsistent sky tone mapping across AABB hit/miss; larger overlapping lobes and height-dependent erosion keep anvil/base coherent.
- Ruling: use fixed, spatial jitter without TAA for this static-volume milestone; avoids reprojection trails and keeps cost/results transparent. Cost: high-frequency grain and true density evolution still need later work.

- Task 3 implemented and verified: browser images, controls, raw 30/90-second reports, CPU/GPU separation, local documentation and green checks. Runtime acceptance is explicitly incomplete: final 1080p Massima measured 57.09 fps for 90 seconds, not sustained 60/120; photographic detail needs further refinement and owner visual review.
- User clarification: fixed seed was for repeatable comparisons; added a small Nuova nube control with bounded seeded morphology and ?seed= reproducibility. Density and light stay coherent.
- Follow-up independent review: hidden-initial-load double-RAF risk reproduced by a failing test, corrected; export filename now uses immutable report context. No important remaining lifecycle findings in reviewed source.

- Local code checkpoint: `6ffa9e5`; scene left visible in the in-app browser. No push, deployment or gesture integration in this milestone.
