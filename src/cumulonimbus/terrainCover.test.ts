import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeTerrainCover,terrainCoverWeights,type TerrainCover} from './terrainCover';
function fixture():TerrainCover{
 const fractions=new Uint8Array(48);fractions[1]=255;fractions[12+4]=255;fractions[24+5]=255;fractions[36+6]=255;
 return {side:2,spacingKm:2,minX:-2,minZ:-2,fractions};
}
function encode(g:TerrainCover){
 const b=new ArrayBuffer(32+g.fractions.length),v=new DataView(b);v.setUint32(0,0x31564357,true);v.setUint32(4,g.side,true);v.setFloat64(8,g.spacingKm,true);v.setFloat64(16,g.minX,true);v.setFloat64(24,g.minZ,true);new Uint8Array(b,32).set(g.fractions);return b;
}
describe('measured land-cover material weights',()=>{
 it('ships the audited area fractions at the independently checked geographic cell centres',()=>{
  const bytes=readFileSync('src/cumulonimbus/assets/liguria-apuane-cover.bin');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('e7fa38f2b0a8c3c469737410dc8d265e680071226e663b3cb12b23930ebda5fc');
  const grid=decodeTerrainCover(Uint8Array.from(bytes).buffer);
  expect([grid.side,grid.spacingKm,grid.minX,grid.minZ]).toEqual([1024,.125,-64,-64]);
  // Scalar source-pixel overlap witnesses, with south-to-north rows and
  // east-to-west columns. This also catches the DEM-node/cover-cell offset.
  const witnesses=[
   [619,983,[0,128,8,119,0,0,0,0,0,0,0,0]],
   [230,936,[0,1,0,126,128,0,0,0,0,0,0,0]],
   [131,522,[0,113,0,1,0,127,0,0,14,0,0,0]],
   [382,541,[0,0,0,128,0,0,127,0,0,0,0,0]],
   [601,597,[0,0,0,0,0,126,0,0,128,1,0,0]],
  ] as const;
  for(const [x,z,expected] of witnesses){
   expect(Array.from(grid.fractions.subarray((z*grid.side+x)*12,(z*grid.side+x+1)*12))).toEqual(expected);
  }
  expect(Array.from(terrainCoverWeights(grid,13.4375,58.9375))).toEqual([0,128/255,127/255,0,0,0,0,0]);
  expect(terrainCoverWeights(grid,11.1875,10.6875)[7]).toBeCloseTo(128/255,15);
 });
 it('preserves twelve area classes and rejects incomplete or nonconservative cells',()=>{
  const g=fixture();expect(decodeTerrainCover(encode(g))).toEqual(g);
  expect(()=>decodeTerrainCover(new ArrayBuffer(12))).toThrow();
  const corrupt=encode(g);new Uint8Array(corrupt)[33]=254;expect(()=>decodeTerrainCover(corrupt)).toThrow();
  expect(()=>decodeTerrainCover(encode(g).slice(0,-1))).toThrow();
 });
 it('places categorical cell means at cell centres and interpolates fractions, keeping crops/built/bare distinct',()=>{
  const g=fixture();expect(Array.from(terrainCoverWeights(g,-1,-1))).toEqual([0,1,0,0,0,0,0,0]);
  expect(Array.from(terrainCoverWeights(g,1,-1))).toEqual([0,0,0,1,0,0,0,0]);
  expect(Array.from(terrainCoverWeights(g,-1,1))).toEqual([0,0,0,0,1,0,0,0]);
  expect(Array.from(terrainCoverWeights(g,1,1))).toEqual([0,0,0,0,0,1,0,0]);
  expect(Array.from(terrainCoverWeights(g,0,0))).toEqual([0,.25,0,.25,.25,.25,0,0]);
  expect(Array.from(terrainCoverWeights(g,-2,-2))).toEqual([0,1,0,0,0,0,0,0]);
  expect(Array.from(terrainCoverWeights(g,2,2))).toEqual([0,0,0,0,0,1,0,0]);
  expect(Array.from(terrainCoverWeights(g,2.01,0))).toEqual([1,0,0,0,0,0,0,0]);
 });
});
