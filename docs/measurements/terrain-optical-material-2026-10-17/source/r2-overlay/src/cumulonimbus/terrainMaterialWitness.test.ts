import {describe,expect,it} from 'vitest';
import {selectTerrainMaterialWitness,TERRAIN_MATERIAL_WITNESS_POINTS,terrainMaterialAlphaBytes} from './terrainMaterialWitness';

describe('twelve fixed terrain material records from packed RGBA32F',()=>{
 it('preserves the exact archived UV order without treating historical IDs as classes',()=>{
  const expected=[
   ['L1-artifact',71.5,856.5],['L1-control',64.5,856.5],
   ['L2-artifact',431.5,849.5],['L2-control',431.5,844.5],
   ['L3-artifact',903.5,651.5],['L3-control',903.5,646.5],
   ['C1-ocean',2200.5,1100.5],['C2-coastal-lowland',1800.5,930.5],
   ['C3-plain',2200.5,700.5],['C4-ridge-L1',170.5,805.5],
   ['C5-ridge-L2',460.5,800.5],['C6-ridge-L3',925.5,610.5],
  ] as const;
  expect(TERRAIN_MATERIAL_WITNESS_POINTS).toHaveLength(12);
  expect(TERRAIN_MATERIAL_WITNESS_POINTS.map(point=>[point.id,...point.uv])).toEqual(expected.map(([id,x,y])=>[id,x/2474,y/1844]));
  expect(Object.isFrozen(TERRAIN_MATERIAL_WITNESS_POINTS)).toBe(true);
  for(const point of TERRAIN_MATERIAL_WITNESS_POINTS){expect(Object.isFrozen(point)).toBe(true);expect(Object.isFrozen(point.uv)).toBe(true);}
 });
 it('loads top-origin packed rows and rightmost cells from an unaligned offset byte view',()=>{
  const width=4,height=4,storage=new ArrayBuffer(width*height*16+14),all=new Uint8Array(storage);all.fill(0xa5);
  const input=new Uint8Array(storage,7,width*height*16),view=new DataView(storage,7,input.byteLength);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const offset=(y*width+x)*16,index=y*width+x;
   [x,y,index,1000+index].forEach((value,c)=>view.setFloat32(offset+c*4,value,true));
  }
  const before=all.slice(),rows=selectTerrainMaterialWitness(input,width,height);
  expect(rows).toHaveLength(12);
  expect(rows[0]).toMatchObject({id:'L1-artifact',pixel:[0,1],rgba:[0,1,4,1004]});
  expect(rows[6]).toMatchObject({id:'C1-ocean',pixel:[3,2],rgba:[3,2,11,1011]});
  expect(rows[7]).toMatchObject({id:'C2-coastal-lowland',pixel:[2,2],rgba:[2,2,10,1010]});
  expect(rows[8]).toMatchObject({id:'C3-plain',pixel:[3,1],rgba:[3,1,7,1007]});
  expect(rows[11]).toMatchObject({id:'C6-ridge-L3',pixel:[1,1],rgba:[1,1,5,1005]});
  expect(all).toEqual(before);
 });
 it('keeps NaN payloads and both zero signs and returns non-aliasing rows even at one pixel',()=>{
  const input=new Uint8Array(16),view=new DataView(input.buffer),bits=[0x7fc01234,0x80000000,0x00000000,0xffc05678];
  bits.forEach((value,c)=>view.setUint32(c*4,value,true));
  const before=input.slice(),first=selectTerrainMaterialWitness(input,1,1),second=selectTerrainMaterialWitness(input,1,1);
  for(const row of first){
   expect(row.pixel).toEqual([0,0]);expect(row.bits).toEqual(bits);
   expect(Number.isNaN(row.rgba[0])).toBe(true);expect(Object.is(row.rgba[1],-0)).toBe(true);
   expect(Object.is(row.rgba[2],0)).toBe(true);expect(Number.isNaN(row.rgba[3])).toBe(true);
  }
  first[0].uv[0]=99;first[0].pixel[0]=99;first[0].rgba[0]=99;first[0].bits[0]=99;
  expect(first[1].bits).toEqual(bits);expect(Number.isNaN(first[1].rgba[0])).toBe(true);expect(first[1].pixel).toEqual([0,0]);
  expect(second[0].bits).toEqual(bits);expect(Number.isNaN(second[0].rgba[0])).toBe(true);
  expect(first[1].uv).toEqual([64.5/2474,856.5/1844]);expect(second[0].uv).toEqual([71.5/2474,856.5/1844]);
  expect(input).toEqual(before);input.fill(0);expect(second[0].bits).toEqual(bits);
 });
 it('rejects dimensions, excessive payloads, wrong types and padding before selecting records',()=>{
  const empty=new Uint8Array(0);
  for(const [width,height] of [[0,1],[-1,1],[1.5,1],[1,NaN],[Infinity,1],[8193,1],[1,8193]])
   expect(()=>selectTerrainMaterialWitness(empty,width,height)).toThrow(/dimensions/);
  expect(()=>selectTerrainMaterialWitness(empty,8192,8192)).toThrow(/96MiB/);
  // Exact96MiB passes the cap check, then fails byte-shape without allocating96MiB.
  expect(()=>selectTerrainMaterialWitness(empty,1024,6144)).toThrow(/byte length/);
  expect(()=>selectTerrainMaterialWitness(new Float32Array(4) as unknown as Uint8Array,1,1)).toThrow(TypeError);
  expect(()=>selectTerrainMaterialWitness(new Uint8Array(15),1,1)).toThrow(/byte length/);
  expect(()=>selectTerrainMaterialWitness(new Uint8Array(32),1,1)).toThrow(/byte length/);
  // Two tightly packed pixels require32B, not a256B-aligned first row.
  expect(()=>selectTerrainMaterialWitness(new Uint8Array(272),1,2)).toThrow(/byte length/);
 });
});

