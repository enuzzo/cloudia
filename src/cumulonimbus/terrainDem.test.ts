import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeTerrainDem,sampleTerrainDem,createDemTerrainSampler,type TerrainDem} from './terrainDem';
const fixture=():TerrainDem=>({side:3,spacingKm:2,minX:-2,minZ:-2,
 heights:new Uint16Array([0,4000,8000,8000,12000,16000,16000,20000,24000]),coast:new Int16Array([-2,-1,0,-1,0,1,0,1,2])});
const encode=(g:TerrainDem)=>{
 const b=new ArrayBuffer(32+g.side*g.side*4),v=new DataView(b);v.setUint32(0,0x314d4443,true);v.setUint32(4,g.side,true);
 v.setFloat64(8,g.spacingKm,true);v.setFloat64(16,g.minX,true);v.setFloat64(24,g.minZ,true);
 g.heights.forEach((x,i)=>v.setUint16(32+i*2,x,true));g.coast.forEach((x,i)=>v.setInt16(32+g.heights.length*2+i*2,x,true));return b;
};
describe('measured terrain data',()=>{
 it('ships the audited 125m Liguria/Apuane grid with correct geographic axes and metre scale',()=>{
  const bytes=readFileSync('src/cumulonimbus/assets/liguria-apuane-dem.bin');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d');
  const grid=decodeTerrainDem(Uint8Array.from(bytes).buffer);
  expect([grid.side,grid.spacingKm,grid.minX,grid.minZ]).toEqual([1025,.125,-64,-64]);
  // Independent source-mosaic audits: NW is inland, SW is sea; origin is
  // 44N10E offshore. Values are quantised measured elevations, not generated.
  expect(sampleTerrainDem(grid,-64,-64)?.heightKm).toBeCloseTo(.11375,12);
  expect(sampleTerrainDem(grid,64,-64)?.heightKm).toBe(0);
  expect(sampleTerrainDem(grid,-64,64)?.heightKm).toBeCloseTo(.0905,12);
  expect(sampleTerrainDem(grid,64,64)?.heightKm).toBeCloseTo(1.33925,12);
  expect(sampleTerrainDem(grid,0,0)).toMatchObject({heightKm:0,coastKm:-4.304});
  let maximum=0,oceanNodes=0,nonzeroOceanNodes=0;
  for(let i=0;i<grid.heights.length;i++){
   maximum=Math.max(maximum,grid.heights[i]*.000125);
   if(grid.coast[i]<0){oceanNodes++;if(grid.heights[i]!==0)nonzeroOceanNodes++;}
  }
  expect(maximum).toBeCloseTo(2.14675,12);expect(oceanNodes).toBe(434561);expect(nonzeroOceanNodes).toBe(0);
 });
 it('preserves signed coast and exact fixed-point metre units',()=>{
  const g=fixture(),decoded=decodeTerrainDem(encode(g));expect(decoded).toEqual(g);
  expect(sampleTerrainDem(decoded,0,0)).toEqual({heightKm:1.5,slopeX:.25,slopeZ:.5,coastKm:0});
  expect(sampleTerrainDem(decoded,2,2)?.heightKm).toBe(3);
 });
 it('reconstructs a known plane and its gradient including last row and column',()=>{
  const g=fixture();for(const x of [-2,-1.7,0,.6,2])for(const z of [-2,-.8,0,1.7,2]){
   const s=sampleTerrainDem(g,x,z)!;expect(s.heightKm).toBeCloseTo(1.5+x*.25+z*.5,15);
   expect(s.slopeX).toBeCloseTo(.25,15);expect(s.slopeZ).toBeCloseTo(.5,15);
  }
  expect(sampleTerrainDem(g,2.00001,0)).toBeNull();expect(sampleTerrainDem(g,NaN,0)).toBeNull();
 });
 it('rejects corrupted payloads and elevations outside the scene contract',()=>{
  expect(()=>decodeTerrainDem(new ArrayBuffer(12))).toThrow();
  const b=encode(fixture());new DataView(b).setUint32(0,7,true);expect(()=>decodeTerrainDem(b)).toThrow();
  expect(()=>decodeTerrainDem(encode(fixture()).slice(0,-1))).toThrow();
  const high=fixture();high.heights[0]=30000;expect(()=>decodeTerrainDem(encode(high))).toThrow();
 });
 it('uses measured centre, exact authored exterior and differentiates the transition',()=>{
  const g=fixture(),fallback=(x:number,z:number)=>({heightKm:.4+.02*x+.03*z,slopeX:.02,slopeZ:.03,coastKm:7});
  const sample=createDemTerrainSampler(g,fallback,1,2);
  expect(sample(0,0)).toEqual(sampleTerrainDem(g,0,0));expect(sample(2,0)).toEqual(fallback(2,0));
  for(const [x,z] of [[1.5,.2],[-1.4,.1],[.2,1.6],[.1,-1.3],[1.5,1.5],[-1.5,-1.5]]){
   const h=.000001,s=sample(x,z);expect(s.slopeX).toBeCloseTo((sample(x+h,z).heightKm-sample(x-h,z).heightKm)/(2*h),7);
   expect(s.slopeZ).toBeCloseTo((sample(x,z+h).heightKm-sample(x,z-h).heightKm)/(2*h),7);
  }
  for(const r of [1,2])expect(Math.abs(sample(r-1e-7,0).heightKm-sample(r+1e-7,0).heightKm)).toBeLessThan(1e-7);
  expect(()=>createDemTerrainSampler(g,fallback,1,3)).toThrow();
 });
});
