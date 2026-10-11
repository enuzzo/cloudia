# Cloudia — first cumulonimbus scene

Date: 11 October 2026
Status: proposed design, awaiting user review. Supersedes the May design only for the new scene after approval. The old lab/embed remains a reference.

## Intended outcome

Build a browser scene on the current Mac showing one photographic-looking cumulonimbus centered against a restrained natural sky. Prioritize coherent morphology, believable light through the volume and stable animation. Aim for 60 fps at an explicitly measured resolution; pursue 120 fps on an appropriate refresh-rate display without sacrificing the accepted visual result. Publish online after the local result passes technical and visual review.

The larger interaction remains: lateral hand swipes select weather, closed fist produces rain, and a thumb–index closing pinch triggers lightning. This first milestone establishes the cloud and measurements; the camera recognizer and precipitation/lightning effects are subsequent work.

## Evidence behind the proposal

See [renderer research](../../RENDERER-RESEARCH-2026-10-11.md) for 12 candidates, pinned source snapshots, browser observations and performance qualifications. Current central Cumulus is a 2D shape, and live hand detection is not implemented. Existing baseline has 16 passing tests and a passing TypeScript check.

## Alternatives

1. **Recommended: focused Three.js/WebGPU volume renderer.** Author a bounded cloud volume, cache expensive density/light information, and render only rays crossing it. Borrow verified techniques from Joshbrew and Takram while keeping Cloudia modules small. Enables our isolated cloud and future local lightning. Costs more implementation work; performance remains to be demonstrated.
2. **Adapt Takram's existing WebGL cloud package.** Benefits from published benchmarks and mature atmosphere integration, but its geospatial layers need significant adaptation to an isolated cumulonimbus. Official cloud WebGPU implementation is still WIP.
3. **Use Skydrift commercially.** Working WebGPU/WebGL2 product with cloud presets. Needs a purchase and license review before integration into the public MIT project; source redistribution is restricted. Current observed preset does not meet our composition target by itself.

MRBNN demonstrates newer photographic real-time research but its CUDA requirements and non-commercial license exclude it as a direct browser foundation.

## Scene design

- One centered, asymmetrical storm cloud, fully framed with breathing room.
- Broad dark base, rising convective tower, rounded shoulders and spreading anvil; fine edge breakup subordinate to the large silhouette.
- Neutral daylight with a controllable sun direction, warm sunlit edges and cooler interior shadows. The user's photographic brief takes precedence over the old mandatory pastel palette.
- Slow internal drift and subtle evolution; fixed default camera, optional orbit for checking actual depth.
- Minimal controls: pause, reset, lighting direction, quality target and diagnostics. No legacy Flow/hero controls on the first-scene screen.
- A fixed seed, camera and light state supports repeatable comparison. No paid generation or purchased source is required by this proposal.

## Architecture

- `CloudVolume`: deterministic authored density envelope and reusable 3D detail texture; bounded startup generation with progress/cancellation.
- `CloudLighting`: cached sun transmittance/ambient approximation; clear invalidation when density or light changes. Slow updates may be amortized; rapid lighting must not use stale history.
- `CloudRenderer`: volume bounds intersection, empty-space skipping, front-to-back transmittance and early termination. Owns render targets and explicit quality parameters.
- `FrameController`: one animation loop; elapsed-time animation, resize coalescing, hidden-tab pause and clean teardown.
- `PerformanceMonitor`: actual output/internal sizes, backend, frame interval distribution and asynchronous GPU timing where supported. Unsupported timings remain labeled unavailable.
- `SceneControls`: scene state independent of input source, ready to accept later weather intents.

WebGPU is the first backend to test. Capability detection must handle unavailable adapters and device loss. A WebGL2 implementation is an evaluated fallback, not an assumed automatic translation of compute shaders. The old lab remains accessible for comparison; no broad dependency upgrade until compatibility has been checked.

## First-stage boundaries

Deliver the new scene beside the old lab, reproducible visual captures, diagnostics and a documented performance result. Do not expand into planetary clouds, terrain, wet-screen overlays, sound, hero embeds or webcam recognition during this stage.

The future gesture pipeline will use a worker with at most one inference in flight and discard stale frames. Render cadence and detection cadence are independent. Gestures will be normalized to hand size, use hysteresis/hold times and distinguish a swipe from an ordinary hand repositioning. A pinch fires once per close/reopen cycle; loss of tracking returns to a defined neutral intent.

## Verification and acceptance

1. Existing tests, TypeScript and builds remain green; verify new resource/state transitions with focused tests where useful.
2. Compare fixed-camera screenshots and moving views; check silhouette, depth, internal light/shadow, wisps, banding and temporal trails. Owner visual approval remains separate from technical pass.
3. Measure output at 1280×720 and 1920×1080. Report internal cloud resolution, sample counts and reconstruction settings alongside output size; never label an upscaled result native rendering.
4. After warmup, capture at least 30 seconds of visible frame intervals per scenario, repeated after a longer run for thermal stability. Include static cloud, slow orbit and abrupt lighting pulse. Record median/p95/p99 and long-frame counts.
5. For a 60 Hz display, target stable presentation near 60 fps and low missed-refresh counts; report GPU headroom separately. A 120 fps claim requires a measured compatible display/browser run. Neither a single FPS screenshot nor a GPU microbenchmark is sufficient.
6. If resolution/quality cannot meet the target, document the measured bottleneck and propose a specific change. Do not silently reduce resolution until the counter turns green.
7. Test resize, hidden/restored tab, repeated start/stop and resource cleanup. No online release until the local candidate is reviewable and accepted.

## Next stage after approval

Write the implementation plan, select the browser prototype's concrete files/dependency versions, then implement and measure the isolated cloud. Use the research report's pinned references; keep any imported third-party source license and attribution intact.
