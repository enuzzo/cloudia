# Cumulonimbus dynamics — next visual pass

12 October 2026. Owner requests internal and external motion before gestures, alongside photographic anvil structure. Research only in this checkpoint: renderer and accepted seed remain unchanged.

## Physical observations and scope

1. **Rising pulses and growing turrets.** Deep convection can contain successive ascending thermals rather than a steady uniform plume. Idealized simulations show that humidity and cloud width affect whether convection forms a thermal chain, an isolated thermal or a more continuous plume. Use asynchronous growth episodes as a visual reference, not a universal rule for every cumulonimbus. Source: [Peters et al., Thermal Chains and Entrainment, Part II, 2020](https://journals.ametsoc.org/view/journals/atsc/77/11/JAS-D-19-0244.1.xml). This is atmospheric research, not a rendering implementation.
2. **Edges form and dissolve.** Mixing with environmental air changes condensation and evaporation at cloud boundaries. The visible cloud boundary marks changing condensed water; it is not a fixed skin to wobble. Source: [NCAR visualization of entrainment and mixing](https://visualizations.ucar.edu/visualizations/entrainment-and-mixing-phenomena-at-cloud-edges/). The page describes a numerical simulation and contains a video reference; no claim of frame-by-frame video analysis in this pass.
3. **Vertical growth becomes lateral outflow.** A stable upper atmosphere limits ascent and the upper cloud spreads into an anvil. Upper winds influence downstream asymmetry. Sources: [NASA cumulonimbus over Africa](https://science.nasa.gov/resource/cumulonimbus-cloud-over-africa/), [NWS anvil glossary](https://forecast.weather.gov/glossary.php?word=Anvil). Photos support morphology; they do not establish animation speed.
4. **Different stages and regions behave differently.** Developing storms are dominated by updrafts; mature storms also develop downdrafts. Vertical wind shear can separate those currents. Source: [NWS thunderstorm lifecycle](https://www.weather.gov/fgz/SevereWeather). Do not add universal whole-cloud rotation: a rotating supercell is a separate scenario.
5. **Softness is regional.** The WMO definition includes smooth, fibrous or striated upper regions above dense vertical towers. The target is readable fibrous structure with appropriate transparency, not uniformly hard edges. Source: [WMO International Cloud Atlas, Cumulonimbus](https://cloudatlas.wmo.int/en/cumulonimbus-cb.html).

## Current implementation, verified in source

`CumulonimbusApp.frame` varies one small sinusoidal drift shared by the entire volume. Shader coordinates subtract that drift from both density and fine detail; the seeded morphology and detail fields are otherwise static. Orbit changes the observer. Neither represents growing convective turrets or moving internal structure.

Baseline is optical-detail-v5, commit a8f22d4: 256³ macro/light, 128³ detail, Massima 384 steps. Full HD with both fixed-camera lights and CSS-sized window with orbit measured 59.98 RAF fps for 90 seconds without intervals over 33.34 ms. Native 2515×2099 is not a stable-60 configuration. See [performance record](PERFORMANCE-2026-10-11.md).

## Candidate visual directions for the next turn

These are authored rendering proposals inferred from the observations, not established physical simulations or measured performance claims.

| Region | Intended visible behavior | Acceptance check |
|---|---|---|
| Convective body | Local lobes rise, swell and roll outward in unequal episodes | Silhouette actually changes; motion has upward direction and persistent features |
| Boundary | Small curls thin and dissolve while new cloudy patches appear | No uniform breathing, boiling shimmer or abrupt noise replacement |
| Anvil | Outflow stretches laterally, with fine strands flowing at a different speed from the body | Continuous tower-to-anvil transition; fibres do not become flat sheets |
| Whole cloud | Modest wind translation separate from local evolution | Drift does not substitute for internal motion |

Begin with one mature, central cloud and bounded activity. Real development occurs over meteorological timescales; an accelerated demonstration must be distinguishable from the calmer default. Speeds are not yet calibrated from timed observations. Before coding, compare an actual timed development sequence and identify its recording/time-compression information; do not infer physical velocity from an unlabelled timelapse. The [NWS field guide](https://www.weather.gov/media/bis/Weather_Spotter_Field_Guide.pdf) provides a lifecycle photo sequence as a starting reference.

## Rendering constraints to resolve before acceptance

- Moving only fine noise through a static envelope will not deliver growing external turrets. Prototype actual silhouette change as well as internal detail.
- Changing density invalidates static sun/sky optical-depth caches. A deformation must keep density, illumination and support registered; independently advected noise with unchanged lighting is an approximation requiring explicit visual checks. Larger growth needs updated or phased matching density/light data.
- New displacement must fit a newly proven conservative occupancy margin. The present 0.04-world-unit accelerated empty-stride bound only applies to the current deformation envelope.
- Avoid regenerating 256³ density and all light caches every frame. Evaluate bounded deformation and incremental/phased updates against their memory, preparation and per-frame cost before selecting a method. No fluid solver is assumed necessary or assumed affordable.
- Keep elapsed-time motion independent of display FPS; preserve pause/reset, deterministic seed, hidden-tab handling and teardown.
- Validate fixed-camera silhouette and internal feature trajectories over multiple timestamps, both light directions and orbit. An animated noise counter does not prove convective motion.
- Repeat 90-second Full HD and default-window measurements after the final visual candidate, including max/p95/p99 and long intervals. Preserve slow runs. Target remains 60 fps on this host; no 120-fps or native-DPR guarantee.

Next priority: photographic anvil morphology **and** convective motion together. Gestures remain queued after visual/performance acceptance. No renderer change, deployment, camera permission or new FPS certification in this research pass.