describe('terrain material alpha bytes from the entire packed target',()=>{
 it('copies every alpha word in row order including NaNs and signed zeros from an unaligned view',()=>{
  const width=3,height=2,storage=new ArrayBuffer(width*height*16+6),all=new Uint8Array(storage);all.fill(0xa5);
  const packed=new Uint8Array(storage,3,width*height*16),view=new DataView(storage,3,packed.byteLength);
  const words=[0x7fc01234,0x00000000,0x80000000,0x7f800000,0xbf800000,0x12345678];
  words.forEach((bits,pixel)=>view.setUint32(pixel*16+12,bits,true));
  const before=all.slice(),alpha=terrainMaterialAlphaBytes(packed,width,height),again=terrainMaterialAlphaBytes(packed,width,height);
  expect(alpha).toEqual(new Uint8Array([
   0x34,0x12,0xc0,0x7f, 0,0,0,0, 0,0,0,0x80,
   0,0,0x80,0x7f, 0,0,0x80,0xbf, 0x78,0x56,0x34,0x12,
  ]));
  expect(alpha.byteLength).toBe(width*height*4);expect(alpha.byteOffset).toBe(0);
  expect(alpha.buffer).toBeInstanceOf(ArrayBuffer);expect(alpha.buffer).not.toBe(storage);expect(alpha.buffer).not.toBe(again.buffer);
  expect(all).toEqual(before);
  packed.fill(0);expect(alpha).toEqual(again);alpha.fill(255);
  expect(packed).toEqual(new Uint8Array(width*height*16));expect(again[0]).toBe(0x34);
 });
 it('rejects invalid dimensions, types, shape and input cap before allocating output',()=>{
  const empty=new Uint8Array(0);
  for(const [width,height] of [[0,1],[-1,1],[1.5,1],[1,NaN],[Infinity,1],[8193,1],[1,8193]])
   expect(()=>terrainMaterialAlphaBytes(empty,width,height)).toThrow(/dimensions/);
  expect(()=>terrainMaterialAlphaBytes(empty,8192,8192)).toThrow(/96MiB/);
  // At the exact96MiB input /24MiB output boundary, reject missing bytes, not cap.
  expect(()=>terrainMaterialAlphaBytes(empty,1024,6144)).toThrow(/byte length/);
  expect(()=>terrainMaterialAlphaBytes(new Float32Array(4) as unknown as Uint8Array,1,1)).toThrow(TypeError);
  expect(()=>terrainMaterialAlphaBytes(new Uint8Array(15),1,1)).toThrow(/byte length/);
  expect(()=>terrainMaterialAlphaBytes(new Uint8Array(32),1,1)).toThrow(/byte length/);
  expect(()=>terrainMaterialAlphaBytes(new Uint8Array(272),1,2)).toThrow(/byte length/);
 });
});
