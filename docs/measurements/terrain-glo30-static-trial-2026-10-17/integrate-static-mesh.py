from pathlib import Path
r=Path(__file__).resolve().parent/'candidate-source';s=r/'src/cumulonimbus'
def replace(p,old,new):
 text=p.read_text();assert text.count(old)==1,(p.name,old[:100],text.count(old));p.write_text(text.replace(old,new))
p=s/'terrainMesh.ts'
replace(p,'export interface TerrainMeshConfiguration extends TerrainMeshOptions {\n','export interface TerrainMeshConfiguration extends TerrainMeshOptions {\n /** Prevalidated, exclusively owned static arrays. Cannot be combined with builder inputs. */\n data?:TerrainMeshData;\n')
replace(p,'  const data=buildTerrainMeshData(configuration.sample,configuration);this.data=data;this.geometryStats=data.stats;',"  if(configuration.data&&[configuration.sample,configuration.refinement,configuration.cellsPerSide,configuration.levels,configuration.spacingKm,configuration.normalMode].some(v=>v!==undefined))throw new RangeError('Static terrain data cannot be combined with builder inputs');\n  const data=configuration.data??buildTerrainMeshData(configuration.sample,configuration);this.data=data;this.geometryStats=data.stats;")
p=s/'GPUSceneEngine.ts'
replace(p,"import {TerrainMesh,type TerrainSampler,type TerrainMeshRefinement} from './terrainMesh';","import {TerrainMesh,type TerrainMeshData} from './terrainMesh';")
replace(p,"import {loadTerrainDem,createDemTerrainSampler,TERRAIN_DEM_ID} from './terrainDem';","import {loadMeasuredTerrainMesh,MEASURED_TERRAIN_MESH_ID,TERRAIN_MESH_ASSET_SHA256} from './measuredTerrainMesh';")
replace(p,"const RENDERER_VERSION='observatory-v60-terrain-raster-cache';","const RENDERER_VERSION='experiment-v60-glo30-static-mesh';")
replace(p,'  private terrainSample:TerrainSampler=terrainSurfaceSample;\n  private terrainRefinement:TerrainMeshRefinement|undefined;','  private terrainMeshData:TerrainMeshData|undefined;')
replace(p,'const [measuredTerrain,measuredCover]=await Promise.all([loadTerrainDem(this.terrainRequest.signal),loadTerrainCover(this.terrainRequest.signal)]);','const [measuredTerrain,measuredCover]=await Promise.all([loadMeasuredTerrainMesh(this.terrainRequest.signal),loadTerrainCover(this.terrainRequest.signal)]);')
old='''      this.terrainSample=createDemTerrainSampler(measuredTerrain,terrainSurfaceSample);
      this.terrainRefinement={
        sourceGrid:{minXKm:measuredTerrain.minX,minZKm:measuredTerrain.minZ,spacingKm:measuredTerrain.spacingKm,columns:measuredTerrain.side,rows:measuredTerrain.side},
        domain:{minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48},maxErrorKm:.005,
        limits:{maxProbeCount:600000,maxVertices:1000000,maxTriangles:2000000,maxGeometryBytes:64*1024*1024},
      };'''
