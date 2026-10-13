# Dedicated cloud repositories: morphology and storm motion

Research date: 2026-10-13. Scope: source/README inspection and meteorological references; no repository cloned, external code imported, dependency added, example executed, browser GPU opened, or performance measured. Links to `main`/`master` describe inspected source, not immutable releases; authors' performance statements are not Cloudia evidence.

## Recommendation

Retain Cloudia's Three.js 0.186.0/WebGPU pipeline, 256³ macro density/light volume, 128³ detail texture, 384-step quality target and 16³ analytic flow. Improve the authored cloud anatomy and the relationship between movement and local disappearance. A wider population of uneven convective turrets, an attached but spreading ice cap, spatially separate rising/sinking regions and bounded shear are more useful here than replacing the renderer with CFD or temporal reconstruction.

The recommendations below are proposed adaptations, not claims that another repository contains a complete meteorologically accurate thunderstorm.

## Four focused repositories

| Repository | Verified technology and useful reference | Scope and transfer limit |
| --- | --- | --- |
| [joshbrew/webgpu_realtime_clouds](https://github.com/joshbrew/webgpu_realtime_clouds) | JavaScript + WebGPU/WGSL; shape/detail/weather inputs, compute raymarching, cached fields and temporal resolve | Strong source for anatomy and macro/detail separation; its full pipeline is substantially broader than Cloudia needs |
| [jeantimex/procedural-clouds](https://github.com/jeantimex/procedural-clouds) | WebGPU density compute + fragment raymarch; interpolated density caches | Useful altitude/coverage controls; evolving 4D noise is not a convective velocity solver |
| [frmlinn/clouds-sim](https://github.com/frmlinn/clouds-sim) | Vanilla JavaScript/WebGL2; baked noise, shadow pass and TAA | Useful erosion decomposition; whole-column shadow texture is less expressive than Cloudia's internal 3D optical depth |
| [RowanCrsHws/PI-CloudSim](https://github.com/RowanCrsHws/PI-CloudSim) | C++17/OpenGL compute; cloud thermodynamics and Eulerian fluid simulation described by its author | Causal reference for formation/dissipation; not a drop-in browser implementation or validated severe-storm model |

### joshbrew: protect the body and separate cloud anatomy

The [README](https://raw.githubusercontent.com/joshbrew/webgpu_realtime_clouds/main/README.md) identifies separate weather, shape and detail inputs and temporal reprojection. Those resources explain its breadth; they do not require Cloudia to adopt its integration or reconstruction stages.

In [cloudCommon.wgsl](https://raw.githubusercontent.com/joshbrew/webgpu_realtime_clouds/main/tools/clouds/shaders/cloudCommon.wgsl), `anvilShapePos` uses distinct neck, spread and flatten masks. The lower footprint is protected while the upper cap spreads. `verticalScaledDomainPos` also explicitly avoids stretching world-space noise into stacked vertical slices. These are directly relevant to the narrow-column complaint: shape the volume before increasing texture detail.

In [cloudFields.wgsl](https://raw.githubusercontent.com/joshbrew/webgpu_realtime_clouds/main/tools/clouds/shaders/cloudFields.wgsl), `roundedCloudBody` separates fine density, macro density and signed form. Stable cell identity governs a population of differing clouds; interior support limits the damage caused by fine erosion. This supports irregular turret sizes and spacing with erosion concentrated near boundaries. The [anvil preset](https://raw.githubusercontent.com/joshbrew/webgpu_realtime_clouds/main/tools/clouds/weather/cloudAnvilLook.js) is authored anatomy, not a prediction of ice microphysics. No inspected path establishes precipitation-driven downdrafts or electrical charge evolution.

Cost transfer: perform morphology work during volume generation, and retain the existing light bake. Adopting its entire weather/reprojection system would add resources and maintenance unrelated to this correction.

### jeantimex: altitude masks and multiple density scales

The [README](https://raw.githubusercontent.com/jeantimex/procedural-clouds/main/README.md) documents two `rgba16float` density textures, configurable update frequency and interpolation between caches. The [cloud shader](https://raw.githubusercontent.com/jeantimex/procedural-clouds/main/shaders/cloud.wgsl) combines altitude masks with macro and medium 4D Voronoi layers, then applies an upper cutoff. Time is a noise coordinate, so apparent evolution does not establish transport by updrafts/downdrafts. Its optional nested `lightMarch` adds density samples for each occupied view step. Cloudia already avoids that multiplication with cached optical depth.

Transfer: vary coverage/height at the macro level; use a continuous altitude transition between liquid billows and ice fibers. Do not port its blue background constants into the requested neutral storm view, or introduce periodic full density-cache regeneration merely to animate detail.

### frmlinn: distinct shape/detail motion, with a lighting caveat

The [README](https://raw.githubusercontent.com/frmlinn/clouds-sim/main/README.md) documents CPU-baked inverted Worley/fBM, AABB-limited raymarching, an orthographic shadow pass and temporal accumulation. It acknowledges clipping and history smearing. In [cloud.frag](https://raw.githubusercontent.com/frmlinn/clouds-sim/main/src/shaders/cloud.frag), macro and detail have separate wind offsets; height/edge fades define support and altitude changes erosion strength. This is a useful decomposition, but both wind offsets are horizontal translations rather than storm circulation.

Inspecting [shadow.frag](https://raw.githubusercontent.com/frmlinn/clouds-sim/main/src/shaders/shadow.frag) reveals an important bound: it stores integrated density across the full light-ray interval, not depth-resolved optical depth to every interior sample. The README's description of knowing exactly how much cloud precedes a sample is therefore too strong. Preserve Cloudia's internal light cache rather than replacing it with that 2D map. No lightning or anvil thermodynamics is established in these inspected shaders.

### PI-CloudSim: genuine thermodynamic simulation, used as a reference

The [repository README](https://raw.githubusercontent.com/RowanCrsHws/PI-CloudSim/master/README.md) identifies an implementation based on Harris et al. and requires C++17, GLEW, SDL2 and OpenImageIO. The [author's explanation](https://rowanch.com/blog/2023-07-12-rendering-and-simulating-clouds-in-opengl-shaders.html) describes Eulerian velocity and water-vapor/condensed-water/temperature fields: advection, curl, buoyancy and vorticity confinement, phase changes, divergence, iterative pressure solve and pressure-gradient correction. Multiple compute dispatches and pressure iterations explain why this is a different cost class from Cloudia's compact analytic flow. Code quality is explicitly qualified by the author; runtime stability and storm fidelity were not tested here.

Transfer the causal distinction: visible condensed water can disappear through evaporation while air continues moving. An animated displacement alone cannot reproduce that. Use independent local thinning/renewal signals; do not claim simulated humidity, buoyancy or precipitation. No verified ice-anvil or lightning subsystem was found in the inspected material.

## Meteorological anchors

| Primary source | Supported observation | Consequence for the authored scene |
| --- | --- | --- |
| [NWS Flagstaff: Severe Weather](https://www.weather.gov/fgz/SevereWeather) | Mature storms develop a spreading top and downdraft; vertical shear can tilt the updraft and separate it from descending air | Distinct rising and sinking regions should overlap in time, with different centers and height profiles |
| [NWS glossary: Anvil](https://forecast.weather.gov/glossary.php?word=anvil) | The top spreads, usually downwind; the typical fibrous appearance differs from a strongly cumuliform anvil | Preserve a thicker attachment near the tower; use elongated finer strands farther along outflow |
| [NWS Amarillo: Microbursts](https://www.weather.gov/ama/microbursts) | Dry-air entrainment, evaporative cooling and precipitation loading can contribute to descending air | Treat downdraft as a separate process; it is not simply every turret running backward |
| [NWS training glossary: Entrainment](https://training.weather.gov/wdtd/courses/rac/documentation/RAC-glossary.pdf) | Environmental air mixes into a current; inhomogeneous mixing can evaporate droplets at interfaces | Local erosion near cloud margins is more defensible than uniform whole-volume fading |
| [NOAA/NSSL: Lightning Types](https://www.nssl.noaa.gov/education/svrwx101/lightning/types/) and [NWS: Types of Flashes](https://www.weather.gov/safety/lightning-science-types-flashes) | Intracloud discharge can illuminate a cloud as sheet lightning; visible ground flashes involve leaders and return strokes | A diffuse internal flash is credible without a visible bolt, but its lit region should vary spatially and through a brief pulse sequence |

These are qualitative structure references. Cloudia's units and accelerated animation are not calibrated wind speeds, storm dimensions or a forecast. Descending air need not remain visible as a dense descending cloud.

## Concrete adaptations to the current architecture

The following are engineering proposals inferred from the sources and local `volume.ts`, `motion.ts`, `cloudShader.ts`, `light.ts`, `atmosphere.ts` and `storm.ts`. They have not been performance-qualified by this research task.

| Priority | Proposed change | Cost/bound to preserve |
| --- | --- | --- |
| P1 | Generate a broad connected rain/base region with several asymmetric turrets, unequal summits and lateral offsets. Vary anatomy independently from texture seed | Worker-generation work; keep 256³ volume and light generation together |
| P1 | Author separate compact rising cores and offset sinking lobes. Let base outflow spread horizontally, while the upper cap follows the upper wind | Evaluate in the existing 16³ flow pass; keep displacement strictly inside the occupancy expansion |
| P1 | Use a smooth height-dependent inverse shear shared by macro density, detail and light coordinates | A few arithmetic operations per sample; update conservative support for the added displacement |
| P1 | Add localized lifetime/edge thinning, with different phases from the rising cores and a persistent replenished interior | Use flow alpha for a bounded erosion signal; avoid full density rebuilds per frame |
| P1 | Keep a readable proximal ice cap, then stretch detail along the chosen outflow direction and reduce material density toward its distal edge | Reuse existing detail channels; do not pay for extra noise octaves inside every ray step |
| P1 | Make the requested storm sky a neutral overcast radiance blend and derive cloud ambient fill from the same blend | LUT/uniform work; luminance reduction alone preserves a blue chromaticity |
| P2 | Vary the internal flash source/branch locations per event, use short irregular pulses and retain view transmittance attenuation | Reuse the current in-volume source; bounded few sources, no nested shadow march |

### Bounds and known weaknesses

1. **The current flow is displacement, not integrated velocity.** Smooth lobes can communicate circulation, but translating noise or pulsing a deformation does not conserve mass or moisture. Keep UI/documentation explicit about an authored convective approximation.
2. **16³ resolves broad motion only.** For the current 10 × 8.5 × 7 domain, a voxel is roughly 0.625 × 0.531 × 0.438 units. Keep circulation supports several cells wide; tiny vortices belong in detail coordinates. Adding narrower analytic lobes can alias without improving apparent physics.
3. **Inverse shear changes support.** If sampling `q.x = p.x - s(p.y)`, rendered material extends along `+s(y)`. Include its maximum displacement in the conservative occupied region and world bounds. Sampling the old mask before the shear can incorrectly skip newly occupied rays.
4. **Co-deformed lighting is approximate.** Sampling cached optical depth with the same material coordinates prevents obvious texture/light sliding. Nonrigid shear still changes the true light paths, and local erosion removes material without automatically clearing downstream optical depth. Keep dispersion partial and broad; inspect overdark residual shadows before increasing it. Do not describe the cache as physically exact during deformation.
5. **Fibers need an attachment, not only transparency.** Extremely low ice material density can make the anvil disappear; a thin stretched slab can read like a veil. Preserve a thicker near-tower shoulder, gradual taper and broken longitudinal structures. Avoid raising opacity across the entire cap to compensate.
6. **A neutral sky is a scene choice.** Clear air outside a storm can remain blue. The requested view should represent overcast surroundings; neutralize both background and ambient illumination consistently, with a smooth horizon. Copying a cloud demo's blue sky is not evidence of storm realism.
7. **Lightning glow can resemble a stationary lamp.** At starting checkpoint55405f5, the inspected local shader approximated an internal channel with two glow centers. Seeded spatial variation, a local-to-diffuse progression and short pulse envelopes can improve credibility without constructing a visible geometric bolt. Its far-field halo should remain subordinate to illuminated cloud structure.

## Guerrilla/Nubis: appropriate scale of influence

[Nubis³, Guerrilla, 2023](https://www.guerrilla-games.com/read/nubis-cubed) describes voxel cloud modeling, fluid-based authoring, compressed signed-distance acceleration, density up-resolution and cloud-specific lighting approximations. It supports Cloudia's existing separation of a macro volume, fine material detail and accelerated lighting. It does not establish that a fluid solver must run every browser frame. The earlier [Nubis overview, 2018](https://www.guerrilla-games.com/read/nubis-realtime-volumetric-cloudscapes-in-a-nutshell) provides the broader procedural context.

Use the modeling principles now. Consider distance-field acceleration only if later profiling identifies empty-space traversal as the dominant cost and the existing occupancy mask is insufficient. No performance figure from Guerrilla or another author is transferable to this browser/device configuration.

## License and provenance notes

| Reference | Inspected license evidence | Decision for this work |
| --- | --- | --- |
| joshbrew | [Root MIT license](https://raw.githubusercontent.com/joshbrew/webgpu_realtime_clouds/main/LICENSE), copyright Joshua Brewster | Study techniques; no source/asset import. Any later reuse must preserve applicable notices and inspect companion-code provenance |
| jeantimex | [Root MIT license](https://raw.githubusercontent.com/jeantimex/procedural-clouds/main/LICENSE), copyright Su; [noise.wgsl](https://raw.githubusercontent.com/jeantimex/procedural-clouds/main/shaders/noise.wgsl) explicitly identifies a port based on Blender GPU sources | Root license does not settle the provenance of every derived shader. Independently implement concepts; inspect original notices before any future copying |
| frmlinn | [Root MIT license](https://raw.githubusercontent.com/frmlinn/clouds-sim/main/LICENSE), copyright frmlinn | Study decomposition; no source, texture or dependency import |
| PI-CloudSim | README discusses authorship; [THIRD-PARTY-LICENCES](https://raw.githubusercontent.com/RowanCrsHws/PI-CloudSim/master/THIRD-PARTY-LICENCES) contains ImGui's MIT notice. A project-wide reuse grant for its own simulation code was not established | Reference-only. Do not mistake an embedded dependency license for a license covering the entire project |
| Guerrilla | Public presentation/publication; no code-reuse license established | Cite technical ideas; do not redistribute its assets or assume its implementation is open source |

## Review evidence to collect during implementation

- Compare several fixed seeds at identical camera, growth time, quality and sun side; confirm both silhouette variation and preserved mature-storm anatomy.
- Observe formation, mature circulation and partial dissolution over time. Require simultaneously visible upward and downward cues in different regions, rather than only a single frame that resembles a storm.
- Inspect the cap from side and oblique views: readable attachment, distal fibers, no horizontal seam, no clipped support and no repeating vertical texture slices.
- Compare no-flash, flash-onset, pulse peak and decay with camera/exposure fixed. A diffuse intracloud result can pass without a visible bolt; a global blue screen flash cannot demonstrate internal illumination.
- Keep these visual checks separate from the renderer's bounded performance qualification. This research document certifies neither owner visual approval nor sustained 60 FPS.


## Implementation follow-through

The morphology session applied independent authored anatomy for three families, connected replenished necks, local rising/sinking displacement, inverse shear, bounded dispersal, neutral sky/ambient and a seeded bent/branched internal flash source. Source parity and lifecycle tests pass; actual browser comparisons and the retained performance cost are recorded in [MORPHOLOGY-2026-10-13.md](MORPHOLOGY-2026-10-13.md). These outcomes do not promote the procedural model into CFD, validate electrical physics or transfer external performance claims.
