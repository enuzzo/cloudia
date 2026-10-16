from pathlib import Path

root=Path(__file__).resolve().parent
out=root/'refine-source'
engine=out/'src/cumulonimbus/GPUSceneEngine.ts'
s=engine.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)
replace("import {TerrainMesh,type TerrainSampler} from './terrainMesh';","import {TerrainMesh,type TerrainSampler,type TerrainMeshRefinement} from './terrainMesh';")
replace("const RENDERER_VERSION='observatory-v58-terrain-shadow-cache';","const RENDERER_VERSION='experiment-v58-source-node-refinement';")
replace('  private terrainSample:TerrainSampler=terrainSurfaceSample;','  private terrainSample:TerrainSampler=terrainSurfaceSample;\n  private terrainRefinement:TerrainMeshRefinement|undefined;')
old='      this.terrainSample=createDemTerrainSampler(measuredTerrain,terrainSurfaceSample);'
replace(old,old+'''
      this.terrainRefinement={
        sourceGrid:{minXKm:measuredTerrain.minX,minZKm:measuredTerrain.minZ,spacingKm:measuredTerrain.spacingKm,columns:measuredTerrain.side,rows:measuredTerrain.side},
        domain:{minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48},maxErrorKm:.005,
        limits:{maxProbeCount:600000,maxVertices:1000000,maxTriangles:2000000,maxGeometryBytes:64*1024*1024},
      };''')
old="    if(!this.terrainCover)throw new Error('Copertura del suolo non preparata');"
replace(old,old+"\n    if(!this.terrainRefinement)throw new Error('Rilievo per la geometria non preparato');")
replace("new TerrainMesh({cellsPerSide:256,levels:9,normalMode:'geometry',sample:this.terrainSample,shade:","new TerrainMesh({cellsPerSide:256,levels:9,normalMode:'geometry',sample:this.terrainSample,refinement:this.terrainRefinement,shade:")
replace('this.terrainSample=terrainSurfaceSample;this.terrainCover?.dispose();','this.terrainSample=terrainSurfaceSample;this.terrainRefinement=undefined;this.terrainCover?.dispose();')
engine.write_text(s)

test=out/'src/cumulonimbus/lifecycle.test.ts'
s=test.read_text()
replace('observatory-v58-terrain-shadow-cache','experiment-v58-source-node-refinement')
old="      expect(terrain.configuration.sample).toEqual(expect.any(Function));expect(terrain.configuration.shade).toEqual(expect.any(Function));"
replace(old,old+'''
      // The mocked source uses a different lattice from the shipped DEM. The
      // refinement adapter must pass the loaded metadata, not a 125m constant.
      expect(terrain.configuration.refinement?.sourceGrid).toEqual({minXKm:-64,minZKm:-64,spacingKm:64,columns:3,rows:3});
      expect(terrain.configuration.refinement?.maxErrorKm).toBe(.005);
      expect(terrain.configuration.refinement?.domain).toEqual({minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48});''')
test.write_text(s)
print('Engine/test integration source prepared; no runtime invoked.')
