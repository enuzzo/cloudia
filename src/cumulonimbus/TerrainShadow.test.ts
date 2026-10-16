import {describe,expect,it} from 'vitest';
import {Box3,FloatType,NearestFilter,NoColorSpace,RedFormat,Scene,Vector3} from 'three/webgpu';
import {TerrainShadow,TERRAIN_SHADOW_DEFAULTS,terrainShadowCasterMinimum,terrainShadowCompare,terrainShadowFrame,terrainShadowLookupPoint,terrainShadowProject,terrainShadowVisibility} from './TerrainShadow';

const bounds=new Box3(new Vector3(-1048.576,-180,-1048.576),new Vector3(1048.576,.5,1048.576));
const centre=new Vector3(0,-4,0);
const pointAt=(frame:ReturnType<typeof terrainShadowFrame>,x:number,y:number,q:number)=>
 frame.center.clone().addScaledVector(frame.right,x).addScaledVector(frame.up,y).addScaledVector(frame.sun,q);

describe('terrain shadow world-space reference',()=>{
 it.each([[0,1,0],[1,.04,0],[-.8,.15,.6],[0,-1,0]])('fits every caster AABB corner for Sun %j',(x,y,z)=>{
  const frame=terrainShadowFrame([x,y,z],bounds);
  expect(frame.sun.length()).toBeCloseTo(1,14);expect(frame.right.length()).toBeCloseTo(1,14);expect(frame.up.length()).toBeCloseTo(1,14);
  expect(frame.right.dot(frame.sun)).toBeCloseTo(0,14);expect(frame.up.dot(frame.sun)).toBeCloseTo(0,14);
  expect(frame.right.clone().cross(frame.up).dot(frame.sun)).toBeCloseTo(1,14);
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const projection=terrainShadowProject([x,y,z],frame);
   expect(projection.depthKm).toBeGreaterThan(frame.nearKm);expect(projection.depthKm).toBeLessThan(frame.farKm);
  }
  expect(frame.distanceKm-frame.maximumCasterHeightKm).toBeCloseTo(1,12);
  expect(frame.farKm-(frame.distanceKm-frame.minimumCasterHeightKm)).toBeCloseTo(1,12);
 });
 it('keeps the low Sun casters that fixed 256/512km light depth would clip',()=>{
  const frame=terrainShadowFrame([1,.04,0],bounds);
  expect(frame.distanceKm).toBeGreaterThan(1000);expect(frame.farKm).toBeGreaterThan(2000);
 });
 it('projects relative to the ground datum with top-origin Y and physical light depth',()=>{
  const frame=terrainShadowFrame([-.8,.6,0],bounds,2048,64);
  expect(terrainShadowProject(centre,frame)).toEqual({u:.5,v:.5,heightKm:0,depthKm:frame.distanceKm});
  const p=terrainShadowProject(pointAt(frame,32,16,3),frame);
  expect(p.u).toBeCloseTo(.75,14);expect(p.v).toBeCloseTo(.375,14);expect(p.heightKm).toBeCloseTo(3,14);
  expect(p.depthKm).toBeCloseTo(frame.distanceKm-3,12);
 });
 it('compares nearer-to-Sun height, with an inclusive metre-scale bias and clear treated as lit',()=>{
  expect(terrainShadowCompare(2,3,.001)).toBe(0);expect(terrainShadowCompare(2,1,.001)).toBe(1);
  expect(terrainShadowCompare(2,2.001,.001)).toBe(1);expect(terrainShadowCompare(-1000,TERRAIN_SHADOW_DEFAULTS.clearHeightKm,.003)).toBe(1);
 });
 it('stores fixed caster-face footprint minima, including both slope signs',()=>{
  expect(terrainShadowCasterMinimum(2,.012,.016)).toBeCloseTo(1.985,14);
  expect(terrainShadowCasterMinimum(2,-.012,-.016)).toBeCloseTo(1.985,14);
  expect(terrainShadowCasterMinimum(2,0,0)).toBeCloseTo(1.999,14);
 });
 it('raises only the lookup point by half a real texel along the planet radial',()=>{
  const frame=terrainShadowFrame([0,1,0],bounds),point=new Vector3(12,-3,-25),original=point.clone(),planetCenter=new Vector3(0,-6375,0);
  const lookup=terrainShadowLookupPoint(point,frame),radial=point.clone().sub(planetCenter).normalize();
  expect(point.equals(original)).toBe(true);expect(lookup.distanceTo(point)).toBeCloseTo(.03125,12);
  expect(lookup.clone().sub(point).normalize().dot(radial)).toBeCloseTo(1,12);
  expect(lookup.distanceTo(planetCenter)-point.distanceTo(planetCenter)).toBeCloseTo(.03125,11);
  const finer=terrainShadowFrame([0,1,0],bounds,4096,64);
  expect(terrainShadowLookupPoint(centre,finer).y).toBeCloseTo(-3.984375,12);
 });
 it('moves UV as well as height and does not add a global solar-height bias at sunset',()=>{
  const frame=terrainShadowFrame([1,0,0],bounds),lookup=terrainShadowLookupPoint(centre,frame);
  const before=terrainShadowProject(centre,frame),after=terrainShadowProject(lookup,frame);
  expect(after.heightKm).toBe(before.heightKm);expect(after.u).toBe(before.u);
  expect(after.v).toBeLessThan(before.v);expect(lookup.y-centre.y).toBe(.03125);
  expect(terrainShadowVisibility(centre,frame,()=>terrainShadowCasterMinimum(.2,0,0))).toBe(0);
 });
 it('a vertical Sun cannot self-shadow a two-face valley at a crease',()=>{
  const frame=terrainShadowFrame([0,1,0],bounds,16,.5);
  // h=abs(x): receiver 1m from the crease, nearest map centre 31.25m
  // away. With raw nearest height it is falsely shadowed. The opposite
  // 3x3 tap also defeats old receiver-plane extrapolation: +31.25m stored
  // versus -31.25m extrapolated, despite no possible vertical occlusion.
  expect(terrainShadowCompare(.001,.03125,.001)).toBe(0);
  expect(terrainShadowCompare(-.03125,.03125,.003)).toBe(0);
  const sample=(x:number)=>terrainShadowCasterMinimum(Math.abs((x+.5)/16-.5),.0625,0);
  for(const x of [-.001,0,.001]){
   const point=new Vector3(x,-4+Math.abs(x),0);
   expect(terrainShadowVisibility(point,frame,sample)).toBe(1);
  }
 });
 it('keeps every point on one affine face lit across its texel footprint',()=>{
  const frame=terrainShadowFrame([0,1,0],bounds,8,4);
  // Light-map q=2*right-.75*up. Pixel width is 1km in this tiny oracle.
  const sample=(x:number,y:number)=>terrainShadowCasterMinimum(2*((x+.5)-4)-.75*(4-(y+.5)),2,.75);
  for(const x of [-.49,.13,.49])for(const y of [-.49,.27,.49]){
   const point=pointAt(frame,x,y,2*x-.75*y);
   expect(terrainShadowVisibility(point,frame,sample)).toBe(1);
  }
 });
 it('preserves a separate raised occluder and explicitly loses sub-margin contact shadows',()=>{
  const frame=terrainShadowFrame([0,1,0],bounds,16,.5);
  expect(terrainShadowVisibility(centre,frame,()=>terrainShadowCasterMinimum(.2,.0625,0))).toBe(0);
  // The face's 31.25m half-footprint can erase a 20m contact shadow. This
  // loss is intentional and must not be described as physical transport.
  expect(terrainShadowVisibility(centre,frame,()=>terrainShadowCasterMinimum(.02,.0625,0))).toBe(1);
  expect(terrainShadowVisibility(centre,frame,()=>TERRAIN_SHADOW_DEFAULTS.clearHeightKm)).toBe(1);
 });
 it('uses only the addressed texel and fades to lit without an out-of-coverage lookup',()=>{
  const frame=terrainShadowFrame([0,1,0],bounds,16,64),seen:string[]=[];
  terrainShadowVisibility(centre,frame,(x,y)=>{seen.push(`${x},${y}`);return -1;});
  expect(seen).toEqual(['8,8']);
  const edge=pointAt(frame,-63,0,0);let calls=0;
  const value=terrainShadowVisibility(edge,frame,(x,y)=>{expect(x).toBe(0);expect(y).toBe(8);calls++;return 20;});
  expect(calls).toBe(1);expect(value).toBeGreaterThan(0);expect(value).toBeLessThan(1);
  expect(terrainShadowVisibility(pointAt(frame,65,0,0),frame,()=>{throw Error('out-of-coverage load');})).toBe(1);
 });
 it('rejects nonfinite inputs and empty bounds before using a light camera',()=>{
  expect(()=>terrainShadowFrame([0,0,0],bounds)).toThrow();expect(()=>terrainShadowFrame([NaN,1,0],bounds)).toThrow();
  expect(()=>terrainShadowFrame([0,1,0],new Box3())).toThrow();expect(()=>terrainShadowFrame([0,1,0],bounds,0)).toThrow();
 });
});

describe('terrain shadow target ownership',()=>{
 it('allocates unfiltered R32F+depth32 with explicit scope and releases only its owned resources once',()=>{
  const scene=new Scene(),shadow=new TerrainShadow(scene,bounds),events:string[]=[];
  shadow.target.addEventListener('dispose',()=>events.push('target'));shadow.material.addEventListener('dispose',()=>events.push('material'));
  expect(shadow.target.texture.type).toBe(FloatType);expect(shadow.target.texture.format).toBe(RedFormat);
  expect(shadow.target.texture.minFilter).toBe(NearestFilter);expect(shadow.target.texture.magFilter).toBe(NearestFilter);
  expect(shadow.target.texture.colorSpace).toBe(NoColorSpace);expect(shadow.target.depthTexture?.type).toBe(FloatType);expect(shadow.target.samples).toBe(0);
  expect(shadow.stats().targetPayloadBytes).toBe(33554432);expect(shadow.stats().resolution).toBe(2048);
  expect(shadow.material.fragmentNode).not.toBeNull();expect(shadow.stats().depthFit).toBeNull();
  shadow.dispose();shadow.dispose();expect(events).toEqual(['target','material']);expect(scene.children).toHaveLength(0);
 });
});
