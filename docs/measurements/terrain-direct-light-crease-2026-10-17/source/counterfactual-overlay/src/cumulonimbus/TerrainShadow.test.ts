import {describe,expect,it,vi} from 'vitest';
import {Box3,Color,DepthTexture,FloatType,NearestFilter,NoColorSpace,RedFormat,RenderTarget,Scene,Vector3,Vector4,type WebGPURenderer} from 'three/webgpu';
import {vec3} from 'three/tsl';
import {TerrainShadow,TERRAIN_SHADOW_DEFAULTS,TERRAIN_SHADOW_DIAGNOSTIC_WGSL,TERRAIN_SHADOW_WGSL,terrainShadowCasterMinimum,terrainShadowCompare,terrainShadowFrame,terrainShadowLookupPoint,terrainShadowProject,terrainShadowVisibility} from './TerrainShadow';
import {TerrainMesh,type TerrainCameraFrame} from './terrainMesh';

const bounds=new Box3(new Vector3(-1048.576,-180,-1048.576),new Vector3(1048.576,.5,1048.576));
const centre=new Vector3(0,-4,0);
const pointAt=(frame:ReturnType<typeof terrainShadowFrame>,x:number,y:number,q:number)=>
 frame.center.clone().addScaledVector(frame.right,x).addScaledVector(frame.up,y).addScaledVector(frame.sun,q);

