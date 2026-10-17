# Root outline, conditional on scalar PASS

No implementation or scalar run yet. Sole proposed geometry: core±48 at actualDEM125m, fixedSW→NEdiagonal. Keep originalv61outer beyondC=Math.fround(94*.512), including its existinggreenvertices. Root preservescanonical; any code will be external until numeric/native/cost gates.

Implementation placement: optional source-patch configuration in buildTerrainMeshData, after original refinement and before final geometric-normal accumulation. OFF path must retain current arrays/statistics exactly. New stats must name core/outer/seam and actual source sample work; do not label combined geometry as the original one-passrefinement. No shader, material, asset, cloudvolume or newGPUdraw/pass.

Use typed oldID→newID mapping and original-cell triangle traversal to retain outer triangles, preserve their XYZ/surface bytes and winding, remap per-cellfirst/count for outerlookup. C is an existingring4gridline: retainedtriangles cannot cross it; assert any unexpectedcrossing. Collect boundaryvertices/edges only on the four planes±C, sort each side and verify consecutiveedgecoverage, includinggreenmidpoints. Boundouter231512V/460496T.

Append exact125mcorevertices from the same sampler and F32position conversion, with2triangles percell, no fan/pivot/heightnoise. Corelookup can compute its contiguous2faceoffset arithmetically; no need to allocate a591k-cell table just for regularcore.

Seam: four trapezoid strips joining correspondinginner±48/outer±C corners; clockwiseXZ chains followactualboundaryvertices. A deterministic zipper merges monotone normalizedsideparameters, usingexistingvertices only. Sharedcorners/diagonalradialsideboundaries weldadjacentstrips. No newseamvertex, Tjunction orzero/reversedface. A compact staticper-side parameterbin→face list can supportCPUqueries; each face covers only a boundedhandfulof125m-equivalentbins. This is a possible implementation, not an extra algorithm to tune afterresults.

terrainMeshHitAt must route core/seam/outer to actualindices and preserve maximum-height boundaryhandling. Do not returnnullinsidepatch or let Enginecamera fallback toauthoredlandscape. Recalculate shared geometricnormals once after completeassembly. Outerfarpositions/surface/triangles shouldstayexact; normals incidenttoseam canchange, so no blanketshadingidentityclaim.

Tests mustexercise realistic failure risks on small nonflatfixtures: allvertices/indicesfinite, winding/unitnormals; edgeincidence/orientation and noTjunction alongbothboundaries/corners; actualtriangle brute-force heightoracle vs routedlookup on/offseams and boundaries; optionOFFexact; hardbudgetoverflow beforeoutput; invalidconfiguration rejects. FullactualDEM mesh/model numericgate follows tests before anyGPU. RuntimeCPUmemory needrealmeasurement; theoreticalpayload bound46.069MB is not RSSorcostevidence.
