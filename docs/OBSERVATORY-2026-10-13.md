# Cloudia — observatory, atmosphere and occupied-work study

Starting checkpoint: dd0784603b80f2da3a2a054f93d27b3286de5d31. Existing local
checkout and feature branch; no concurrent writer. Browser plugin not available;
the supported `cua_repl` in-app browser provides Playwright/native controls.
The previous chat explicitly closed its old cloud tab before measurement.

## Photographic comparison and direction

Viewed the actual photographs in [NASA S'COOL's cumulonimbus collection](https://scool.larc.nasa.gov/GLOBE/cumulonimbus.html),
including the full [Terry O'Leary side view, Virginia 2003](https://scool.larc.nasa.gov/images/Cb10.jpg)
and Jeff Caplan's Rocky Mountains anvil. NASA hosting does not make guest
photographers' images public domain. Reference-only; no image imported or
redistributed. [WMO Incus](https://cloudatlas.wmo.int/en/clouds-supplementary-features-incus.html)
supports smooth, fibrous and striated tops: simply adding roughness everywhere
would be a poor proxy for realism. The web text endpoint failed on a direct
open; the indexed definition was available.

| Evidence in photographs | Initial render | Intervention / remaining mismatch |
| --- | --- | --- |
| Broad attachment with uneven upper turrets | Thin elliptical shelf above a textured body | Seeded intermediate outflow billows; thicker distal core and uneven macro carving |
| Long, partly translucent distal fibers | Smooth roof, some repetitive strands | Retain v16 fine material; break the macro envelope instead of simply raising opacity |
| Aerial perspective and horizon contrast | Gray object against nearly uniform gray | Neutral overcast radiance varies with elevation, below-horizon extinction; aerial attenuation integrated per occupied sample |
| Rain beneath a dense base | No precipitation | Bounded world-space rain/virga shaft integrated with view transmittance; authored effect, not hydrometeor simulation |
| Environment establishes scale | Isolated volume without terrain or surrounding clouds | Intentionally retained as an interactive specimen; this is still a barrier to photographic realism |

The scene remains authored, not CFD or a forecast. Cached optical depth remains
approximate during deformation. Sunset uses a lower sun in atmospheric radiance
and solar colour, while the two existing cloud shadow directions remain fixed.
It is an atmospheric colour study, not a physically exact low-sun shadow solution.

## Technical research and alternatives

- [Guerrilla Nubis³](https://www.guerrilla-games.com/read/nubis-cubed), Andrew
  Schneider, 2023: multiscale voxel authoring, density up-resolution and lighting
  approximations support improving the macro envelope before adding per-sample
  noise. No source or assets copied; publication is not a code reuse license.
- [Bruneton, Precomputed Atmospheric Scattering](https://ebruneton.github.io/precomputed_atmospheric_scattering/):
  atmosphere/solar consistency and reference comparisons. Cloudia retains its
  smaller single-scattering LUT, rather than claiming that full model. A second
  half-float LUT permits smooth interruption-safe transitions without per-frame
  CPU texture uploads. No third-party code imported.
- [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html):
  local pinned r186 source is authoritative for texture formats and timestamps.
  Existing GPU timestamp API retained; actual WGSL must compile in the browser.
- Full per-sample light marching and neural scattering were not adopted: either
  adds nested work or training/runtime resources before evidence of necessity.
  Distance-field empty traversal was deferred because prior v15 did not establish
  a speedup and this task specifically measures occupied work.

## Product audit and implemented direction

Initial interface: nine equally weighted controls in a bottom strip; scenes
hidden behind technical settings; small anonymous title; no visible hand-input
preparation. New direction: personal observatory, atmospheric specimen central,
large compact serif wordmark, existing self-hosted Commissioner for controls,
forest-charcoal instruments, pale citron active feedback. No new font dependency.
Weather scenes have their own permanent four-button console. Exploration,
weather details and diagnostic controls remain distinct. All previous controls
are retained. The hand guide is explicitly future; it never requests camera.

[UAP's project account of We Live in an Ocean of Air](https://www.uapcompany.com/projects/we-live-in-an-ocean-of-air)
provided an experiential reference: reveal an invisible natural process through
participation. Cloudia borrows that product principle, not imagery or branding.
[Ultraleap design principles](https://docs.ultraleap.com/xr-guidelines/Getting%20started/design-principles.html)
advise feedback for tracking limits and comfortable interactions. Its XR
hardware guidance is design evidence, not webcam tracking accuracy evidence.

## Proposed hand vocabulary — not an approved or working recognizer

Prefer a visible mode selection plus continuous manipulation over six unrelated
magic poses. Manual weather state/events already share main/worker transport.
`applyAtmosphereIntent` handles scene/rain; `applyWeatherImpulse` handles short
forcing. A future adapter translates tracking into these intents.

| Weather | Proposed action | Type / guard |
| --- | --- | --- |
| Sun / sunset | Pinch the displayed sun handle, raise/lower it | Continuous elevation with capture/release; feedback arc; low elevation selects sunset after dwell |
| Rain | Select rain, then lower an open downward-facing palm | Continuous intensity relative to calibrated comfortable range; no need to hold forever |
| Storm | Select the storm target by dwell + pinch release | Discrete, deliberate scene change; not inferred from ordinary hand closure |
| Lightning | Close the hand once while storm mode is armed | Discrete rising edge, 900 ms cooldown and open-hand rearm |
| Wind | Open palm moves sideways while wind tool is selected | Continuous signed velocity, dead zone and low-pass filter; release settles to manual value |
| Disperse / condense | Separate / bring together two open hands | Relative separation, clutch after 300 ms stable capture; one-hand slider alternative |

Proposed initial parameters, to tune with users: enter confidence .8 sustained
150 ms; release below .6 or loss for 200 ms; freeze held value then disengage
within 500 ms. No impulse on reacquisition. Gesture ambiguity resolves to no
new discrete event. Use normalized palm dimensions rather than pixel distances;
mirror preview and clearly distinguish physical left/right. Seated use, elbows
near torso, small comfortable movements; never require sustained raised arms.

Camera onboarding later: explicit start, local preview, lighting/framing help,
calibration, immediate Stop that stops every media track, permission-denied and
no-device states, fallback always visible. Intended on-device inference, no
frame upload; verify the actual pipeline before making that privacy promise in
product copy. [Google Hand Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
warns that detectForVideo is synchronous: run inference independently in a
worker, at most one frame in flight, discard stale results, close ImageBitmaps.
Do not import the old legacy gesture mapping as an approved design.

## Occupied-work diagnostic method

`?profile=1&ablation=...` exposes explicit probes. Full mode is the product.
Density mode retains traversal, flow, detail, erosion, alpha and early exits,
but replaces illumination with a constant. Cache mode additionally reads cached
optical depth and emits its raw channels. No-flow and no-detail alter density
and early exits, so differences are workload sensitivity, not isolated component
costs. No-flash retains lighting except channel/glow evaluation; compare only
with the same held flash preview. Uniform branches may affect compilation and
register pressure. These costs are not additive nor shader-line timestamps.
All raw reports record the mode; no probe is an optimization shipped as quality.

## Qualification

Pending final rendered comparisons and raw samples. See handoff for completed
results, viewport evidence and residual limitations.

### Measured occupied-work probes

Apple/Metal-3, in-app browser; worker, 1920×1080 internal/output, 256³/128³,
384 nominal steps, continuous submission, one active renderer. Fixed probes
use the new explicit reference action: cloud time60, forcing time0, paused,
wind55%, camera0/0, neutral sky, rain0, left light. Paused still renders and
executes the flow compute pass; it freezes evolution rather than the GPU.
Warmup2s, each30s sample completed without build/test/screenshots. All raw files
have prefix `docs/benchmarks/2026-10-13-product-`.

| Probe / raw suffix | GPU mean ms | rAF fps | >33.34 ms |
| --- | ---: | ---: | ---: |
| full-fixed-30s | 14.302 | 59.932 | 1 |
| density-fixed-30s | 14.359 | 59.960 | 0 |
| cache-fixed-30s | 14.188 | 59.998 | 0 |
| no-flow-fixed-30s | 12.751 | 59.996 | 0 |
| no-detail-fixed-30s | 10.589 | 59.960 | 1 |
| flash-full-fixed-30s | 14.775 | 59.994 | 0 |
| flash-omitted-fixed-30s | 12.629 | 59.960 | 1 |
| specialized-full-fixed-30s | 10.996 | 59.930 | 1 |

The first seven use uniform-controlled probes (v17). Illumination/cache
omission did not establish savings. The no-flow/no-detail reductions suggest
sensitivity to density sampling; their changed early exits prohibit treating
the differences as exact component timings. Held-flash vs omitted flash suggests
a glow/channel cost, but the omitted sample being faster than the earlier
unlit baseline also exposes host/order variability. Do not subtract all rows.

v18 compiles each probe into a separate shader. Full mode has compile-time
constants, allowing diagnostic branches to disappear; the complete density,
lighting and traversal remain. The fixed comparison improved14.30→11.00ms,
but is one ordered comparison, not randomized causal proof. Main and worker
actually compiled; switching density→full was visually inspected. Reference
screenshots before/after specialization are retained.

### Rejected recurrence trial (v19)

A mathematical recurrence replaced each occupied sample's aerial exponential
with a step multiplier, including a separate empty-step multiplier. A float32
numerical test bounded drift below4e-5 over1024 mixed steps. It did not produce
a consistent measured advantage: fixed30s GPU15.099ms versus v18's10.996;
animated90s GPU13.208ms versus v18's14.772. Host/time and animated occupancy vary.
The simpler direct exponential was restored. The discarded trial's30s/90s raw
JSON and screenshot remain labeled v19; final renderer is **observatory-v18**.
No quality was reduced to secure a timing result.

### Sustained worker result

`v18-worker-mature-90s.json`: 59.936 fps, max36.6ms,4 intervals>33.34ms,
GPU14.772ms mean. This is not as clean as the previous office v16 run and is not
called perfect60. The changed morphology, per-sample aerial perspective, sky
transition infrastructure and host conditions prevent attributing the difference
to a single feature. Rain0/auto-lightning off in this mature sample.
After rejecting v19, the worker rebuilt to `render.worker-Cwe6b9-C.js`, the same
asset used by the v18 sustained sample. A later cleanup removes an unnecessary
material reconfiguration when selecting a family; the tested integrator is unchanged.

### Atmosphere refinement

The first low-sun trials were excessively green/yellow. Approximate Chappuis
absorption was added to both view and solar paths, using the ozone layer/coefficients
from [Hillaire 2020](https://doi.org/10.1111/cgf.14050) (RGB0.650,1.881,0.085 ×10⁻³ km⁻¹,
triangular layer10–40km). The author's36MB PDF exceeded the web text tool's limit;
the indexed paper table was available. This is a small independent addition,
not an implementation or claim of Hillaire's multiple-scattering model.
Ground fill follows low-sun colour. Cloud shadow directions still remain fixed.

### Responsive and family evidence

Desktop1280×720 and mobile390×844 were inspected in the internal browser.
The mobile manual/hand guide/current panels stay within the viewport; measured
scrollWidth=clientWidth390. A stacking overlap in the hand guide was fixed.
All panes retain manual access and can close with Escape. Screenshots include
sheared1571198069, congestus1902626172 and multicell230780749. New-form kept the
old scene visible while generating and switched to the next family. Cap
attachment is thicker/less uniform; thin strands and a shelf-like silhouette
remain visible at some angles. This is an improvement study, not photo-realistic
acceptance. The isolated specimen still lacks environmental scale cues.

### Main-thread mixed scenario, 90 seconds

`v18-main-growth-storm-orbit-90s.json`:59.978fps, max37.5ms,1 interval>33.34ms,
GPU11.365ms mean. Growth starts near0s, automatic orbit enabled, storm scene,
rain≈.3,6 flashes by the end, output/internal1920×1080/384. The sky transition
at start was .354 and settles during warmup. This intentionally measures a mixed
formation→mature weather scenario, not an isolated mature comparison with worker.
Audio remained disabled; no acoustic acceptance is claimed. All samples measure
rAF submission and GPU passes, never compositor presentation.
