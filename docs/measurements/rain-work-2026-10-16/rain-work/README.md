# Rain-work CPU counter

All files in this directory are external diagnostic artifacts. Product sources
and GPU/browser are untouched. Read RAIN-WORK-REVIEW.md before interpreting counts.

To repeat counts from the saved arrays, run from this directory:

```sh
bun count-work.ts 16 9
bun count-work.ts 32 18
```

Do not rerun prepare-data.ts: its one full generation is complete. It refuses an
existing manifest/started marker. The counter itself never calls generateVolume;
it verifies cache hashes and model-source hashes before sampling. Source drift
requires review, not automatic rebaking. No installation or lockfile is needed.

Data format: macro256³RGBA8, detail128³RGBA8, sunset256³RG8, rain64²RG8, flow16³
RGBA16F little-endian. X is fastest, then Y, then Z for3D; flow channels are xyz
material displacement plus erosion. All cache files and original parameters
are listed in data/manifest.json; native dependency/runtime sources remain in
the project. Source snapshots preserve the bytes whose hashes were recorded.

Results are sampled CPU reference-work counts, not hardware counters, rendered
pixels or FPS estimates. Calls are counted at shader-source semantic grouping:
one RGB/RG/GBA textureSampleLevel remains one call despite separate CPU channel
reads. Root-confirmed rainTime0 is explicitly reconstructed, not present in the
historical report. Per-ray termination and all scoped differences are in JSON.
