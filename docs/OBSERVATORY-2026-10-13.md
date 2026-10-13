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
