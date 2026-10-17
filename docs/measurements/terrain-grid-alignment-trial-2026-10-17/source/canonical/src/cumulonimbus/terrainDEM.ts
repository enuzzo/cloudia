import type {TerrainSurfaceSample} from './terrainSurface';

export const TERRAIN_DEM_ID='copernicus-glo90-liguria-apuane-v1';
export interface TerrainDem {
 readonly side:number;readonly spacingKm:number;readonly minX:number;readonly minZ:number;
 readonly heights:Uint16Array;readonly coast:Int16Array;
}
/** CDM1: 32-byte LE header, then u16 elevations in 0.125m and i16 coast
 * distances in 8m. Coast distance is a material mask, not bathymetry.
 */
export function decodeTerrainDem(buffer:ArrayBuffer):TerrainDem{
 if(buffer.byteLength<32)throw new Error('Rilievo incompleto: intestazione mancante');
 const view=new DataView(buffer);
 if(view.getUint32(0,true)!==0x314d4443)throw new Error('Formato del rilievo non riconosciuto');
 const side=view.getUint32(4,true),spacingKm=view.getFloat64(8,true),minX=view.getFloat64(16,true),minZ=view.getFloat64(24,true);
 if(side<3||side>4097||side%2!==1||![spacingKm,minX,minZ].every(Number.isFinite)||spacingKm<=0||buffer.byteLength!==32+side*side*4)throw new Error('Dimensioni del rilievo non valide');
 const count=side*side,heights=new Uint16Array(count),coast=new Int16Array(count);
 for(let i=0;i<count;i++){
  const height=view.getUint16(32+i*2,true);
  if(height*.000125>3.31)throw new Error('Il rilievo supera il limite verticale della scena');
  heights[i]=height;coast[i]=view.getInt16(32+count*2+i*2,true);
 }
 return {side,spacingKm,minX,minZ,heights,coast};
}

/** Bilinear measured elevation and its exact within-cell gradient. No added
 * ridge noise or vertical exaggeration. Derivatives can jump at cell edges.
 */
export function sampleTerrainDem(grid:TerrainDem,x:number,z:number):TerrainSurfaceSample|null{
 const qx=(x-grid.minX)/grid.spacingKm,qz=(z-grid.minZ)/grid.spacingKm,last=grid.side-1;
 if(!Number.isFinite(qx)||!Number.isFinite(qz)||qx<0||qz<0||qx>last||qz>last)return null;
 const ix=Math.min(last-1,Math.floor(qx)),iz=Math.min(last-1,Math.floor(qz)),u=qx-ix,v=qz-iz,a=iz*grid.side+ix;
 const bilinear=(values:Uint16Array|Int16Array)=>{
  const p=values[a],q=values[a+1],r=values[a+grid.side],s=values[a+grid.side+1];
  return (p+(q-p)*u)*(1-v)+(r+(s-r)*u)*v;
 };
 const h=grid.heights,p=h[a],q=h[a+1],r=h[a+grid.side],s=h[a+grid.side+1],scale=.000125;
 return {heightKm:bilinear(h)*scale,slopeX:((q-p)*(1-v)+(s-r)*v)*scale/grid.spacingKm,
  slopeZ:((r-p)*(1-u)+(s-q)*u)*scale/grid.spacingKm,coastKm:bilinear(grid.coast)*.008};
}

/** Measured central square and an explicitly authored outer transition.
 * The derivative includes the blend derivative, so shading follows the same
 * height field. The transition is not represented as measured geography.
 */
export function createDemTerrainSampler(grid:TerrainDem,fallback:(x:number,z:number)=>TerrainSurfaceSample,innerKm=48,outerKm=64){
 if(!(innerKm>=0&&outerKm>innerKm)||grid.minX> -outerKm||grid.minZ> -outerKm||grid.minX+(grid.side-1)*grid.spacingKm<outerKm||grid.minZ+(grid.side-1)*grid.spacingKm<outerKm)throw new Error('Il rilievo non copre il raccordo della scena');
 return (x:number,z:number):TerrainSurfaceSample=>{
  const ax=Math.abs(x),az=Math.abs(z),radius=Math.max(ax,az);
  if(radius>=outerKm)return fallback(x,z);
  const measured=sampleTerrainDem(grid,x,z);
  if(!measured)throw new Error('Campione del rilievo fuori copertura');
  if(radius<=innerKm)return measured;
  const authored=fallback(x,z),span=outerKm-innerKm;
  const tx=Math.max(0,(ax-innerKm)/span),tz=Math.max(0,(az-innerKm)/span);
  const wx=1-tx*tx*(3-2*tx),wz=1-tz*tz*(3-2*tz),weight=wx*wz;
  // Separable smooth weights avoid artificial diagonal normal creases from
  // differentiating a max(abs(x),abs(z)) square radius.
  const dx=-6*tx*(1-tx)*Math.sign(x)/span*wz,dz=-6*tz*(1-tz)*Math.sign(z)/span*wx;
  return {heightKm:authored.heightKm*(1-weight)+measured.heightKm*weight,
   slopeX:authored.slopeX*(1-weight)+measured.slopeX*weight+(measured.heightKm-authored.heightKm)*dx,
   slopeZ:authored.slopeZ*(1-weight)+measured.slopeZ*weight+(measured.heightKm-authored.heightKm)*dz,
   coastKm:authored.coastKm*(1-weight)+measured.coastKm*weight};
 };
}

export async function loadTerrainDem(signal?:AbortSignal):Promise<TerrainDem>{
 const response=await fetch(new URL('./assets/liguria-apuane-dem.bin',import.meta.url),{signal});
 if(!response.ok)throw new Error(`Rilievo non disponibile (${response.status})`);
 return decodeTerrainDem(await response.arrayBuffer());
}
