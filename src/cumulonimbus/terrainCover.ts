/** ESA WorldCover class-area fractions. They describe classified map area,
 * not physical canopy density, naturalness, geology or current season.
 */
export const TERRAIN_COVER_ID='esa-worldcover-2021-area-fractions-v1';
export const TERRAIN_COVER_CLASSES=[0,10,20,30,40,50,60,70,80,90,95,100] as const;
export interface TerrainCover {readonly side:number;readonly spacingKm:number;readonly minX:number;readonly minZ:number;readonly fractions:Uint8Array}
/** Rendering groups: unknown, trees, low vegetation, crops, built, bare,
 * snow, water. Original twelve classes remain separate in the source asset.
 */
export const TERRAIN_COVER_GROUP=[0,1,2,2,3,4,5,6,7,2,1,2] as const;

/** WCV1: 32-byte LE header, then twelve u8 fractions per CELL (sum255).
 * minX/minZ are cell edges; contrast with the DEM's inclusive node centres.
 */
export function decodeTerrainCover(buffer:ArrayBuffer):TerrainCover{
 if(buffer.byteLength<32)throw new Error('Copertura del suolo incompleta');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x31564357)throw new Error('Formato della copertura del suolo non riconosciuto');
 const side=view.getUint32(4,true),spacingKm=view.getFloat64(8,true),minX=view.getFloat64(16,true),minZ=view.getFloat64(24,true);
 if(side<2||side>4096||![spacingKm,minX,minZ].every(Number.isFinite)||spacingKm<=0||buffer.byteLength!==32+side*side*12)throw new Error('Dimensioni della copertura del suolo non valide');
 const fractions=new Uint8Array(buffer,32);
 for(let i=0;i<fractions.length;i+=12){let sum=0;for(let c=0;c<12;c++)sum+=fractions[i+c];if(sum!==255)throw new Error('Frazioni della copertura del suolo non valide');}
 return {side,spacingKm,minX,minZ,fractions};
}

/** Bilinear interpolation of fractions at cell centres, never of class IDs.
 * The outer half-cell uses its measured cell's mean; no periodic repetition.
 */
export function terrainCoverWeights(grid:TerrainCover,x:number,z:number,target:Float64Array=new Float64Array(8)):Float64Array{
 target.fill(0);
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<grid.minX||z<grid.minZ||x>grid.minX+grid.side*grid.spacingKm||z>grid.minZ+grid.side*grid.spacingKm){target[0]=1;return target;}
 const last=grid.side-1,qx=Math.max(0,Math.min(last,(x-grid.minX)/grid.spacingKm-.5)),qz=Math.max(0,Math.min(last,(z-grid.minZ)/grid.spacingKm-.5));
 const ix=Math.min(last-1,Math.floor(qx)),iz=Math.min(last-1,Math.floor(qz)),u=qx-ix,v=qz-iz;
 for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
  const index=((iz+dz)*grid.side+ix+dx)*12,weight=(dx?u:1-u)*(dz?v:1-v)/255;
  for(let c=0;c<12;c++)target[TERRAIN_COVER_GROUP[c]]+=grid.fractions[index+c]*weight;
 }
 return target;
}

export async function loadTerrainCover(signal?:AbortSignal):Promise<TerrainCover>{
 const response=await fetch(new URL('./assets/liguria-apuane-cover.bin',import.meta.url),{signal});
 if(!response.ok)throw new Error(`Copertura del suolo non disponibile (${response.status})`);
 return decodeTerrainCover(await response.arrayBuffer());
}
