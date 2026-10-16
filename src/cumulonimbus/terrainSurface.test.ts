import {describe,expect,it} from 'vitest';
import {coastDistance} from './landscape';
import {TERRAIN_SURFACE_BOUND_DERIVATION,TERRAIN_SURFACE_MAX_HEIGHT_KM,TERRAIN_SURFACE_MAX_SLOPE,TERRAIN_SURFACE_WGSL,terrainSurfaceBiomes,terrainSurfaceHeight,terrainSurfaceSample} from './terrainSurface';

describe('one continuous wilderness terrain source',()=>{
 it('preserves the deterministic coast on both sides of negative lattice boundaries',()=>{
  for(const x of [-256,-91.25,-18.18182,-.0001,0,17.5,94,256])for(const z of [-256,-81.25,-18.18182,-.0001,0,27.5,83,256]){
   expect(terrainSurfaceSample(x,z).coastKm).toBe(coastDistance(x,z));
  }
 });
 it('has a proved ceiling and a conservative ideal gradient bound, with explicit slack',()=>{
  expect(TERRAIN_SURFACE_BOUND_DERIVATION.idealHeightKm).toBeCloseTo(3.30,12);
  expect(TERRAIN_SURFACE_MAX_HEIGHT_KM).toBeGreaterThan(TERRAIN_SURFACE_BOUND_DERIVATION.idealHeightKm);
  expect(TERRAIN_SURFACE_BOUND_DERIVATION.idealSlope).toBeGreaterThan(8);
  expect(TERRAIN_SURFACE_BOUND_DERIVATION.idealSlope).toBeLessThan(TERRAIN_SURFACE_MAX_SLOPE);
  let minimum=Infinity,maximum=-Infinity,steep=0;
  // Sparse geometry audit, not a heightfield bake or a rendered quality verdict.
  for(let iz=0;iz<33;iz++)for(let ix=0;ix<33;ix++){
   const x=-128+ix*8.017,z=-128+iz*7.973,s=terrainSurfaceSample(x,z);
   expect(Object.values(s).every(Number.isFinite)).toBe(true);
   expect(s.heightKm).toBeGreaterThanOrEqual(0);expect(s.heightKm).toBeLessThan(TERRAIN_SURFACE_MAX_HEIGHT_KM);
   expect(Math.hypot(s.slopeX,s.slopeZ)).toBeLessThan(TERRAIN_SURFACE_MAX_SLOPE);
   minimum=Math.min(minimum,s.heightKm);maximum=Math.max(maximum,s.heightKm);
   if(Math.hypot(s.slopeX,s.slopeZ)>.4)steep++;
  }
  expect(minimum).toBe(0);expect(maximum).toBeGreaterThan(2);expect(steep).toBeGreaterThan(20);
 });
 it('keeps the sea empty and the coast transition continuous',()=>{
  expect(terrainSurfaceHeight(24,0)).toBe(0);
  expect(terrainSurfaceHeight(-24,0)).toBeGreaterThan(.1);
  for(const [x,z] of [[-17.1,3.2],[-4.9,-.3],[0,0],[-39.7,51.3],[4.2,-16.7]]){
   const a=terrainSurfaceHeight(x,z),b=terrainSurfaceHeight(x+1e-4,z-1e-4);
   expect(Math.abs(a-b)).toBeLessThan(TERRAIN_SURFACE_MAX_SLOPE*Math.SQRT2*1e-4+3e-5);
  }
 });
 it('returns the derivative of the height, rather than a normal from unrelated detail',()=>{
  let checked=0;
  for(const [x,z] of [[-17.1,3.2],[-4.9,-.3],[-39.7,51.3],[-71.2,-8.7],[-9.2,12.7],[-50.8,-20.4]]){
   const s=terrainSurfaceSample(x,z),e=.001;
   const dx=(terrainSurfaceHeight(x+e,z)-terrainSurfaceHeight(x-e,z))/(2*e);
   const dz=(terrainSurfaceHeight(x,z+e)-terrainSurfaceHeight(x,z-e))/(2*e);
   // A wider stencil catches a ridge cusp; no unique analytic derivative exists there.
   const dx2=(terrainSurfaceHeight(x+2*e,z)-terrainSurfaceHeight(x-2*e,z))/(4*e);
   const dz2=(terrainSurfaceHeight(x,z+2*e)-terrainSurfaceHeight(x,z-2*e))/(4*e);
   if(Math.abs(dx-dx2)<.005&&Math.abs(dz-dz2)<.005){
    expect(Math.abs(s.slopeX-dx)).toBeLessThan(.006);
    expect(Math.abs(s.slopeZ-dz)).toBeLessThan(.006);checked++;
   }
  }
  expect(checked).toBeGreaterThanOrEqual(4);
 });
 it('shares sea datum and radial normal in its optional analytic material fallback',()=>{
  expect(TERRAIN_SURFACE_WGSL).toContain('point+vec3<f32>(0,6375,0)');
  const material=TERRAIN_SURFACE_WGSL.split('fn terrainSurfaceMaterial(')[1].split('fn terrainSurfaceColour(')[0];
  expect(material).not.toContain('terrainSurfaceSample(');
  expect(material).not.toContain('terrainSurfaceHeight(');
  expect(material).not.toMatch(/reflect\(|pow\(/);
  expect(material).toContain('max(0.0,dot(n,sun))');
  expect(material).toContain('pixelKm');
 });
});

describe('matte forest, rock and sparse snow',()=>{
 it('keeps biome weights finite, bounded and conservative as a partition',()=>{
  for(const height of [0,.6,1.5,2.4,3.3])for(const slope of [0,.3,.7,1.5,4])for(const cold of [0,.5,1])for(const patch of [0,.5,.7,1]){
   const b=terrainSurfaceBiomes(height,slope,cold,patch);
   for(const w of Object.values(b)){expect(w).toBeGreaterThanOrEqual(0);expect(w).toBeLessThanOrEqual(1);}
   expect(b.forest+b.rock+b.snow).toBeCloseTo(1,6);
   expect(b.snow).toBeLessThanOrEqual(Math.fround(.72));
  }
 });
 it('uses elevation and slope for tree line, and aspect plus patches for snow',()=>{
  expect(terrainSurfaceBiomes(.4,.1,0,.5).forest).toBe(1);
  expect(terrainSurfaceBiomes(.4,1.4,0,.5).rock).toBe(1);
  expect(terrainSurfaceBiomes(2.1,.1,0,.5).forest).toBe(0);
  expect(terrainSurfaceBiomes(3.3,.1,1,.5).snow).toBe(0);
  expect(terrainSurfaceBiomes(3.3,1.1,1,1).snow).toBe(0);
  expect(terrainSurfaceBiomes(2.7,.1,1,1).snow).toBeGreaterThan(terrainSurfaceBiomes(2.7,.1,0,1).snow);
 });
});
