import {describe,expect,it,vi} from 'vitest';
import {BufferAttribute,Color,DepthTexture,FloatType,LinearFilter,RenderTarget,Texture,Vector4,WebGPUCoordinateSystem,type WebGPURenderer} from 'three/webgpu';
import {vec3} from 'three/tsl';
import {TerrainMesh,type TerrainCameraFrame,type TerrainRasterCacheInputs} from './terrainMesh';

const frame=():TerrainCameraFrame=>({origin:[0,2,8],forward:[0,0,-1],right:[1,0,0],up:[0,1,0],aspect:1.5,tanFov:.2867,inspection:0});
function fixture(enabled=true){
 const values=[.9,.8,.7,.1,.2,.3],textures=[new Texture(),new Texture()];
 const originalTextures=textures.slice(),descriptor:TerrainRasterCacheInputs={values,textures};
 const terrain=new TerrainMesh({cellsPerSide:8,levels:2,normalMode:'geometry',sample:()=>({heightKm:1,slopeX:0,slopeZ:0,coastKm:2}),
  shade:()=>vec3(.1,.2,.3),...(enabled?{cacheInputs:()=>descriptor}:{})});
 const previousTarget=new RenderTarget(3,2),previousMRT={caller:true},colour=new Color(.2,.3,.4);
 let target:RenderTarget|null=previousTarget,mrt:unknown=previousMRT,alpha=.4,depth=.37;
 const viewport=new Vector4(0,0,3,2),scissor=new Vector4(0,0,3,2);
 const hooks:{clear?:()=>void;draw?:()=>void;restore?:()=>void}={};
 const renderer={backend:{},reversedDepthBuffer:false,coordinateSystem:WebGPUCoordinateSystem,
  outputColorSpace:'srgb',toneMapping:0,toneMappingExposure:1,autoClear:true,scissorTest:false,
  getPixelRatio:()=>1,getViewport:(out:Vector4)=>out.copy(viewport),getScissor:(out:Vector4)=>out.copy(scissor),getScissorTest:()=>renderer.scissorTest,
  getRenderTarget:()=>target,getMRT:()=>mrt,getClearColor:(out:Color)=>out.copy(colour),getClearAlpha:()=>alpha,
  getClearDepth:()=>renderer.reversedDepthBuffer?1-depth:depth,
  setMRT:(value:unknown)=>{mrt=value;},setRenderTarget:(value:RenderTarget|null)=>{target=value;if(value===previousTarget)hooks.restore?.();},
  setClearColor:(value:Color|number,opacity:number)=>{colour.set(value);alpha=opacity;},setClearDepth:(value:number)=>{depth=value;},
  clear:vi.fn(()=>{if(target===terrain.target)hooks.clear?.();}),
  render:vi.fn((_scene:unknown,camera:unknown)=>{if(camera===terrain.camera)hooks.draw?.();}),
 };
 const gpu=renderer as unknown as WebGPURenderer;
 const snapshot=()=>({target,mrt,colour:colour.toArray(),alpha,depth,autoClear:renderer.autoClear});
 const camera=frame(),sun=[0,1,0];
 const draw=()=>terrain.render(gpu,camera,sun);
 const colourDraws=()=>renderer.render.mock.calls.filter(([,camera])=>camera===terrain.camera).length;
 return {terrain,renderer,gpu,hooks,descriptor,values,textures,viewport,scissor,camera,sun,draw,colourDraws,snapshot,
  dispose:()=>{terrain.dispose();previousTarget.dispose();for(const texture of new Set([...originalTextures,...textures]))texture.dispose();}};
}

