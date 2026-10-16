import {describe,it,expect} from 'vitest';
import {buildRainEmitterLight,updateRainEmitterLight,type RainEmitterLightSource} from './rainEmitterLight';
function affineSource():RainEmitterLightSource{
 const data=new Uint8Array(8*4),sunsetLight=new Uint8Array(8*2);
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const i=(z*2+y)*2+x;
  data.set([7,20+20*x+40*y+60*z,180-10*x-30*y-40*z,10+5*x+15*y+25*z],i*4);
  sunsetLight.set([140+20*x-10*y+30*z,80+50*x+10*y-20*z],i*2);
 }
 return {size:2,data,sunsetLight};
}
const uniformSource=():RainEmitterLightSource=>({size:1,data:new Uint8Array([0,51,102,153]),sunsetLight:new Uint8Array([204,255])});
describe('small emitter light packet proposal',()=>{
 it('samples the independent affine polynomial with height on Y, correct strides and Float32 endpoint storage',()=>{
  const packet=buildRainEmitterLight(new Uint8Array([100,255]),affineSource(),1),h=(3/8.5)*2-.5;
  const expected=[60+40*h,155-30*h,165-10*h,95+10*h,25+15*h];
  expected.forEach((code,i)=>expect(packet.endpoints[i]).toBeCloseTo(Math.fround(code/255),7));
  expect(packet.rgba[0]).toBe(100);expect(packet.rgba[1]).toBe(255);
  expect(packet.rgba[3]).toBe(Math.round(packet.endpoints[4]*255));
  expect(packet.lightSide).toBeNull();expect(packet.sunsetAmount).toBeNull();
 });
 it('copies RG exactly and computes valid static light for the transparent diagonal halo too',()=>{
  const source=affineSource(),rg=new Uint8Array(4*4*2);
  for(let i=0;i<16;i++)rg[i*2+1]=255;
  rg[0]=1;rg[1]=0;
  const before=rg.slice(),macroBefore=source.data.slice(),lowBefore=source.sunsetLight.slice();
  const packet=buildRainEmitterLight(rg,source,4),endpointsBefore=packet.endpoints.slice();
  updateRainEmitterLight(packet,0,0);
  for(let i=0;i<16;i++){
   expect(packet.rgba[i*4]).toBe(before[i*2]);expect(packet.rgba[i*4+1]).toBe(before[i*2+1]);
  }
  const halo=1*4+1;
  expect(packet.rgba[halo*4]).toBe(0);expect(packet.rgba[halo*4+2]).toBeGreaterThan(0);
  expect(packet.rgba[halo*4+3]).toBeGreaterThan(0);
  expect(rg).toEqual(before);expect(source.data).toEqual(macroBefore);expect(source.sunsetLight).toEqual(lowBefore);
  // Packet owns only its two small arrays; later source edits cannot alias them.
  rg.fill(0);source.data.fill(0);source.sunsetLight.fill(0);
  expect(packet.endpoints).toEqual(endpointsBefore);expect(packet.rgba[halo*4+1]).toBe(255);
 });
 it('packs each endpoint and an interrupted mixed state directly from immutable depths, leaving RG/A unchanged',()=>{
  const packet=buildRainEmitterLight(new Uint8Array([200,90]),uniformSource(),1);
  for(const [side,sunset,expected] of [[0,0,51],[1,0,102],[0,1,204],[1,1,255],[.25,.5,140],[0,0,51]]){
   expect(updateRainEmitterLight(packet,side,sunset)).toBe(true);
   expect(packet.rgba).toEqual(new Uint8Array([200,90,expected,153]));
   expect(packet.lightSide).toBe(side);expect(packet.sunsetAmount).toBe(sunset);
  }
 });
 it('updates exact scalar keys even when B bytes do not change, and a new packet cannot inherit an old volume key',()=>{
  const first=buildRainEmitterLight(new Uint8Array([255,0]),uniformSource(),1);
  updateRainEmitterLight(first,0,0);
  expect(updateRainEmitterLight(first,.000001,0)).toBe(false);
  expect(first.lightSide).toBe(.000001);expect(first.sunsetAmount).toBe(0);
  expect(updateRainEmitterLight(first,.000001,0)).toBe(false);
  expect(updateRainEmitterLight(first,-0,0)).toBe(false);expect(Object.is(first.lightSide,-0)).toBe(true);
  const otherSource=uniformSource();otherSource.data[1]=250;
  const second=buildRainEmitterLight(new Uint8Array([255,0]),otherSource,1);
  expect(second.lightSide).toBeNull();expect(updateRainEmitterLight(second,0,0)).toBe(true);
  expect(first.rgba[2]).toBe(51);expect(second.rgba[2]).toBe(250);
  // First light update can legitimately report false; initial RG/A upload is separate.
  const zero=buildRainEmitterLight(new Uint8Array([255,0]),{size:1,data:new Uint8Array([0,0,0,128]),sunsetLight:new Uint8Array(2)},1);
  expect(updateRainEmitterLight(zero,0,0)).toBe(false);expect(zero.lightSide).toBe(0);expect(zero.rgba[3]).toBe(128);
 });
 it('rejects invalid bounds and light values without partially changing an accepted packet',()=>{
  const source=uniformSource(),packet=buildRainEmitterLight(new Uint8Array([100,255]),source,1);
  updateRainEmitterLight(packet,0,0);const before=packet.rgba.slice();
  for(const [side,sunset] of [[NaN,0],[Infinity,0],[-.1,0],[1.1,0],[0,-.1],[0,1.1]])expect(()=>updateRainEmitterLight(packet,side,sunset)).toThrow();
  expect(packet.rgba).toEqual(before);expect(packet.lightSide).toBe(0);expect(packet.sunsetAmount).toBe(0);
  expect(()=>buildRainEmitterLight(new Uint8Array(2),source,65)).toThrow();
  expect(()=>buildRainEmitterLight(new Uint8Array(2),{...source,size:257},1)).toThrow();
  expect(()=>buildRainEmitterLight(new Uint8Array(4),source,1)).toThrow();
 });
});
