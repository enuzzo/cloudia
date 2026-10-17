# Terrain raster cache — external candidate

Only terrainMesh.ts and new terrainRasterCache.test.ts were written in cache-source. Frozen hashes in FREEZE.json. Root owns Engine/App/markup/lifecycle and every execution. No test, typecheck, build, GPU, browser, model, dependency installation or Git operation was run here.

cacheInputs is explicit opt-in; no descriptor remains live. Its values must be finite and cover every mutable shading uniform; textures list includes each mutable shader texture. The key snapshots input values, texture objects/versions/configuration, actual frame/camera, renderer/backend/reverse state, viewport/scissor, target attachments, mesh/geometry attributes/index/material/transforms, and post-update shadow state. Exact Object.is equality; no epsilon. Raw source-array/unversioned node writes need invalidate; arbitrary callbacks/scenes are not introspected. Static scene/exclusive target ownership remains required.

Shadow update precedes the colour key. Versioned caster/index/position or tracked world changes invalidate shadow first. invalidate() conservatively invalidates both colour and shadow for backend resets/external writes; invalidateGeometry() also drops the previous caster fingerprint. Call it after recomputing owned bounds in place for raw caster/world changes. Shadow bounds still belong to the static owned geometry; arbitrary replacement scenes/material graphs are outside the contract.

Clear/draw/restore errors discard the entry; commit requires stable post-draw input snapshots and a valid shadow. Only first successful binding version increments of the owned colour/depth attachments may be committed; later version mutations during drawing cannot. Resize/dispose/attachment or descriptor texture disposal invalidate; old listeners are removed on replacement and final disposal. Cover textures are borrowed, never disposed by TerrainMesh.

No GPU payload, WGSL, material formula, mesh construction, camera formula or target precision changed. The existing target remains RGBA32F + depth32, nearest loads. CPU snapshots/allocations are not free and require A/B/A plus camera-motion measurement. A real first bind may update extra attachment metadata beyond versions; that conservatively prevents the first commit and draws again, rather than assuming equivalence.

Tests are small fake-renderer/real-small-mesh contracts: opt-in/live fallback, ambient mutation at unchanged Sun, frame/resource/config keys, caster-before-shadow ordering, first-bind versus later version changes, errors during clear/draw/restore, mutations during draw, disposal/listener ownership and invalid input. They are written but unexecuted here.

Static text checks preserve the exact original configureTerrainCamera function, fragmentNode assignment, and complete makeTarget factory. These checks do not prove compiled shader/native parity. See the patch for complete review.
