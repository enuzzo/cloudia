import {describe,expect,it,vi} from 'vitest';
import {ClampToEdgeWrapping,LinearFilter,LinearMipmapLinearFilter,NoColorSpace,RGBAFormat,UnsignedByteType} from 'three/webgpu';
import type {TerrainCover} from './terrainCover';
import {createTerrainCoverTextures} from './terrainCoverTextures';

function grid(side=2):TerrainCover{
 const fractions=new Uint8Array(side*side*12);
 for(let i=0;i<side*side;i++)fractions[i*12]=255;
 return {side,spacingKm:.125,minX:-64,minZ:-64,fractions};
}

describe('WorldCover grouped material textures',()=>{
 it('sums all twelve classes exactly and preserves the original south-to-north cell order',()=>{
  const source=grid();
  // SE has every source class: unknown10, trees20+35, low30+40+10+5,
  // crops50, built15, bare20, snow10, water10. The sum stays255.
  source.fractions.set([10,20,30,40,50,15,20,10,10,10,35,5],0);
  source.fractions.set([0,0,0,0,0,0,0,0,255,0,0,0],12); // SW water
  source.fractions.set([0,255,0,0,0,0,0,0,0,0,0,0],24); // NE trees
  source.fractions.set([0,0,0,0,0,255,0,0,0,0,0,0],36); // NW built
  const original=source.fractions.slice(),textures=createTerrainCoverTextures(source);
  const a=textures.coverA.image.data as Uint8Array,b=textures.coverB.image.data as Uint8Array;
  expect(Array.from(a)).toEqual([10,55,85,50,0,0,0,0,0,255,0,0,0,0,0,0]);
  expect(Array.from(b)).toEqual([15,20,10,10,0,0,0,255,0,0,0,0,255,0,0,0]);
  for(let cell=0;cell<4;cell++)expect(a.subarray(cell*4,cell*4+4).reduce((s,v)=>s+v,0)+b.subarray(cell*4,cell*4+4).reduce((s,v)=>s+v,0)).toBe(255);
  expect(source.fractions).toEqual(original);
  expect(a.buffer).not.toBe(source.fractions.buffer);expect(b.buffer).not.toBe(source.fractions.buffer);expect(a.buffer).not.toBe(b.buffer);
  source.fractions.fill(0);expect(a[0]).toBe(10);expect(b[4+3]).toBe(255);
  expect(textures.stats.gridSize).toEqual([2,2]);expect(textures.stats.cellKm).toBe(.125);
  expect(textures.stats.minEdgeKm).toEqual([-64,-64]);expect(textures.stats.rowOrder).toBe('south-to-north; v0=minZ');
  textures.dispose();
 });

 it('configures normalized linear RGBA8 sampling with GPU mipmaps and no Y flip',()=>{
  const textures=createTerrainCoverTextures(grid());
  for(const texture of [textures.coverA,textures.coverB]){
   expect(texture.image.width).toBe(2);expect(texture.image.height).toBe(2);expect(texture.image.data).toBeInstanceOf(Uint8Array);
   expect(texture.format).toBe(RGBAFormat);expect(texture.type).toBe(UnsignedByteType);expect(texture.colorSpace).toBe(NoColorSpace);
   expect(texture.wrapS).toBe(ClampToEdgeWrapping);expect(texture.wrapT).toBe(ClampToEdgeWrapping);expect(texture.flipY).toBe(false);
   expect(texture.minFilter).toBe(LinearMipmapLinearFilter);expect(texture.magFilter).toBe(LinearFilter);
   expect(texture.generateMipmaps).toBe(true);expect(texture.version).toBeGreaterThan(0);expect(texture.mipmaps).toHaveLength(0);
  }
  textures.dispose();
 });

 it.each([
  [2,2,32,8,40],
  [5,3,200,40,240],
  [7,3,392,80,472],
 ])('accounts for a %i-cell side with floor-sized non-power-of-two mips', (side,mipLevels,base,mips,total)=>{
  const textures=createTerrainCoverTextures(grid(side)),stats=textures.stats;
  expect(stats.mipLevels).toBe(mipLevels);expect(stats.basePayloadBytes).toBe(base);
  expect(stats.nominalMipPayloadBytes).toBe(mips);expect(stats.totalGpuPayloadBytes).toBe(total);
  expect(stats.retainedCpuPayloadBytes).toBe(base);expect(stats.sourceAssetBytes).toBe(32+side*side*12);
  const a=textures.coverA.image.data,b=textures.coverB.image.data;
  if(!a||!b)throw new Error('Missing terrain cover base data');
  expect(a.byteLength+b.byteLength).toBe(base);
  expect(Object.isFrozen(stats)).toBe(true);textures.dispose();
 });

 it('releases both owned textures exactly once',()=>{
  const textures=createTerrainCoverTextures(grid()),a=vi.spyOn(textures.coverA,'dispose'),b=vi.spyOn(textures.coverB,'dispose');
  textures.dispose();textures.dispose();
  expect(a).toHaveBeenCalledOnce();expect(b).toHaveBeenCalledOnce();
 });

 it('rejects malformed dimensions and cell sums instead of wrapping grouped bytes',()=>{
  const bad=grid();bad.fractions[0]=254;
  expect(()=>createTerrainCoverTextures(bad)).toThrow('unit sum');
  expect(()=>createTerrainCoverTextures({...grid(),side:2.5})).toThrow('grid');
  expect(()=>createTerrainCoverTextures({...grid(),fractions:new Uint8Array(47)})).toThrow('grid');
 });
});