replace(p,old,'      this.terrainMeshData=measuredTerrain;')
replace(p,"    if(!this.terrainRefinement)throw new Error('Rilievo per la geometria non preparato');","    if(!this.terrainMeshData)throw new Error('Rilievo statico per la geometria non preparato');")
replace(p,"this.terrainRaster=new TerrainMesh({cellsPerSide:256,levels:9,normalMode:'geometry',sample:this.terrainSample,refinement:this.terrainRefinement,","this.terrainRaster=new TerrainMesh({data:this.terrainMeshData,")
text=p.read_text().replace('TERRAIN_DEM_ID','MEASURED_TERRAIN_MESH_ID')
assert text.count("dataset:'Copernicus GLO-90 DSM'")==1
text=text.replace("terrainGeography:{dataset:'Copernicus GLO-90 DSM',originDegrees:[44,10],axisX:'west',axisZ:'north',gridSpacingKm:.125,measuredSquareHalfWidthKm:48,authoredBlendOuterKm:64,verticalExaggeration:1}","terrainGeography:{dataset:'Copernicus GLO-30 DSM, AWS COG2021',coast:'Canonical GLO90-derived125m continuous sampler at build vertices; rendered interpolation depends on new triangles',originDegrees:[44,10],axisX:'west',axisZ:'north',gridSpacingKm:.0625,measuredSquareHalfWidthKm:48,authoredBlendOuterKm:64,verticalExaggeration:1,construction:'Offline one source-node-selected red/green pass; prevalidated static bundle, no model build in owner',meshAssetSHA256:TERRAIN_MESH_ASSET_SHA256}")
assert 'this.terrainSample=terrainSurfaceSample;this.terrainRefinement=undefined;' in text
text=text.replace('this.terrainSample=terrainSurfaceSample;this.terrainRefinement=undefined;','this.terrainMeshData=undefined;')
p.write_text(text)
# Root will replace the SHA only after encode validates the preflight arrays; no build/GPU with placeholder.
(s/'measuredTerrainMesh.ts').write_text("""import {loadTerrainMeshAsset} from './terrainMeshAsset';
/** GLO30 heights, canonical GLO90-derived coast, same authored outer transition. */
export const MEASURED_TERRAIN_MESH_ID='copernicus-glo30-62_5m-legacy-coast-static-v1';
export const TERRAIN_MESH_ASSET_SHA256='PENDING_ROOT_ENCODE';
export function loadMeasuredTerrainMesh(signal?:AbortSignal){
 return loadTerrainMeshAsset(new URL('./assets/liguria-apuane-glo30-mesh.bin',import.meta.url),TERRAIN_MESH_ASSET_SHA256,signal);
}
""")
p=s/'lifecycle.test.ts'
text=p.read_text();old="""vi.mock('./terrainDem',async()=>{
 const actual=await vi.importActual<typeof import('./terrainDem')>('./terrainDem');
 return {...actual,loadTerrainDem:vi.fn(async()=>({side:3,spacingKm:64,minX:-64,minZ:-64,heights:new Uint16Array(9),coast:new Int16Array(9)}))};
});""";assert old in text
text=text.replace(old,"""vi.mock('./measuredTerrainMesh',async()=>{
 const actual=await vi.importActual<typeof import('./measuredTerrainMesh')>('./measuredTerrainMesh');
 const {buildTerrainMeshData}=await vi.importActual<typeof import('./terrainMesh')>('./terrainMesh');
 return {...actual,loadMeasuredTerrainMesh:vi.fn(async()=>buildTerrainMeshData(()=>({heightKm:0,slopeX:0,slopeZ:0,coastKm:0}),{cellsPerSide:4,levels:1,normalMode:'geometry'}))};
});""")
text=text.replace("import {loadTerrainDem,type TerrainDem} from './terrainDem';","import {loadMeasuredTerrainMesh} from './measuredTerrainMesh';\nimport type {TerrainMeshData} from './terrainMesh';")
text=text.replace('loadTerrainDem','loadMeasuredTerrainMesh').replace('value:TerrainDem','value:TerrainMeshData')
text=text.replace("finish({side:3,spacingKm:64,minX:-64,minZ:-64,heights:new Uint16Array(9),coast:new Int16Array(9)});await starting;","finish({} as TerrainMeshData);await starting; // Teardown must reject before dereferencing the late result.")
old="""      // refinement adapter must pass the loaded metadata, not a 125m constant.
      expect(terrain.configuration.refinement?.sourceGrid).toEqual({minXKm:-64,minZKm:-64,spacingKm:64,columns:3,rows:3});
      expect(terrain.configuration.refinement?.maxErrorKm).toBe(.005);
      expect(terrain.configuration.refinement?.domain).toEqual({minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48});"""
# Preserve the exact surrounding comment if its line differs.
if old not in text:
 start=text.index('      // refinement adapter');end=text.index('\n',text.index("expect(terrain.configuration.refinement?.domain)",start));old=text[start:end]
text=text.replace(old,"""      expect(terrain.configuration.data).toBe(await vi.mocked(loadMeasuredTerrainMesh).mock.results.at(-1)!.value);
      expect(terrain.configuration.refinement).toBeUndefined();expect(terrain.configuration.sample).toBeUndefined();
      expect(terrain.configuration.cellsPerSide).toBeUndefined();""")
text=text.replace('observatory-v60-terrain-raster-cache','experiment-v60-glo30-static-mesh')
p.write_text(text)
print('External candidate integration prepared; helper, binary and SHA still pending, no product edit.')
