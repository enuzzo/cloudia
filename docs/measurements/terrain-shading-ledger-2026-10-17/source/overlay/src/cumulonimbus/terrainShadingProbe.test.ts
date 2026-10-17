import {afterEach,describe,expect,it,vi} from 'vitest';
import {Color,MeshBasicNodeMaterial,RenderTarget,Vector4,type Node,type WebGPURenderer} from 'three/webgpu';
import {vec3} from 'three/tsl';
import {TerrainMesh,type TerrainCameraFrame,type TerrainShadingLedgerShade} from './terrainMesh';

const frame:TerrainCameraFrame={origin:[3,4,5],forward:[0,0,-1],right:[1,0,0],up:[0,1,0],aspect:2474/1844,tanFov:.2867,inspection:.5};
const sun=[-.6,.75,.2];
const shades:readonly TerrainShadingLedgerShade[]=[
 {id:'macro-normal',shade:()=>vec3(0,1,0)},
 {id:'final-normal',shade:()=>vec3(.1,.9,.1)},
 {id:'factors',shade:()=>vec3(.3,.8,1)},
];
function deferred<T>(){
 let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;
 const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
function harness(){
 const terrain=new TerrainMesh({cellsPerSide:8,levels:1,spacingKm:.032,normalMode:'geometry',
  sample:()=>({heightKm:1,slopeX:0,slopeZ:0,coastKm:2}),shade:()=>vec3(.2,.3,.4)});
 terrain.resize(2474,1844);terrain.target.scissor.set(7,8,9,10);terrain.target.scissorTest=true;
 const events:string[]=[],previousTarget=new RenderTarget(2,2),previousMRT={} as Node;
 const state={target:previousTarget as RenderTarget|null,mrt:previousMRT as Node|null,colour:new Color(.2,.3,.4),alpha:.7,depth:.35,
  scissor:new Vector4(11,12,13,14),scissorTest:true};
 const readJobs:Array<ReturnType<typeof deferred<Float32Array>>>=[];
 const renderer={
  initialized:true,backend:{},reversedDepthBuffer:true,autoClear:true,
  getRenderTarget:()=>state.target,setRenderTarget:vi.fn((target:RenderTarget|null)=>{state.target=target;}),
  getMRT:()=>state.mrt,setMRT:vi.fn((value:Node|null)=>{state.mrt=value;}),
  getClearColor:(target:Color)=>target.copy(state.colour),getClearAlpha:()=>state.alpha,
  setClearColor:vi.fn((colour:Color|number,alpha:number)=>{state.colour.set(colour);state.alpha=alpha;}),
  getClearDepth:()=>1-state.depth,setClearDepth:vi.fn((value:number)=>{state.depth=value;}),
  getScissor:(target:Vector4)=>target.copy(state.scissor),setScissor:vi.fn((value:Vector4)=>{state.scissor.copy(value);}),
  getScissorTest:()=>state.scissorTest,setScissorTest:vi.fn((value:boolean)=>{state.scissorTest=value;}),
  clear:vi.fn(()=>{events.push('clear');}),
  render:vi.fn(()=>{
   const material=terrain.mesh.material as MeshBasicNodeMaterial;
   const mode=material===terrain.material?'ordinary':material.name.slice('Cloudia terrain ledger '.length);
   events.push(`draw:${mode}`);
   if(mode==='ordinary')expect(terrain.target.scissorTest).toBe(false);
  }),
  readRenderTargetPixelsAsync:vi.fn((_target:RenderTarget,x:number,y:number,width:number,height:number)=>{
   expect(_target).toBe(terrain.target);expect([width,height]).toEqual([1,1]);
   const read=deferred<Float32Array>();readJobs.push(read);events.push(`copy:${x},${y}`);return read.promise;
  }),
 };
 const shadowRender=vi.spyOn(terrain.shadow,'render').mockImplementation(()=>{events.push('shadow-render');});
 const shadowInvalidate=vi.spyOn(terrain.shadow,'invalidate');
 const dispose=vi.spyOn(MeshBasicNodeMaterial.prototype,'dispose');
 const drainJob=deferred<unknown>();
 const drain=vi.fn(()=>{events.push('drain');expect(terrain.mesh.material).toBe(terrain.material);return drainJob.promise;});
 const run=(nextShades=shades)=>terrain.probeShadingLedger(renderer as unknown as WebGPURenderer,frame,sun,nextShades,drain);
 const finishReads=(value=new Float32Array([.1,.2,.3,4]))=>{for(const job of readJobs)job.resolve(value);};
 const release=()=>{terrain.dispose();previousTarget.dispose();};
 return {terrain,renderer,state,events,readJobs,drain,drainJob,run,finishReads,release,shadowRender,shadowInvalidate,dispose,previousTarget,previousMRT};
}
afterEach(()=>vi.restoreAllMocks());

describe('installed terrain shading ledger readback ownership',()=>{
 it('queues twelve copies after each diagnostic draw and restores everything before its first await/drain',async()=>{
  const h=harness(),ordinaryNode=h.terrain.material.fragmentNode,ordinaryVersion=h.terrain.material.version,geometry=h.terrain.geometry;
  try{
   const job=h.run();
   expect(h.events.filter(event=>event.startsWith('draw:'))).toEqual(['draw:macro-normal','draw:final-normal','draw:factors','draw:ordinary']);
   for(const [mode,start] of [['macro-normal',0],['final-normal',12],['factors',24]] as const){
    const drawIndex=h.events.indexOf(`draw:${mode}`),nextDraw=h.events.findIndex((event,index)=>index>drawIndex&&event.startsWith('draw:'));
    expect(h.events.slice(drawIndex+1,nextDraw).filter(event=>event.startsWith('copy:'))).toHaveLength(12);
    expect(h.renderer.readRenderTargetPixelsAsync.mock.calls[start].slice(1)).toEqual([71,856,1,1]);
   }
   expect(h.events.at(-1)).toBe('drain');expect(h.events.indexOf('draw:ordinary')).toBeLessThan(h.events.indexOf('drain'));
   expect(h.terrain.diagnosticActive).toBe(true);expect(h.dispose).not.toHaveBeenCalled();
   expect(h.terrain.mesh.material).toBe(h.terrain.material);expect(h.terrain.material.fragmentNode).toBe(ordinaryNode);expect(h.terrain.material.version).toBe(ordinaryVersion);
   expect(h.terrain.mesh.geometry).toBe(geometry);expect(h.shadowRender).toHaveBeenCalledOnce();expect(h.shadowInvalidate).toHaveBeenCalledOnce();
   expect(h.state.target).toBe(h.previousTarget);expect(h.state.mrt).toBe(h.previousMRT);
   expect(h.state.colour.toArray()).toEqual([.2,.3,.4]);expect(h.state.alpha).toBe(.7);expect(h.state.depth).toBeCloseTo(.35,15);
   expect(h.state.scissor.toArray()).toEqual([11,12,13,14]);expect(h.state.scissorTest).toBe(true);expect(h.renderer.autoClear).toBe(true);
   expect(h.terrain.target.scissor.toArray()).toEqual([7,8,9,10]);expect(h.terrain.target.scissorTest).toBe(true);
   const offset=new ArrayBuffer(24),view=new DataView(offset);view.setUint32(4,0x80000000,true);view.setFloat32(8,.2,true);view.setFloat32(12,.3,true);view.setFloat32(16,4,true);
   h.finishReads(new Float32Array(offset,4,4));await Promise.resolve();await Promise.resolve();
   expect(h.terrain.diagnosticActive).toBe(true);expect(h.dispose).not.toHaveBeenCalled();h.drainJob.resolve('completed');
   const result=await job;
   expect(result.status).toBe('COMPLETE');expect(result.stateRestored).toBe(true);expect(result.inputsStable).toBe(true);expect(result.errors).toEqual([]);
   expect(result.bbox).toEqual({x:64,y:610,width:2137,height:491,pixels:1049267});
   expect(result.readbackRequests).toBe(36);expect(result.diagnosticDraws).toBe(3);expect(result.restoreDraws).toBe(1);
   expect(result.drain).toMatchObject({requested:true,settled:true,status:'fulfilled',value:'completed'});
   expect(result.rows).toHaveLength(12);expect(result.rows[0].records['macro-normal']!.bits[0]).toBe(0x80000000);
   expect(Object.is(result.rows[0].records['macro-normal']!.rgba[0],-0)).toBe(true);
   expect(h.terrain.diagnosticActive).toBe(false);expect(h.dispose).toHaveBeenCalledTimes(3);
   expect(h.dispose.mock.contexts.every(material=>material!==h.terrain.material&&material!==h.terrain.shadow.material)).toBe(true);
  }finally{h.release();}
 });

 it('holds busy and all clones until every read and the owner drain settle, including a rejected prefix',async()=>{
  const h=harness();
  try{
   const job=h.run();h.readJobs[0].reject(new Error('read failed'));
   for(const read of h.readJobs.slice(1,-1))read.resolve(new Float32Array([.1,.2,.3,4]));
   h.drainJob.resolve(undefined);await Promise.resolve();await Promise.resolve();
   expect(h.terrain.diagnosticActive).toBe(true);expect(h.dispose).not.toHaveBeenCalled();
   await expect(h.run()).rejects.toThrow('already active');
   h.readJobs.at(-1)!.resolve(new Float32Array([.1,.2,.3,4]));const result=await job;
   expect(result.status).toBe('ERROR');expect(result.errors.some(error=>error.includes('read failed'))).toBe(true);
   expect(result.rows[0].records['macro-normal']).toBeNull();expect(result.rows.at(-1)!.records.factors).not.toBeNull();
   expect(h.dispose).toHaveBeenCalledTimes(3);expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.release();}
 });

 it('drains already queued copies and restores ordinary after a synchronous partial-copy failure',async()=>{
  const h=harness(),original=h.renderer.readRenderTargetPixelsAsync.getMockImplementation()!;
  h.renderer.readRenderTargetPixelsAsync.mockImplementation((...args)=>{
   if(h.readJobs.length===5)throw new Error('copy enqueue failed');return original(...args);
  });
  try{
   const job=h.run();expect(h.readJobs).toHaveLength(5);expect(h.events).toContain('draw:ordinary');expect(h.drain).toHaveBeenCalledOnce();expect(h.dispose).not.toHaveBeenCalled();
   h.finishReads();h.drainJob.resolve(undefined);const result=await job;
   expect(result.status).toBe('ERROR');expect(result.stateRestored).toBe(true);expect(result.readbackRequests).toBe(5);
   expect(result.errors.some(error=>error.includes('copy enqueue failed'))).toBe(true);expect(h.dispose).toHaveBeenCalledTimes(3);
  }finally{h.release();}
 });

 it('attempts every renderer-state restore and drain even when the full ordinary redraw fails',async()=>{
  const h=harness(),draw=h.renderer.render.getMockImplementation()!;
  h.renderer.render.mockImplementation(()=>{draw();if(h.terrain.mesh.material===h.terrain.material)throw new Error('ordinary draw failed');});
  try{
   const job=h.run();expect(h.state.target).toBe(h.previousTarget);expect(h.state.mrt).toBe(h.previousMRT);expect(h.state.scissor.toArray()).toEqual([11,12,13,14]);
   expect(h.state.alpha).toBe(.7);expect(h.drain).toHaveBeenCalledOnce();expect(h.dispose).not.toHaveBeenCalled();
   h.finishReads();h.drainJob.resolve(undefined);const result=await job;
   expect(result.status).toBe('ERROR');expect(result.stateRestored).toBe(false);expect(result.errors.some(error=>error.includes('ordinary draw failed'))).toBe(true);
   expect(h.dispose).toHaveBeenCalledTimes(3);
  }finally{h.release();}
 });

 it.each([
  ['nonfinite',new Float32Array([NaN,.2,.3,4]),'Nonfinite'],
  ['sentinel',new Float32Array([-8192,-8192,-8192,1]),'clear sentinel'],
  ['miss',new Float32Array([0,0,0,-1]),'positive receiver distance'],
  ['zero distance',new Float32Array([0,0,0,0]),'positive receiver distance'],
  ['wrong shape',new Float32Array(8),'exactly four'],
 ] as const)('rejects %s records without suppressing the sibling reads',async(_label,value,errorText)=>{
  const h=harness();
  try{
   const job=h.run();h.readJobs[0].resolve(value);for(const read of h.readJobs.slice(1))read.resolve(new Float32Array([.1,.2,.3,4]));h.drainJob.resolve(undefined);
   const result=await job;expect(result.status).toBe('ERROR');expect(result.errors.some(error=>error.includes(errorText))).toBe(true);
   expect(result.rows.at(-1)!.records.factors).not.toBeNull();expect(h.dispose).toHaveBeenCalledTimes(3);
  }finally{h.release();}
 });

 it.each(['reject','throw'] as const)('drains all reads when the owner drain %s fails',async(mode)=>{
  const h=harness();if(mode==='throw')h.drain.mockImplementation(()=>{throw new Error('drain failed');});
  try{
   const job=h.run();if(mode==='reject')h.drainJob.reject(new Error('drain failed'));h.finishReads();const result=await job;
   expect(result.status).toBe('ERROR');expect(result.drain).toMatchObject({requested:true,settled:true,status:'rejected',error:'drain failed'});
   expect(result.rows.every(row=>row.records.factors!==null)).toBe(true);expect(h.dispose).toHaveBeenCalledTimes(3);
  }finally{h.release();}
 });

 it('marks a changed geometry version unqualified while retaining every completed record',async()=>{
  const h=harness();
  try{
   const job=h.run();h.terrain.geometry.getAttribute('normal').needsUpdate=true;h.finishReads();h.drainJob.resolve(undefined);const result=await job;
   expect(result.inputsStable).toBe(false);expect(result.status).toBe('ERROR');expect(result.rows.every(row=>row.records.factors!==null)).toBe(true);
  }finally{h.release();}
 });

 it('rejects malformed modes or a foreign mesh material before target writes or allocations',async()=>{
  const h=harness();
  try{
   await expect(h.run([...shades].reverse())).rejects.toThrow('fixed modes');
   const borrowed=new MeshBasicNodeMaterial();h.terrain.mesh.material=borrowed;
   await expect(h.run()).rejects.toThrow('installed ordinary');h.terrain.mesh.material=h.terrain.material;borrowed.dispose();
   expect(h.renderer.clear).not.toHaveBeenCalled();expect(h.renderer.readRenderTargetPixelsAsync).not.toHaveBeenCalled();expect(h.drain).not.toHaveBeenCalled();expect(h.terrain.diagnosticActive).toBe(false);
  }finally{h.release();}
 });
});
