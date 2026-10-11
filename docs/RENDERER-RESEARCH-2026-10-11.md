# Cloudia renderer research — 11 October 2026

Status: research completed; renderer selection and performance acceptance remain open.

## User brief

Rebuild Cloudia around a photorealistic central cumulonimbus, running in a browser on the current Mac, with eventual online publication. Target 60 fps and pursue 120 fps where the display and browser permit. Later gestures: lateral open-hand swipes select weather, a closed fist produces rain, and a thumb–index pinch triggers lightning.

The user explicitly requested a deeper survey of recent GitHub, Three.js and other implementations before choosing an architecture. Recency alone is not evidence of rendering quality or performance.

## Local baseline

- Clean working tree at research start; HEAD `2befe25`.
- Host reports iMac Pro, 8 CPU cores, 32 GB RAM, Radeon Pro Vega 56. Display refresh rate and browser GPU adapter have not been established.
- Existing dependencies specify Three.js `^0.181.0`.
- Existing Cumulus mode uses a 2D radial shape and screen-space FBM, not volumetric integration through a central cloud.
- MediaPipe is listed as a dependency, but input currently comes from pointer events; no live camera hand detector is connected.
- Renderer, weather layer and input/state each own animation loops. State easing is per frame; a rewrite needs time-based updates to preserve behavior at different refresh rates.
- Baseline verification: 7 test files / 16 tests passed; TypeScript check passed. These checks do not prove rendering performance or visual fidelity.
- Browser baseline: two canvases; WebGL 970×810 and weather 1142×953 for a roughly 1143×954 CSS viewport. No captured warning/error logs in that check.
- Local Vite restarted after the interrupted session at `http://127.0.0.1:5173/`.

## How the survey was performed

Search-engine discovery followed by primary repository documentation, public GitHub API metadata, selected source inspection and live browser inspection. Public source files were downloaded for reading only into `/private/tmp/cloudia-render-research`.

Dates below are GitHub repository `pushed_at`, unless labeled otherwise. A repository push does not mean the cloud subsystem changed that day or that a matching release/deployment exists. Source snapshots were pinned where inspected in depth.

## Candidate comparison

