import {loadTerrainMeshAsset} from './terrainMeshAsset';
/** GLO30 heights, canonical GLO90-derived coast, same authored outer transition. */
export const MEASURED_TERRAIN_MESH_ID='copernicus-glo30-62_5m-legacy-coast-static-v1';
export const TERRAIN_MESH_ASSET_SHA256='59fc118c9676fffd2b96ac1d52ed04cc5fe4a34bf06e1e1c3069562b3690a831';
export function loadMeasuredTerrainMesh(signal?:AbortSignal){
 return loadTerrainMeshAsset(new URL('./assets/liguria-apuane-glo30-mesh.bin',import.meta.url).href,TERRAIN_MESH_ASSET_SHA256,signal);
}