it('derives receiver debug output without changing any projection, load, comparison or fade operation',()=>{
 const restored=TERRAIN_SHADOW_DIAGNOSTIC_WGSL
  .replace('fn terrainMeshShadowDiagnostic(', 'fn terrainMeshShadowVisibility(')
  .replace('radius:f32)->vec4<f32> {','radius:f32)->f32 {')
  .replace('{return vec4<f32>(uv*vec2<f32>(size),dot(relative,sun),1.0);}','{return 1.0;}')
  .replace('return vec4<f32>(uv*vec2<f32>(size),height,mix(visibility,1.0,smoothstep(.85,1.0,edge)));','return mix(visibility,1.0,smoothstep(.85,1.0,edge));');
 expect(restored).toBe(TERRAIN_SHADOW_WGSL);
 expect(TERRAIN_SHADOW_DIAGNOSTIC_WGSL.match(/textureLoad\(/g)).toHaveLength(1);
});

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

function rendererFixture(scene:Scene){
 const previousTarget=new RenderTarget(3,2),previousMRT={label:'caller MRT'},colour=new Color(.2,.3,.4);
 let target:RenderTarget|null=previousTarget,mrt:unknown=previousMRT,alpha=.4,depth=.37;
 const mutations:string[]=[];
 const hooks:{draw?:(()=>void);restore?:(()=>void);clear?:(()=>void)}={};
 const renderer={
  reversedDepthBuffer:false,autoClear:true,
  getRenderTarget:()=>target,getMRT:()=>mrt,getClearColor:(out:Color)=>out.copy(colour),getClearAlpha:()=>alpha,
  getClearDepth:()=>renderer.reversedDepthBuffer?1-depth:depth,
  setMRT:(value:unknown)=>{mutations.push('MRT');mrt=value;},
  setRenderTarget:(value:RenderTarget|null)=>{mutations.push('target');target=value;if(value===previousTarget)hooks.restore?.();},
  setClearColor:(value:Color,opacity:number)=>{mutations.push('colour');colour.copy(value);alpha=opacity;},
  setClearDepth:(value:number)=>{mutations.push('depth');depth=value;},
  clear:vi.fn(()=>{mutations.push('clear');hooks.clear?.();}),
  render:vi.fn(()=>{mutations.push('draw');hooks.draw?.();}),
 };
 const snapshot=()=>({target,mrt,colour:colour.toArray(),alpha,depth,autoClear:renderer.autoClear,override:scene.overrideMaterial});
 return {renderer,gpu:renderer as unknown as WebGPURenderer,hooks,mutations,snapshot};
}
function cacheFixture(){const scene=new Scene(),box=bounds.clone(),shadow=new TerrainShadow(scene,box),mock=rendererFixture(scene);return {scene,box,shadow,...mock};}

function receiverFixture(){
 const terrain=new TerrainMesh({cellsPerSide:8,levels:1,spacingKm:.125,normalMode:'geometry',shadowDiagnostic:true,
  sample:()=>({heightKm:1,slopeX:0,slopeZ:0,coastKm:5}),shade:()=>vec3(.2,.3,.4)});
 terrain.resize(2474,1844);
 const frame:TerrainCameraFrame={origin:[0,2,0],forward:[0,-1,0],right:[1,0,0],up:[0,0,-1],aspect:2474/1844,tanFov:.2867,inspection:0};
 const h=rendererFixture(new Scene()),order:string[]=[],deferred:Array<{resolve:(v:Float32Array)=>void;reject:(e:Error)=>void}>=[];
 const clears:Array<{test:boolean;rect:number[]}>=[];
 let scissorTest=true;const scissor=new Vector4(2,3,4,5),setColour=h.renderer.setClearColor;
 h.renderer.setClearColor=(value:Color|number,alpha:number)=>setColour(value instanceof Color?value:new Color(value),alpha);
 const renderer=Object.assign(h.renderer,{
  getScissorTest:()=>scissorTest,setScissorTest:(value:boolean)=>{scissorTest=value;},
  getScissor:(out:Vector4)=>out.copy(scissor),setScissor:(value:Vector4)=>{scissor.copy(value);},
  readRenderTargetPixelsAsync:vi.fn(()=>{
   order.push('copy');return new Promise<Float32Array>((resolve,reject)=>deferred.push({resolve,reject}));
  }),
 });
 const gpu=renderer as unknown as WebGPURenderer;
 terrain.render(gpu,frame,[0,1,0]); // Prime the normal frame and shadow cache in this tiny mock.
 h.hooks.draw=()=>order.push('draw');
 h.hooks.clear=()=>clears.push({test:scissorTest,rect:terrain.target.scissor.toArray()});
 const pixels=Array.from({length:12},(_,i)=>({id:`p${i}`,x:100+i,y:200+i}));
 return {...h,terrain,frame,renderer,gpu,order,deferred,pixels,clears,scissorSnapshot:()=>({test:scissorTest,rect:scissor.toArray()})};
}

describe('receiver diagnostic sequencing on the existing target',()=>{
 it('queues all original/debug copies and restores ordinary state before waiting, with busy held until all reads settle',async()=>{
  const h=receiverFixture(),before=h.snapshot(),scissor=h.scissorSnapshot(),targetScissor=h.terrain.target.scissor.toArray();
  try{
   const job=h.terrain.probeShadowReceivers(h.gpu,h.frame,[0,1,0],h.pixels);
   expect(h.terrain.diagnosticActive).toBe(true);expect(h.deferred).toHaveLength(24);
   expect(h.order).toEqual([...Array(12).fill('copy'),'draw',...Array(12).fill('copy'),'draw']);
   expect(h.snapshot()).toEqual(before);expect(h.scissorSnapshot()).toEqual(scissor);
   expect(h.clears).toEqual([{test:false,rect:[0,0,2474,1844]},{test:false,rect:[0,0,2474,1844]}]);
   expect(h.terrain.target.scissor.toArray()).toEqual(targetScissor);expect(h.terrain.target.scissorTest).toBe(false);
   h.deferred.forEach((read,i)=>read.resolve(new Float32Array(i<12?[.2,.3,.4,10]:i===23?[-1000000,-1000000,-1000000,1]:[1000.25,1200.5,15,1])));
   const result=await job;
   expect(result.status).toBe('COMPLETE');expect(result.mode).toBe('lookup');expect(result.stateRestored).toBe(true);expect(result.debugDraws).toBe(1);
   expect(result.restoreDraws).toBe(1);expect(result.readbackRequests).toBe(24);expect(result.newFullTargetAllocations).toBe(0);
   expect(result.rows[0].debugRGBA).toEqual([1000.25,1200.5,15,1]);expect(result.rows[11].debugIsClear).toBe(true);expect(result.clearSentinelRGBA).toEqual([-1000000,-1000000,-1000000,1]);expect(result.rows.every(row=>row.originalRGBA?.length===4)).toBe(true);
   expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.terrain.dispose();}
 });
 it('drains already-submitted reads after a debug draw error and still restores normal state before awaiting',async()=>{
  const h=receiverFixture(),before=h.snapshot(),scissor=h.scissorSnapshot();let draws=0;
  h.hooks.draw=()=>{h.order.push('draw');if(draws++===0)throw new Error('debug draw failed');};
  try{
   const job=h.terrain.probeShadowReceivers(h.gpu,h.frame,[0,1,0],h.pixels);
   expect(h.deferred).toHaveLength(12);expect(h.terrain.diagnosticActive).toBe(true);
   expect(h.order).toEqual([...Array(12).fill('copy'),'draw','draw']);
   expect(h.snapshot()).toEqual(before);expect(h.scissorSnapshot()).toEqual(scissor);
   h.deferred.forEach((read,i)=>i===0?read.reject(new Error('original copy failed')):read.resolve(new Float32Array([0,0,0,10])));
   const result=await job;
   expect(result.status).toBe('ERROR');expect(result.stateRestored).toBe(true);
   expect(result.errors.some(e=>e.includes('debug draw failed'))).toBe(true);expect(result.errors.some(e=>e.includes('original copy failed'))).toBe(true);
   expect(result.rows.every(row=>row.debugRGBA===null)).toBe(true);expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.terrain.dispose();}
 });
 it('supports forced-lit with the same material/pipeline and24copies, reporting linear RGB plus finite receiver distance',async()=>{
  const h=receiverFixture(),material=h.terrain.material,fragment=material.fragmentNode,version=material.version;
  try{
   const job=h.terrain.probeShadowReceivers(h.gpu,h.frame,[0,1,0],h.pixels,'force-lit');
   expect(h.deferred).toHaveLength(24);expect(h.terrain.diagnosticActive).toBe(true);
   expect(h.order).toEqual([...Array(12).fill('copy'),'draw',...Array(12).fill('copy'),'draw']);
   expect(h.terrain.material).toBe(material);expect(material.fragmentNode).toBe(fragment);expect(material.version).toBe(version);
   h.deferred.forEach((read,i)=>read.resolve(new Float32Array(i<12?[.125,.25,.5,36]:[.25,.5,.75,36])));
   const result=await job;
   expect(result.status).toBe('COMPLETE');expect(result.mode).toBe('force-lit');expect(result.stateRestored).toBe(true);
   expect(result.debugChannels).toContain('A=unchanged receiver distance km');expect(result.readbackRequests).toBe(24);
   expect(result.rows.every(row=>row.originalRGBA?.[3]===36&&row.debugRGBA?.[3]===36&&row.debugRGBA.every(Number.isFinite))).toBe(true);
   expect(result.rows[0].debugRGBA).toEqual([.25,.5,.75,36]);expect(result.rows[0].debugIsClear).toBe(false);
   expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.terrain.dispose();}
 });
 it('rejects unknown modes before copies and drains all forced-lit reads if a returned distance is nonfinite',async()=>{
  const h=receiverFixture();
  try{
   await expect(h.terrain.probeShadowReceivers(h.gpu,h.frame,[0,1,0],h.pixels,'invalid' as never)).rejects.toThrow('probe mode');
   expect(h.deferred).toHaveLength(0);expect(h.terrain.diagnosticActive).toBe(false);
   const job=h.terrain.probeShadowReceivers(h.gpu,h.frame,[0,1,0],h.pixels,'force-lit');
   expect(h.deferred).toHaveLength(24);
   h.deferred.forEach((read,i)=>read.resolve(new Float32Array(i===12?[1,1,1,NaN]:[.25,.5,.75,36])));
   const result=await job;
   expect(result.status).toBe('ERROR');expect(result.mode).toBe('force-lit');expect(result.stateRestored).toBe(true);
   expect(result.rows[0].debugRGBA).toBeNull();expect(result.rows[11].debugRGBA?.[3]).toBe(36);
   expect(result.errors.some(error=>error.includes('four finite RGBA32F'))).toBe(true);expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.terrain.dispose();}
 });
});

describe('terrain shadow exact-input cache',()=>{
 it('draws cold once, restores caller state, and returns on an exact hit without mutating renderer state',()=>{
  const h=cacheFixture(),before=h.snapshot();
  try{
   h.shadow.render(h.gpu,[0,1,0]);expect(h.snapshot()).toEqual(before);expect(h.renderer.render).toHaveBeenCalledOnce();
   h.mutations.length=0;h.shadow.render(h.gpu,new Vector3(0,1,0));
   expect(h.mutations).toEqual([]);expect(h.snapshot()).toEqual(before);expect(h.renderer.clear).toHaveBeenCalledOnce();
   expect(h.shadow.stats().cache).toMatchObject({requests:2,submissions:1,hits:1,valid:true});
   expect(()=>h.shadow.render(h.gpu,[NaN,1,0])).toThrow('Nonfinite');
   h.box.makeEmpty();expect(()=>h.shadow.render(h.gpu,[0,1,0])).toThrow('Invalid terrain shadow caster bounds');
  }finally{h.shadow.dispose();}
 });
 it.each(['sun','bounds','renderer','reverse','resize-back','colour-version','depth-version','target-dispose','colour-dispose','depth-dispose','explicit'] as const)('requires a new draw after %s changes',kind=>{
  const h=cacheFixture(),sun=[0,1,0];let gpu=h.gpu;
  try{
   h.shadow.render(gpu,sun);h.shadow.render(gpu,sun);
   if(kind==='sun')sun[0]=.1; // same mutable input object, new value
   if(kind==='bounds')h.box.max.x+=.25; // same Box3, new component
   if(kind==='renderer')gpu=rendererFixture(h.scene).gpu;
   if(kind==='reverse')h.renderer.reversedDepthBuffer=true;
   if(kind==='resize-back'){h.shadow.target.setSize(1024,1024);h.shadow.target.setSize(2048,2048);}
   if(kind==='colour-version')h.shadow.texture.needsUpdate=true;
   if(kind==='depth-version')h.shadow.target.depthTexture!.needsUpdate=true;
   if(kind==='target-dispose')h.shadow.target.dispose();
   if(kind==='colour-dispose')h.shadow.texture.dispose();
   if(kind==='depth-dispose')h.shadow.target.depthTexture!.dispose();
   if(kind==='explicit')h.shadow.invalidate();
   h.shadow.render(gpu,sun);h.shadow.render(gpu,sun);
   expect(h.shadow.stats().cache).toMatchObject({requests:4,submissions:2,hits:2,valid:true});
  }finally{h.shadow.dispose();}
 });
 it('tracks new attachment identities, removes old listeners and commits first-bind versions after rendering',()=>{
  const h=cacheFixture();
  try{
   let first=true;h.hooks.draw=()=>{if(first){first=false;h.shadow.texture.needsUpdate=true;h.shadow.target.depthTexture!.needsUpdate=true;}};
   h.shadow.render(h.gpu,[0,1,0]);h.shadow.render(h.gpu,[0,1,0]);expect(h.renderer.render).toHaveBeenCalledOnce();
   const oldColour=h.shadow.texture,oldDepth=h.shadow.target.depthTexture!;
   h.shadow.target.texture=oldColour.clone();h.shadow.target.depthTexture=new DepthTexture(2048,2048,FloatType);
   h.shadow.render(h.gpu,[0,1,0]);h.shadow.render(h.gpu,[0,1,0]);expect(h.renderer.render).toHaveBeenCalledTimes(2);
   const invalidation=vi.spyOn(h.shadow,'invalidate');oldColour.dispose();oldDepth.dispose();
   expect(invalidation).not.toHaveBeenCalled();h.shadow.render(h.gpu,[0,1,0]);expect(h.renderer.render).toHaveBeenCalledTimes(2);
   h.shadow.target.depthTexture.dispose();h.shadow.render(h.gpu,[0,1,0]);expect(h.renderer.render).toHaveBeenCalledTimes(3);
  }finally{h.shadow.dispose();}
 });
 it('cannot reuse A after B cleared the target and its draw failed',()=>{
  const h=cacheFixture(),before=h.snapshot();
  try{
   h.shadow.render(h.gpu,[0,1,0]);h.hooks.draw=()=>{throw new Error('draw B failed after clear');};
   expect(()=>h.shadow.render(h.gpu,[1,1,0])).toThrow('draw B failed');expect(h.snapshot()).toEqual(before);expect(h.shadow.stats().cache.valid).toBe(false);
   h.hooks.draw=undefined;h.shadow.render(h.gpu,[0,1,0]);h.shadow.render(h.gpu,[0,1,0]);
   expect(h.renderer.clear).toHaveBeenCalledTimes(3);expect(h.renderer.render).toHaveBeenCalledTimes(3);
   expect(h.shadow.stats().cache).toMatchObject({submissions:3,hits:1,valid:true});
  }finally{h.shadow.dispose();}
 });
 it.each(['clear','restore'] as const)('does not commit after %s throws',stage=>{
  const h=cacheFixture();
  try{
   h.hooks[stage]=()=>{throw new Error(stage+' failed');};expect(()=>h.shadow.render(h.gpu,[0,1,0])).toThrow(stage+' failed');
   expect(h.shadow.stats().cache.valid).toBe(false);h.hooks[stage]=undefined;
   h.shadow.render(h.gpu,[0,1,0]);const calls=h.renderer.render.mock.calls.length;h.shadow.render(h.gpu,[0,1,0]);
   expect(h.renderer.render).toHaveBeenCalledTimes(calls);expect(h.shadow.stats().cache.valid).toBe(true);
  }finally{h.shadow.dispose();}
 });
 it.each(['draw','restore'] as const)('keeps an explicit invalidation during %s instead of overwriting it with a cache commit',stage=>{
  const h=cacheFixture();
  try{
   h.hooks[stage]=()=>h.shadow.invalidate();h.shadow.render(h.gpu,[0,1,0]);expect(h.shadow.stats().cache.valid).toBe(false);
   h.hooks[stage]=undefined;h.shadow.render(h.gpu,[0,1,0]);h.shadow.render(h.gpu,[0,1,0]);
   expect(h.renderer.render).toHaveBeenCalledTimes(2);expect(h.shadow.stats().cache).toMatchObject({hits:1,valid:true});
  }finally{h.shadow.dispose();}
 });
 it.each(['bounds','dimensions'] as const)('does not commit if %s changes during the draw without an explicit invalidation',kind=>{
  const h=cacheFixture();
  try{
   h.hooks.draw=()=>{if(kind==='bounds')h.box.max.x+=.1;else h.shadow.target.width=1024;};
   h.shadow.render(h.gpu,[0,1,0]);expect(h.shadow.stats().cache.valid).toBe(false);
   h.hooks.draw=undefined;h.shadow.render(h.gpu,[0,1,0]);h.shadow.render(h.gpu,[0,1,0]);expect(h.renderer.render).toHaveBeenCalledTimes(2);
  }finally{h.shadow.dispose();}
 });
 it('removes all dispose listeners and never revives a disposed owner',()=>{
  const h=cacheFixture();h.shadow.render(h.gpu,[0,1,0]);const invalidate=vi.spyOn(h.shadow,'invalidate'),targetDispose=vi.spyOn(h.shadow.target,'dispose'),materialDispose=vi.spyOn(h.shadow.material,'dispose');
  h.shadow.dispose();h.shadow.dispose();expect(targetDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();
  h.shadow.target.dispose();h.shadow.texture.dispose();h.shadow.target.depthTexture!.dispose();expect(invalidate).not.toHaveBeenCalled();
  expect(()=>h.shadow.render(h.gpu,[0,1,0])).toThrow('Terrain shadow disposed');expect(h.shadow.stats().cache.valid).toBe(false);
 });
});
