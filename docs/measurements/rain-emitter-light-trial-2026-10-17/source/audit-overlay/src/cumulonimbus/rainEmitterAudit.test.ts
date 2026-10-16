import {describe,it,expect} from 'vitest';
import {auditRainEmitterLight,type RainEmitterAuditSource} from './rainEmitterAudit';
function affineSource():RainEmitterAuditSource{
 const size=2,data=new Uint8Array(2**3*4),sunsetLight=new Uint8Array(2**3*2);
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const i=(z*2+y)*2+x;
  data.set([7,20+20*x+40*y+60*z,180-10*x-30*y-40*z,10+5*x+15*y+25*z],i*4);
  sunsetLight.set([140+20*x-10*y+30*z,80+50*x+10*y-20*z],i*2);
 }
 return {size,data,sunsetLight};
}
describe('read-only emitter endpoint audit proposal',()=>{
 it('matches an independent affine field at cell centres with the height on texture Y and the correct two strides',()=>{
  const source=affineSource(),dataBefore=source.data.slice(),lowBefore=source.sunsetLight.slice(),rg=new Uint8Array([100,255]);
  const report=auditRainEmitterLight(rg,source,1),record=report.witnesses[0];
  const heightFraction=(3/8.5)*2-.5;
  // x/z interpolation coordinates are .5; the independent affine polynomial
  // determines each value without reproducing the eight-corner sampler.
  const expected=[60+40*heightFraction,155-30*heightFraction,165-10*heightFraction,95+10*heightFraction,25+15*heightFraction];
  expected.forEach((code,i)=>expect(record.normalizedTau5[i]).toBeCloseTo(Math.fround(code/255),7));
  expect(record.textureXYZ).toEqual([.5,3/8.5,.5]);
  expect(source.data).toEqual(dataBefore);expect(source.sunsetLight).toEqual(lowBefore);expect(rg).toEqual(new Uint8Array([100,255]));
 });
 it('includes a low-strength corner and its R0 diagonal halo, without confusing that halo with the whole map',()=>{
  const source=affineSource(),rg=new Uint8Array(4*4*2);
  for(let i=0;i<16;i++)rg[i*2+1]=255;
  rg[0]=1;rg[1]=0;
  const report=auditRainEmitterLight(rg,source,4);
  expect(report.regions.positive.cells).toBe(1);expect(report.regions.haloZero.cells).toBe(3);
  expect(report.regions.remainingZero.cells).toBe(12);expect(report.support.cells).toBe(4);
  expect(report.regions.positive.sourceRCodeSum).toBe(1);
  expect(report.regions.positive.endpoints.dayLeft.packedUNORM8.distinct).toBe(1);
  expect(report.support.endpoints.dayLeft.packedUNORM8.distinct).toBeGreaterThan(1);
  expect(report.gate.endpointPairGates.dayLeft.identicalBAAtThisEndpoint).toBe(false);
 });
 it('uses source-strength weights for the CDF, and counts endpoint rounding without claiming exact original bake saturation',()=>{
  const source=affineSource();
  for(let i=0;i<8;i++)source.data[i*4+1]=(i%2)*255;
  const rg=new Uint8Array([1,0,0,0,0,0,255,0]),report=auditRainEmitterLight(rg,source,2);
  const stats=report.regions.positive.endpoints.dayLeft;
  expect(stats.tau.quantiles.p50).toBe(0);expect(stats.rWeighted!.quantilesTau.p50).toBe(16);
  expect(stats.rWeighted!.meanTau).toBe(16*255/256);
  expect(stats.packedUNORM8.zeroCount).toBe(1);expect(stats.packedUNORM8.fullCount).toBe(1);
  expect(stats.rWeighted!.packedWeightBins[0]).toBe(1);expect(stats.rWeighted!.packedWeightBins[255]).toBe(255);
 });
 it('evaluates only the applied blend and decodes packed BA before its current visibility response',()=>{
  const source=affineSource();
  for(let i=0;i<8;i++){source.data[i*4+1]=0;source.data[i*4+2]=(i%2)*255;source.data[i*4+3]=128;}
  const rg=new Uint8Array([255,0,255,0,255,0,255,0]);
  const left=auditRainEmitterLight(rg,source,2,{lightSide:0,sunsetAmount:0,massFactor:1});
  const right=auditRainEmitterLight(rg,source,2,{lightSide:1,sunsetAmount:0,massFactor:1});
  expect(left.support.endpoints.dayRight.packedUNORM8.distinct).toBe(2);
  expect(left.gate.current!.identicalPackedBAOnSupport).toBe(true);
  expect(left.gate.current!.stopForCurrentLighting).toBe(true);
  expect(right.gate.current!.distinctPackedBAPairs).toBe(2);
  expect(right.gate.current!.stopForCurrentLighting).toBe(false);
  expect(right.current!.support.sun.visibility.min).toBeCloseTo(Math.exp(-16),12);
  expect(right.current!.support.sun.visibility.max).toBe(1);
  expect(right.current!.support.sky.tau.min).toBe(128/255*16);
  expect(right.current!.support.sky.visibility.min).toBeCloseTo(.18+.82*Math.exp(-.35*16*128/255),12);
  const noShadow=auditRainEmitterLight(rg,source,2,{lightSide:1,sunsetAmount:.5,massFactor:0});
  expect(noShadow.current!.support.sun.visibility.min).toBe(1);
  expect(noShadow.current!.support.sky.visibility.min).toBe(1);
  expect(noShadow.gate.current!.constantVisibilityOnSupport).toBe(true);
  expect(noShadow.gate.current!.stopForCurrentLighting).toBe(true);
  expect(()=>auditRainEmitterLight(rg,source,2,{lightSide:NaN,sunsetAmount:0,massFactor:1})).toThrow();
 });
 it('reports empty source honestly and rejects unsafe dimensions/lengths before sampling',()=>{
  const source={size:1,data:new Uint8Array([0,0,255,255]),sunsetLight:new Uint8Array([0,255])};
  const empty=auditRainEmitterLight(new Uint8Array([0,255]),source,1);
  expect(empty.gate.noPositiveSource).toBe(true);expect(empty.support.cells).toBe(0);
  expect(empty.regions.positive.endpoints.dayLeft.tau.min).toBeNull();
  expect(empty.gate.endpointPairGates.dayLeft.identicalBAAtThisEndpoint).toBeNull();
  expect(empty.gate.currentIntermediateBAEvaluated).toBe(false);
  expect(()=>auditRainEmitterLight(new Uint8Array(2),source,65)).toThrow();
  expect(()=>auditRainEmitterLight(new Uint8Array(2),{...source,size:257},1)).toThrow();
  expect(()=>auditRainEmitterLight(new Uint8Array(4),source,1)).toThrow();
 });
});
