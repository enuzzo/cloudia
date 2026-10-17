# Optical loader / Engine ownership review — cycle 40

**Result: PASS for the inspected source-level integration.** No new ownership, cancellation or cache-dependency defect was identified in the paths below. This is a read-only review; it does not certify runtime GPU behaviour, image quality, frame equality, geometry identity, physical memory or FPS.

Source root: `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle36/optical-source/`.

| Inspected file | SHA-256 |
| --- | --- |
| `src/cumulonimbus/GPUSceneEngine.ts` | `4cb0dab62b209dc8412033ec7d321370d890c0dfbf21731eebb2426166a6326a` |
| `src/cumulonimbus/lifecycle.test.ts` | `c1b3ace394c2a53901fc043d6f4eddc199ec00b3c5f9eab1de7ecaa6ec9f84ba` |
| `src/cumulonimbus/terrainOptical.ts` | `e3bfc4994d8ab80a8de1bc9b61b63ca6580ce103a705b531b395de6661848370` |
| `src/cumulonimbus/terrainOptical.test.ts` | `e20b67d6cefb740840750879ed206b12f0f6e9c8b7c650de0c984d47c7049043` |
| `src/cumulonimbus/terrainMesh.ts` | `00c170a8d4653817720b9dddc8eb10d647671128602dac55a1de52fe55216d72` |

The two loader files match the prepared helper copies byte for byte by SHA. The loader pins the offline pack to `217325bcdb50dd58076b2f5068ee0b5ba524f6f076a70d4345f279f233f5dd62` and the fixed 33,554,432-byte size.

## Ownership and cancellation

1. **Only candidate B loads the optical asset.** `terrainOpticalEnabled` is readonly and set in the constructor to `profile === '1' && optical === '1'` (Engine line 217). There is no control that changes the experiment during this owner. A skips the loader branch entirely (270–274), retains two material-texture cache inputs, and supplies no optical shader bindings (333–342). This verifies the integration gate; the separate immutable shader tests and native baseline recovery remain root's evidence.
2. **Asset failure is explicit and precedes cloud generation.** The loader await occurs after DEM/cover preparation and before `loadVolume()` (269–275). Authentication, structure, body or fetch failures reach `start()`'s catch, which emits the failure and awaits `releaseGPU()` (294–298). No replacement palette is created. The already-created cover textures are disposed by the cleanup path.
3. **Late success is handled locally.** Immediately after the loader await, the Engine checks `destroyed || deviceLost || releasingGPU`; a late owner is disposed and never assigned (271–273). With the real loader, abort is also checked after response/read/digest, so these Engine guards remain necessary protection against a late or non-cooperative implementation, as represented by the mock test.
4. **Teardown aborts first and disposes owned textures once.** `releaseGPU()` aborts the shared terrain AbortController before its cleanup waits (957–960). The cleanup promise is memoized with `??=`. After pending audit/benchmark/init/queue/frame work, it disposes the terrain raster, then cover and optical owners, and nulls their fields (964–972). Disposing the raster first removes its texture-disposal listeners before the optical resource is disposed. The loader owner itself also makes `dispose()` idempotent.
5. **Stale asynchronous completion does not reattach resources in the inspected paths.** `destroy()` sets `destroyed` before calling cleanup (976–979). Device loss sets `deviceLost` before invoking cleanup (241–252). Both flags are checked after optical load and after volume load. If teardown begins while a successful optical owner is waiting for cloud generation, the assigned owner is reached by the same cleanup; if it begins while optical data is pending, the local late-result branch disposes that result. A rejected load following destroy/device loss returns from the catch, while cleanup has already been requested by the initiating lifecycle path.

The review found no new stale-resource race in these transitions. It does not assume cancellation can interrupt `crypto.subtle.digest` itself; the real loader waits for digest completion and checks abort before any texture is created.

## Cache dependency and repeated frames

The Engine's `cacheInputs` closure includes both WorldCover textures and, when assigned, the exact optical `DataTexture` object (341). Its shader binding uses that same texture (338–342). The static optical asset is not replaced by the per-frame code and the loader is called only from startup. No Engine code updates its `needsUpdate` each frame.

`TerrainMesh.readCacheKey()` tracks declared shade textures and passes each through `rasterTextureState()` (454–478). The fingerprint includes texture/source/image identity, texture and source versions, dimensions, format/type/colour space, filters, wrapping, mip generation and mip array, flip/premultiply/unpack settings, and texture transforms (331–338). Texture disposal invalidates the colour cache (440–447). This is sufficient source-level declaration for the candidate's new sampler under the existing immutable-data ownership contract. Raw buffer writes without versioning still require explicit invalidation; this candidate introduces no such writes after decode.

## Added test coverage read, not executed here

The appended four lifecycle tests (880–917) use the existing isolated renderer/terrain mocks. They exercise:

- canonical A: no optical load and exactly two material texture dependencies;
- authentication failure: visible failure before cloud worker, terrain or render allocation, followed by renderer disposal;
- pending optical load followed by destroy: AbortSignal set and a deliberately late mock owner disposed without terrain/cloud allocation;
- candidate B: third texture dependency is the same optical texture, startup loads once, repeated mocked frames do not increase its version, and repeated destroy calls dispose the owner once.

Two transitions are not covered by these added tests explicitly: `optical=1` without `profile=1`, and device loss while optical loading is pending. Their source paths are guarded as described above; the destroy test alone is not runtime proof of the device-loss branch. The mock frames also do not prove a cache hit or a GPU upload count.

No test, model builder, browser or GPU operation was run for this review. Root's integrated checks and native evidence remain authoritative. The separately documented unqualified geometry unit run was not repeated or reinterpreted.
