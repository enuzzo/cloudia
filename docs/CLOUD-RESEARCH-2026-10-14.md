# Cloud generators — source study and demo trials

14 October 2026. Follow-up to [the initial survey](CLOUD-REPOS-2026-10-13.md). Public repositories and author documentation, not marketing images treated as measurements. Third-party code was read from pinned commits in a temporary folder; no dependency or shader was copied into Cloudia. Commercial assets were not purchased, installed or reverse engineered.

## What is established, recent, or commercial?

| Reference | Evidence inspected | Useful direction for Cloudia | Boundary |
|---|---|---|---|
| [Takram three-geospatial](https://github.com/takram-design-engineering/three-geospatial) | MIT; ~1.7k stars at lookup. Source plus running Minimal Setup and Custom Layers stories | Layer-dependent cloud density and erosion; coherent atmosphere, horizon and cloud scale | README says cloud WebGPU migration is still in progress; not a drop-in replacement |
| [Sebastian Lague — Clouds](https://github.com/SebLague/Clouds) | MIT; ~966 stars at lookup; Unity shader source | Protect the dense cloud interior while eroding its edges; inspect light absorption separately | Established educational implementation, not a new browser engine |
| [joshbrew — webgpu_realtime_clouds](https://github.com/joshbrew/webgpu_realtime_clouds) | MIT; ~3 stars, recent activity; WGSL source | Separate broad lighting structure from fine density, and filter noise according to voxel footprint | Recent does not imply widely adopted or visually superior |
| [jeantimex — procedural-clouds](https://github.com/jeantimex/procedural-clouds) | MIT; ~7 stars; browser demo tried, parameter edited | Useful interactive comparison of density/coverage/cache controls | Demo default observed at 48 ray steps, 4 light steps, cache96; not equivalent to Cloudia's maximum-quality configuration |
| [Ultra Dynamic Sky](https://www.ultradynamicsky.com/) | Author's [9.7 documentation](https://www.ultradynamicsky.com/Documentation/V9/9-7) | A coherent time/weather control updates the whole environment; timed transitions are first-class | Commercial Unreal system; public docs only, no source-code or local runtime evaluation |
| [Bproduction CloudScapes V2](https://superhivemarket.com/products/cloudscapes/docs) | Vendor documentation and [author presentation](https://www.youtube.com/watch?v=SxPwJ1aT-ZA) | Reference for the shape variety achievable with authored VDB volumes | Blender volume library; not evidence that a browser can reproduce those renders at runtime |
| [Guerrilla Nubis³](https://www.guerrilla-games.com/read/nubis-cubed) | Author publication on voxel clouds and flight through clouds | Near-cloud quality needs a volume representation suited to close inspection | Production research, not an available MIT engine or a recent browser demo |

Star counts are a dated popularity snapshot, not quality measurements. I cannot identify with certainty which commercial project the user had in mind.

## Source findings with reproducible anchors

### Takram — density and temporal reconstruction

Pinned revision `b012ad06d858fc035d88aacfd73f092f93c994e4`.
[clouds.glsl](https://github.com/takram-design-engineering/three-geospatial/blob/b012ad06d858fc035d88aacfd73f092f93c994e4/packages/clouds/src/shaders/clouds.glsl) combines weather coverage, layer height profiles, base shape and finer erosion. The erosion character changes with height. Sampling detail is conditional on the projected mip level.
[cloudsResolve.frag](https://github.com/takram-design-engineering/three-geospatial/blob/b012ad06d858fc035d88aacfd73f092f93c994e4/packages/clouds/src/shaders/cloudsResolve.frag) contains both temporal antialiasing and an optional 4×4 Bayer temporal upscale. It reprojects history with velocity and clips history against local variation. This is a different image reconstruction contract from Cloudia's full-output mode. We should not silently adopt it or infer comparable GPU cost from the demo.

### Sebastian Lague — avoid eroding away the body

Pinned revision `fcc997c40d36c7bedf95a294cd2136b8c5127009`.
[Clouds.shader](https://github.com/SebLague/Clouds/blob/fcc997c40d36c7bedf95a294cd2136b8c5127009/Assets/Scripts/Clouds/Shaders/Clouds.shader): `sampleDensity` evaluates detail only inside positive base density; the erosion weight grows toward thinner parts. `lightmarch` integrates density toward the sun and applies exponential transmittance. The phase function blends forward/backward Henyey–Greenstein lobes. Its adjustable darkness floor is an artistic control, not proof of multiple-scattering accuracy.

### Joshbrew — preserve broad light structure and resolved noise

Pinned revision `23585ae3cef15d6a05ae739aebee3137d6251d3e`.
[cloudFields.wgsl](https://github.com/joshbrew/webgpu_realtime_clouds/blob/23585ae3cef15d6a05ae739aebee3137d6251d3e/tools/clouds/shaders/cloudFields.wgsl): density generation separates fine and macro density and an unsaturated surface field. `buildCloudDensityField` computes shape/detail LOD from grid spacing, texture dimensions and scale. Tall volumes use less vertical compression than thin layers. This is relevant to avoiding stripes and noisy lighting in a cumulonimbus; directly copying the numeric factors would be unjustified because Cloudia uses different units and density construction.

## Actual demo observations

- Takram: opened its public Storybook, rendered **Clouds / Minimal Setup**, then **Clouds / Custom Layers**. The first view showed a coherent distant cloud deck under a sun and atmospheric horizon; the second showed distinct layers and an authoring panel. This is qualitative evidence at one viewpoint, not close-fly-through acceptance or a benchmark.
- Jeantimex: opened the [public demo](https://jeantimex.github.io/procedural-clouds/), changed coverage from **0.8 to 0.5**, and confirmed the displayed value and changed cloud pattern. In this view, the finite box boundary and soft volume remain visible. Its FPS overlay is not a controlled comparison and is not used as evidence for Cloudia performance.
- Evidence: `images/ui-2026-10-14/takram-reference.png`, `jeantimex-reference.png`. Screenshots identify third-party references, not Cloudia output. They retain the authors' rights and are included for comparison/critique.
- Linear's [redesign article](https://linear.app/now/how-we-redesigned-the-linear-ui) and expanded UI image were examined: quiet surfaces, alignment, restrained selection color and consistent control hierarchy inform the UI changes. Spline/Raycast public pages were additional contextual references, not copied component libraries.

## Prioritized experiments — proposals, not already implemented

1. **Close-up detail carrier:** compare an additional local detail volume / procedural erosion against the current near sampling, using the same frozen seed and matched camera path. Reject crawling edges, repeating grains and loss of large billows. Retain native output.
2. **Macro light vs fine density:** run side-by-side frozen frames separating broad optical depth from fine breakup. Check backlighting and dense cores; reject extra brightness that flattens the cloud. No new universal coefficient without images.
3. **Landscape integration:** connect haze, cloud-base height and a soft terrain shadow. Validate morning/low sun, coastal horizon and grazing views; preserve forest, mountains and sea only.
4. **Rain shape:** inspect source columns and optical depth against dense base patches; vary curtain thickness and evaporation along wind. Reject visible planes, repetitive stripes and disconnected rain sources.
5. **Consistent transitions:** measure first sky change as well as cached transitions; blend environment state coherently and support interruption without jumping back to an obsolete request.
6. **Optional temporal experiment:** a separate diagnostic prototype only, with camera-motion/ghosting tests and an explicit quality contract. It is not part of this UI patch.

The useful next step is a small, measured renderer experiment after the new UI passes actual browser QA. This session changes controls and documentation; it does not claim an improvement in cloud photorealism.