describe('terrain colour/distance exact-input cache',()=>{
 it('keeps the ordinary target and caller state on a hit, while no descriptor stays live',()=>{
  const cached=fixture(),live=fixture(false);
  try{
   const before=cached.snapshot();cached.draw();cached.draw();
   expect(cached.snapshot()).toEqual(before);expect(cached.colourDraws()).toBe(1);
   expect(cached.terrain.stats().cache).toMatchObject({enabled:true,requests:2,submissions:1,hits:1,valid:true});
   expect(cached.terrain.stats().shadow.cache.submissions).toBe(1);
   live.draw();live.draw();expect(live.colourDraws()).toBe(2);
   expect(live.terrain.stats().cache).toMatchObject({enabled:false,requests:2,submissions:2,hits:0,valid:false});
  }finally{cached.dispose();live.dispose();}
 });
 it('does not treat unchanged Sun as unchanged ambient shading, and copies mutable descriptor values',()=>{
  const h=fixture();
  try{
   h.draw();h.draw();const shadowDraws=h.terrain.stats().shadow.cache.submissions;
   h.values[3]+=.01;h.draw();h.draw();
   expect(h.colourDraws()).toBe(2);expect(h.terrain.stats().cache.hits).toBe(2);
   expect(h.terrain.stats().shadow.cache.submissions).toBe(shadowDraws);
  }finally{h.dispose();}
 });
 it.each(['origin','forward','right','up','aspect','tanFov','inspection','near','far','sun','reverse','backend',
  'target-viewport','target-scissor','target-scissor-test','renderer-viewport','renderer-scissor','renderer-scissor-test',
  'resize-away-back','colour-version','depth-version','colour-object','depth-object','target-filter','target-samples',
  'normal-version','normal-object','position-array','index-version','material-version','material-side','mesh-matrix','mesh-position',
  'cover-version','cover-object','cover-filter','cover-wrap','cover-transform','cover-size','explicit','shadow-epoch','shadow-version'] as const)(
  'redraws rather than reusing stale radiance after %s changes',kind=>{
   const h=fixture();
   try{
    h.draw();h.draw();
    if(kind==='origin')h.camera.origin=[.01,2,8];
    if(kind==='forward')h.camera.forward=[.01,0,-1];
    if(kind==='right')h.camera.right=[1,0,.01];
    if(kind==='up')h.camera.up=[0,1,.01];
    if(kind==='aspect')h.camera.aspect=1.6;
    if(kind==='tanFov')h.camera.tanFov=.3;
    if(kind==='inspection')h.camera.inspection=.1;
    if(kind==='near')h.terrain.camera.near=.03;
    if(kind==='far')h.terrain.camera.far=1200;
    if(kind==='sun')h.sun[0]=.1;
    if(kind==='reverse')h.renderer.reversedDepthBuffer=true;
    if(kind==='backend')h.renderer.backend={};
    if(kind==='target-viewport')h.terrain.target.viewport.x=1;
    if(kind==='target-scissor')h.terrain.target.scissor.x=1;
    if(kind==='target-scissor-test')h.terrain.target.scissorTest=true;
    if(kind==='renderer-viewport')h.viewport.x=1;
    if(kind==='renderer-scissor')h.scissor.x=1;
    if(kind==='renderer-scissor-test')h.renderer.scissorTest=true;
    if(kind==='resize-away-back'){h.terrain.resize(4,3);h.terrain.resize(1,1);}
    if(kind==='colour-version')h.terrain.texture.needsUpdate=true;
    if(kind==='depth-version')h.terrain.target.depthTexture!.needsUpdate=true;
    if(kind==='colour-object')h.terrain.target.texture=h.terrain.texture.clone();
    if(kind==='depth-object')h.terrain.target.depthTexture=new DepthTexture(1,1,FloatType);
    if(kind==='target-filter')h.terrain.texture.minFilter=LinearFilter;
    if(kind==='target-samples')h.terrain.target.samples=4;
    if(kind==='normal-version')h.terrain.geometry.getAttribute('normal').needsUpdate=true;
    if(kind==='normal-object')h.terrain.geometry.setAttribute('normal',h.terrain.geometry.getAttribute('normal').clone());
    if(kind==='position-array'){const attribute=h.terrain.geometry.getAttribute('position') as BufferAttribute;attribute.array=new Float32Array(attribute.array);}
    if(kind==='index-version')h.terrain.geometry.index!.needsUpdate=true;
    if(kind==='material-version')h.terrain.material.needsUpdate=true;
    if(kind==='material-side')h.terrain.material.side=1;
    if(kind==='mesh-matrix')h.terrain.mesh.matrix.elements[12]=.01;
    if(kind==='mesh-position')h.terrain.mesh.position.x=.01;
    if(kind==='cover-version')h.textures[0].needsUpdate=true;
    if(kind==='cover-object')h.textures[0]=h.textures[0].clone();
    if(kind==='cover-filter')h.textures[0].minFilter=LinearFilter;
    if(kind==='cover-wrap')h.textures[0].wrapS=1000;
    if(kind==='cover-transform')h.textures[0].offset.x=.01;
    if(kind==='cover-size')h.textures[0].image={width:2,height:3};
    if(kind==='explicit')h.terrain.invalidate();
    if(kind==='shadow-epoch')h.terrain.shadow.invalidate();
    if(kind==='shadow-version')h.terrain.shadow.texture.needsUpdate=true;
    h.draw();expect(h.colourDraws()).toBe(2);h.draw();expect(h.colourDraws()).toBe(2);
    expect(h.terrain.stats().cache.valid).toBe(true);
   }finally{h.dispose();}
  });
 it('distinguishes renderer identity and invalidates caster data before asking the shadow cache',()=>{
  const h=fixture();
  try{
   h.draw();h.draw();const shadow=h.terrain.stats().shadow.cache.submissions;
   h.terrain.geometry.getAttribute('position').needsUpdate=true;h.draw();h.draw();
   expect(h.colourDraws()).toBe(2);expect(h.terrain.stats().shadow.cache.submissions).toBe(shadow+1);
   const other=Object.assign({},h.renderer,{backend:h.renderer.backend});
   h.terrain.render(other as unknown as WebGPURenderer,h.camera,h.sun);
   expect(h.colourDraws()).toBe(3);expect(h.terrain.stats().shadow.cache.submissions).toBe(shadow+2);
   const previous=h.terrain.stats().shadow.cache.submissions;h.terrain.invalidateGeometry();h.draw();
   expect(h.terrain.stats().shadow.cache.submissions).toBe(previous+1);
  }finally{h.dispose();}
 });
 it('accepts only first-bind owned attachment version increments, never later writes during a draw',()=>{
  const h=fixture();
  try{
   h.hooks.draw=()=>{h.terrain.texture.needsUpdate=true;h.terrain.target.depthTexture!.needsUpdate=true;};
   h.draw();expect(h.terrain.stats().cache.valid).toBe(true);h.hooks.draw=undefined;h.draw();expect(h.colourDraws()).toBe(1);
   h.values[0]+=.1;h.hooks.draw=()=>{h.terrain.texture.needsUpdate=true;};
   h.draw();expect(h.terrain.stats().cache.valid).toBe(false);h.hooks.draw=undefined;h.draw();h.draw();expect(h.colourDraws()).toBe(3);
  }finally{h.dispose();}
 });
 it.each(['clear','draw','restore'] as const)('a thrown colour %s never leaves an old entry reusable',stage=>{
  const h=fixture();
  try{
   h.draw();h.draw();h.values[0]+=.1;
   h.hooks[stage]=()=>{throw new Error('failed '+stage);};
   expect(h.draw).toThrow('failed '+stage);expect(h.terrain.stats().cache.valid).toBe(false);
   h.hooks[stage]=undefined;h.draw();const attempts=h.colourDraws();h.draw();expect(h.colourDraws()).toBe(attempts);
   expect(h.terrain.stats().cache.valid).toBe(true);
  }finally{h.hooks.restore=undefined;h.dispose();}
 });
 it.each(['shade','frame','epoch','position','material','cover','shadow'] as const)('does not commit a key invalidated during a draw by %s',kind=>{
  const h=fixture();
  try{
   h.draw();h.values[0]+=.1;
   h.hooks.draw=()=>{
    if(kind==='shade')h.values[3]+=.1;
    if(kind==='frame')h.camera.origin=[.1,2,8];
    if(kind==='epoch')h.terrain.invalidate();
    if(kind==='position')h.terrain.geometry.getAttribute('position').needsUpdate=true;
    if(kind==='material')h.terrain.material.needsUpdate=true;
    if(kind==='cover')h.textures[0].offset.x+=.1;
    if(kind==='shadow')h.terrain.shadow.invalidate();
   };
   h.draw();expect(h.terrain.stats().cache.valid).toBe(false);
   h.hooks.draw=undefined;h.draw();h.draw();expect(h.terrain.stats().cache.valid).toBe(true);
  }finally{h.dispose();}
 });
 it.each(['target','colour','depth','geometry','material','cover'] as const)('invalidates after %s disposal and releases listeners without owning cover textures',kind=>{
  const h=fixture();
  try{
   h.draw();h.draw();
   if(kind==='target')h.terrain.target.dispose();
   if(kind==='colour')h.terrain.texture.dispose();
   if(kind==='depth')h.terrain.target.depthTexture!.dispose();
   if(kind==='geometry')h.terrain.geometry.dispose();
   if(kind==='material')h.terrain.material.dispose();
   if(kind==='cover')h.textures[0].dispose();
   expect(h.terrain.stats().cache.valid).toBe(false);h.draw();h.draw();expect(h.colourDraws()).toBe(2);
   const borrowedDispose=vi.spyOn(h.textures[1],'dispose');h.terrain.dispose();h.terrain.dispose();expect(borrowedDispose).not.toHaveBeenCalled();
   expect(h.terrain.stats().cache.valid).toBe(false);expect(h.draw).toThrow('disposed');
   const epoch=h.terrain.stats().cache.epoch;h.textures[0].dispose();expect(h.terrain.stats().cache.epoch).toBe(epoch);
  }finally{h.dispose();}
 });
 it('removes listeners from replaced attachments and descriptor textures',()=>{
  const h=fixture(),oldColour=h.terrain.texture,oldCover=h.textures[0];
  try{
   h.draw();h.terrain.target.texture=oldColour.clone();h.textures[0]=oldCover.clone();h.draw();h.draw();
   const epoch=h.terrain.stats().cache.epoch,attempts=h.colourDraws();oldColour.dispose();oldCover.dispose();
   expect(h.terrain.stats().cache.epoch).toBe(epoch);h.draw();expect(h.colourDraws()).toBe(attempts);
  }finally{h.dispose();}
 });
 it('rejects nonfinite descriptor data and never confirms a stale key after descriptor failure',()=>{
  const h=fixture();
  try{
   h.draw();h.values[0]=NaN;expect(h.draw).toThrow('Invalid terrain raster cache inputs');expect(h.terrain.stats().cache.valid).toBe(false);
   h.values[0]=.9;h.draw();h.draw();expect(h.terrain.stats().cache.valid).toBe(true);
   const input=h.terrain.geometry.getAttribute('position') as BufferAttribute;
   expect(input.array).toBeInstanceOf(Float32Array);
  }finally{h.dispose();}
 });
});