| Candidate | Verified recency | Technique / useful contribution | Evidence and limits | Decision |
| --- | --- | --- | --- | --- |
| [joshbrew/webgpu_realtime_clouds](https://github.com/joshbrew/webgpu_realtime_clouds) | 11 Oct 2026; created Nov 2025 | WebGPU compute, cached density/light fields, adaptive volume traversal, empty-column skipping, temporal resolve, authored cumulonimbus/anvil | MIT. Source inspected. Latest commit concerns planet warp/texture scroll. No comparable end-to-end Vega 56 benchmark found. Demo root returned a noise lab; the cloud HTML path is a scriptless template and remained black. Current cloud deployment is not validated. | Strongest recent source reference for a cloud-specific prototype; adoption conditional on local performance and visual inspection. |
| [Takram three-geospatial / three-clouds](https://github.com/takram-design-engineering/three-geospatial) | 27 May 2026; created Aug 2024 | Volumetric clouds, Beer shadow maps, atmospheric integration, temporal upscaling | MIT, published package, browser demo rendered. Official cloud package remains GLSL/WebGL; WebGPU clouds marked WIP. Author provides device/resolution benchmarks for v0.0.1. Mainly geospatial cloud layers. | Best documented browser baseline for atmosphere, lighting and quality/performance comparisons. |
| [Three.js official WebGPU cloud example](https://threejs.org/examples/webgpu_volume_cloud.html) and [volumetric TRAA example](https://threejs.org/examples/webgpu_volume_lighting_traa.html) | Latest published release r186, 24 Sep 2026; development tree active 11 Oct | TSL, 3D texture raymarching, early exit; separate VolumeNodeMaterial/temporal lighting example | MIT. Cloud demo rendered; visible FPS counter near 61 in one capture, not a sustained benchmark. Source uses simple density-gradient shading rather than a complete photographic cloud-light transport model. Inspected examples are development snapshots, not assumed identical to r186. | Useful modern framework and implementation primitives; cloud demo alone does not meet the visual target. |
| [Skydrift](https://getskydrift.com/) | Current 2026 product; docs target Three.js r184 | Physical atmosphere LUTs, Perlin–Worley volumes, self-shadowing, multiple-scattering approximation, temporal accumulation; cumulonimbus preset | Commercial source, advertised $32. Demo rendered through WebGPU and displayed about 60 fps in snapshots. At current camera the cumulonimbus showed dark elongated masses, not our desired isolated central composition. Docs describe cinematic tier as primarily for offline capture. No complete hardware-qualified benchmark found. Source redistribution restricted; relevant to public Cloudia repo. | Useful visual/commercial comparison. Do not purchase or incorporate source during research. |
| [jeantimex/procedural-clouds](https://github.com/jeantimex/procedural-clouds) | 9 Feb 2026; created 8 Feb | Pure WebGPU compute density cache, adjustable cache update frequency and lighting | MIT. Compact source inspected. Still performs secondary light marching in main render; no end-to-end benchmark found. No WebGL fallback documented. | Small reference for density-cache integration; not proven faster or more realistic than other candidates. |
| [frmlinn/clouds-sim](https://github.com/frmlinn/clouds-sim) | 19 May 2026; created Mar | WebGL2 noise baking, AABB intersection, sun-view shadow prepass, TAA | MIT. Shadow shader inspected. Author explicitly documents ghosting, box clipping and float framebuffer requirements. No device-qualified performance table found. | Useful WebGL2 fallback/reference; lighting approximations and temporal motion need verification. |
| [leoawen/volumetric_cloud_atmosphere_scattering](https://github.com/leoawen/volumetric_cloud_atmosphere_scattering) | 30 Jan 2026 | Three.js/GLSL planetary atmosphere, baked Perlin–Worley, weather map, TAA and god rays | MIT. Repository describes AI-assisted development. No comparable quantitative benchmark found in reviewed material; planetary scope exceeds our first scene. | Secondary visual/pipeline reference. |
| [tatsuya-ogawa/cesium-volumetric-clouds](https://github.com/tatsuya-ogawa/cesium-volumetric-clouds) | 27 Jul 2026 | Cesium depth composition; cloud buffer at 40% resolution | MIT. Adds globe/building integration we do not need; reduced cloud resolution must be included in comparisons. | Exclude as Cloudia foundation; retain compositing reference. |
| [kotivas/skygl](https://github.com/kotivas/skygl) | 25 Jul 2026; created Apr | Native OpenGL sky/cloud renderer | MIT. Native build rather than browser library. | Visual/algorithm reference only. |
| [dao-media/threejs-clouds-v5](https://github.com/dao-media/threejs-clouds-v5) | Metadata has inconsistent creation/push ordering; do not infer freshness | Claude Code skill with shader snippets, cloud taxonomy and generated-code guidance | README explicitly identifies it as a skill. Statements such as 4× speedup are not hardware-qualified measurements of a shipped renderer. | Exclude from executable-renderer shortlist. |
| [mxcop/vapor](https://github.com/mxcop/vapor) | 3 Nov 2025 | Unreal Engine volumetric cloud plugin | Repository archived; GitHub API did not identify a license. Native Unreal scope. | Exclude as browser dependency. |
| [MRBNN, SIGGRAPH 2026](https://github.com/Extra-Creativity/MRBNN) | SIGGRAPH 2026 publication | Neural radiance baking for complex multiple scattering | Authors report 200 fps at 1024×1024 on their project page. C++/CUDA implementation; no browser/AMD implementation. Training code/dataset not released; non-commercial license. | Research frontier and photographic reference, unsuitable as direct implementation on this Mac. |

## Performance evidence worth keeping

[Takram's official cloud README](https://github.com/takram-design-engineering/three-geospatial/blob/b012ad06d858fc035d88aacfd73f092f93c994e4/packages/clouds/README.md) reports, for its v0.0.1 Tokyo scene:

- M3 Max, Chrome, 4K, High: 92–95 fps with temporal upscaling; 31 fps without it.
- M3 Max, Chrome, 4K, Ultra: 76–77 fps with temporal upscaling.
- M4 iPad Pro, Safari, 2420×1520, Medium: 60 fps with temporal upscaling; High: 43–55 fps.

These are author measurements, not tests performed by us, and concern an older package version. They include a scene different from our intended single cloud. The data shows why internal sampling resolution and temporal reconstruction must be recorded explicitly.

[MRBNN's project page](https://extra-creativity.github.io/projects/MRBNN/) states 200 fps at 1024×1024; its CUDA requirements and license prevent treating that as a browser performance promise.

Joshbrew's documentation carefully distinguishes API encoding time, GPU queue completion, GPU timestamp microbenchmarks, displayed RAF cadence and total scene performance. Its planet/noise microbenchmarks must not be reported as cloud-scene FPS. Its default cloud render scale divider is 4, meaning quarter resolution per axis before presentation upsampling. At full resolution, temporal interleaving can dispatch only a subset of rays. Reviewed docs contain some evolving guidance about combining these modes; inspect actual runtime behavior rather than relying on prose alone.

Skydrift's advertised 60 fps captures do not specify a complete device/resolution test matrix. Its documentation gives internal downscale and march budgets, and explicitly calls cinematic primarily an offline capture tier.

## Browser visual observations

Screenshots are local, ignored QA evidence under `output/research-2026-10-11/`:

- `three-volume.jpg`: official Three.js example; soft central volume, visibly insufficient internal structure for the photographic target.
- `skydrift-cumulonimbus.jpg`: WebGPU cumulonimbus preset; a working storm volume, but current framing/silhouette does not deliver the requested single central cloud.
- `takram-basic.jpg`: working layered sky and lighting; good atmospheric reference, not an isolated cumulonimbus.

These are different scenes, viewports/camera states and quality settings. Do not rank performance or absolute realism from unmatched screenshots. Three.js and Skydrift had no captured warning/error logs in the sampled inspections; Takram showed deprecation/accessibility warnings but rendered. No sustained or hardware-timestamp benchmark was performed.

## Source snapshots

- Joshbrew: `cb52d978e1107da2e2337c059c769cd9dea52a33`. Read `tools/clouds/README.md`, `clouds.js`, `weather/cloudAnvilLook.js`, `shaders/cloudResolve.wgsl`. The renderer class file is 4,139 lines: borrowing selected techniques is preferable to importing the full playground unquestioned.
- Takram: `b012ad06d858fc035d88aacfd73f092f93c994e4`. Read `packages/clouds/README.md`; verified published benchmark and official WebGPU status.
- Three.js development: `f12e7868b4cb9d491512d7f0f372e329a5d2bc0f`. Read `examples/webgpu_volume_cloud.html` and `examples/webgpu_volume_lighting_traa.html`.
- Jeantimex: `1c9481c33660d2b1acc5e3191ab8eaff30eca219`. Read `shaders/cloud.wgsl`.
- Frmlinn: `03e8d02150effcf02465d3f5a6c3b211920b0033`. Read `src/shaders/shadow.frag`.

## Recommended direction — pending design review

Use modern Three.js/WebGPU as the first backend to evaluate, with an isolated authored 3D density volume and cached lighting inspired by the recent source references. Keep the legacy lab available. Evaluate browser capabilities at runtime; neither WebGPU nor a fallback is assumed to be supported or automatically faster.

For our target, shaping matters as much as shading. A single central cloud needs a dark broad base, a coherent rising tower, rounded billows and an asymmetric anvil. A geospatial cloud-layer package or generic procedural noise cannot supply that composition automatically. A deterministic authored volume also gives repeatable images for lighting/performance comparisons.

Before adopting a renderer, compare one cloud with matching framing/light, at explicit 1280×720 and 1920×1080 output sizes. Record actual internal buffer resolution, browser backend/adapter, quality parameters, warmup, displayed frame intervals and GPU timings if available. Test stationary rendering, slow movement, rapid lighting changes and a lightning-like pulse for temporal trails. A fast render that blurs the cloud fails the visual requirement.

60 fps permits 16.67 ms per displayed frame; 120 fps permits 8.33 ms. Reserve budget for hand detection and effects. Display/browser refresh can cap RAF; a 60 Hz counter does not establish a 120 fps ceiling of the renderer. GPU timing alone does not prove stable presentation.

Future hand recognition runs outside the main render thread. Google explicitly documents that `detectForVideo()` is synchronous and can block the UI, recommending workers: [MediaPipe Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

## Continuation after interruption

No product code, dependencies or lockfile changed during this research. No external publication, purchase or push performed. Continue by reviewing the proposed first-scene design, then planning the browser prototype and measuring it before integrating gestures. Research does not establish owner visual approval or attainment of 60/120 fps.
