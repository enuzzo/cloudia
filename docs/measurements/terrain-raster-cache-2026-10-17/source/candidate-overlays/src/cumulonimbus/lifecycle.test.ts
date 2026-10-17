import {Blob as NodeBlob} from 'node:buffer';
import {webcrypto,createHash} from 'node:crypto';
import {setImmediate as nativeTestImmediate} from 'node:timers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {Texture} from 'three/webgpu';
import type {TerrainCameraFrame,TerrainMeshConfiguration} from './terrainMesh';
type MockTimestampKind='render'|'compute';
interface MockTimestampPool {
 currentQueryIndex:number;pendingResolve:false|null|Promise<number>;lastValue:number;frames:number[];
 queryOffsets:Map<string,number>;timestamps:Map<string,number>;durations:Map<string,number>;
}
interface MockRendererControl {
 dispose:ReturnType<typeof vi.fn>;onDeviceLost:()=>void;initialized:boolean;
 info:{frame:number;render:{frameCalls:number;timestamp:number};compute:{frameCalls:number;timestamp:number}};
 recordRenderPasses:()=>void;
}
interface MockTerrainControl {
 texture:Texture;configuration:TerrainMeshConfiguration;
 resize:ReturnType<typeof vi.fn>;render:ReturnType<typeof vi.fn>;surfaceY:ReturnType<typeof vi.fn>;
 dispose:ReturnType<typeof vi.fn>;stats:ReturnType<typeof vi.fn>;
}
const control = vi.hoisted(()=>({initResolve:()=>{},renderer:null as MockRendererControl|null,
 terrain:[] as MockTerrainControl[],
 workers:[] as Array<{onmessage:((event:unknown)=>void)|null;terminate:ReturnType<typeof vi.fn>}>,
 render:vi.fn(),compute:vi.fn(),originalLost:vi.fn(),timestamps:false,
 timestampJobs:[] as Array<{kind:MockTimestampKind;uids:string[];finish:()=>void}>}));
vi.mock('three/webgpu',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('three/webgpu')>();
  const pool=():MockTimestampPool=>({currentQueryIndex:0,pendingResolve:false,lastValue:0,frames:[],queryOffsets:new Map(),timestamps:new Map(),durations:new Map()});
  return {...actual,WebGPURenderer:class {
    backend={isWebGPUBackend:true,timestampQueryPool:{render:pool(),compute:pool()}};
    info={frame:41,render:{frameCalls:0,timestamp:0},compute:{frameCalls:0,timestamp:0}};
    domElement=document.createElement('canvas');initialized=false;
    dispose=vi.fn();onDeviceLost=control.originalLost;
    constructor(options?:{canvas?:HTMLCanvasElement}) {if(options?.canvas)this.domElement=options.canvas;control.renderer=this;}
    async init() {await new Promise<void>(resolve=>{control.initResolve=resolve;});this.initialized=true;}
    hasFeature(name:string) {return control.timestamps&&name==='timestamp-query';}
    private recordPass(kind:MockTimestampKind,context:string,duration:number){
      if(!control.timestamps)return;
      const state=this.info[kind],queries=this.backend.timestampQueryPool[kind];
      const uid=`${kind==='render'?'r':'c'}:${++state.frameCalls}:${context}:f${this.info.frame}`;
      queries.queryOffsets.set(uid,queries.currentQueryIndex);queries.currentQueryIndex+=2;queries.durations.set(uid,duration);
    }
    compute=(...args:unknown[])=>{control.compute(...args);this.recordPass('compute','flow',.25);};
    recordRenderPasses=()=>{this.recordPass('render','cloud',2);this.recordPass('render','output',5);};
    async resolveTimestampsAsync(kind:MockTimestampKind):Promise<number>{
      const queries=this.backend.timestampQueryPool[kind];let duration:number;
      if(queries.currentQueryIndex===0)duration=queries.lastValue;
      else if(queries.pendingResolve)duration=await queries.pendingResolve;
      else{
        const captured=[...queries.queryOffsets].map(([uid])=>[uid,queries.durations.get(uid)!] as const);
        queries.currentQueryIndex=0;queries.queryOffsets.clear();queries.durations.clear();
        const pending=new Promise<number>(resolve=>{
          let finished=false;
          control.timestampJobs.push({kind,uids:captured.map(([uid])=>uid),finish:()=>{
            if(finished)return;finished=true;queries.timestamps=new Map(captured);
            queries.frames=[...new Set(captured.map(([uid])=>Number(uid.slice(uid.lastIndexOf(':f')+2))))];
            const last=queries.frames.at(-1);queries.lastValue=captured.filter(([uid])=>uid.endsWith(`:f${last}`)).reduce((sum,[,ms])=>sum+ms,0);
            resolve(queries.lastValue);
          }});
        });
        queries.pendingResolve=pending;
        try{duration=await pending;}finally{queries.pendingResolve=null;}
      }
      this.info[kind].timestamp=duration;return duration;
    }
    setPixelRatio() {} setSize(width:number,height:number) {this.domElement.width=width;this.domElement.height=height;}
  },QuadMesh:class {render(renderer:MockRendererControl){control.render(renderer);renderer.recordRenderPasses();}}};
});
// These tests exercise Engine ownership, not terrain construction/rasterization.
// Keep a real lightweight texture for the TSL binding, with no mesh or GPU work.
vi.mock('./terrainMesh',async()=>{
 const {DataTexture,FloatType,RGBAFormat}=await import('three/webgpu');
 return {TerrainMesh:class {
  readonly texture=new DataTexture(new Float32Array([0,0,0,-1]),1,1,RGBAFormat,FloatType);
  private width=1;private height=1;
  resize=vi.fn((width:number,height:number)=>{this.width=width;this.height=height;this.texture.image.width=width;this.texture.image.height=height;});
  render=vi.fn((_renderer:MockRendererControl,_frame:TerrainCameraFrame,_sunVector:TerrainCameraFrame['origin'])=>{});
  surfaceY=vi.fn((_x:number,_z:number)=>-4);
  dispose=vi.fn(()=>this.texture.dispose());
  stats=vi.fn(()=>({vertices:4,triangles:2,stitchedCells:0,levels:1,cellsPerSide:4,baseSpacingKm:1,outerExtentKm:2,
   geometryBytes:152,sampleCalls:4,minimumHeightKm:0,maximumHeightKm:1,
   geometryScope:'Isolated lifecycle mock; no mesh construction',width:this.width,height:this.height,
   colourFormat:'rgba32float',distanceComponent:'alpha; km from actual camera origin; -1 miss',
   colourDistanceBytes:this.width*this.height*16,depthBytes:this.width*this.height*4,targetPayloadBytes:this.width*this.height*20,
   memoryScope:'Mock target accounting only',perFrameCpuHeightSamples:0,nearKm:.025,farKm:1600,cache:'Live mock render'}));
  constructor(readonly configuration:TerrainMeshConfiguration){control.terrain.push(this);}
 }};
});
vi.mock('./terrainDem',async()=>{
 const actual=await vi.importActual<typeof import('./terrainDem')>('./terrainDem');
 return {...actual,loadTerrainDem:vi.fn(async()=>({side:3,spacingKm:64,minX:-64,minZ:-64,heights:new Uint16Array(9),coast:new Int16Array(9)}))};
});
vi.mock('./terrainCover',async()=>{
 const actual=await vi.importActual<typeof import('./terrainCover')>('./terrainCover');
 return {...actual,loadTerrainCover:vi.fn(async()=>{const fractions=new Uint8Array(48);for(let i=0;i<4;i++)fractions[i*12]=255;return {side:2,spacingKm:64,minX:-64,minZ:-64,fractions};})};
});
import { CumulonimbusApp } from './CumulonimbusApp';
import { BufferGeometry,Float32BufferAttribute,Data3DTexture,NearestFilter,LinearFilter,ClampToEdgeWrapping,NoColorSpace,RedFormat,UnsignedByteType } from 'three/webgpu';
import * as cloudShader from './cloudShader';
import {loadTerrainDem,type TerrainDem} from './terrainDem';
import {loadTerrainCover,type TerrainCover} from './terrainCover';
import type { CloudVolume } from './volume';
import type {NarrowCloudMask} from './narrowCloud';
import type {DensityR8} from './densityR8';
import type {TimestampBatchMeasurementReport} from './timestampBatchMeasurement';
async function flush() {for(let i=0;i<15;i++) await Promise.resolve();}
const device={destroy:vi.fn(),queue:{onSubmittedWorkDone:vi.fn(()=>Promise.resolve())}};
beforeEach(()=>{
  vi.clearAllMocks(); control.renderer=null; control.workers=[];control.terrain=[];control.timestamps=false;control.timestampJobs=[];
  device.queue.onSubmittedWorkDone.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({info:{vendor:'test'},features:new Set(control.timestamps?['timestamp-query']:[]),requestDevice:async()=>device})}});
  vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1)); vi.stubGlobal('cancelAnimationFrame',vi.fn());
  vi.stubGlobal('Worker',class {
    onmessage:((event:unknown)=>void)|null=null; terminate=vi.fn();
    constructor() {control.workers.push(this);} postMessage() {}
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';history.replaceState(null,'','/');});
function createApp() {const root=document.createElement('main');document.body.append(root);return {app:new CumulonimbusApp(root),root};}
function cloudVolume():CloudVolume {
  return {size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}};
}
function cloudWithNarrow(value=255):CloudVolume & {narrowMask:NarrowCloudMask;densityR8:DensityR8}{
  return {...cloudVolume(),narrowMask:{size:1,data:new Uint8Array([value])},densityR8:{size:1,data:new Uint8Array([0])}};
}
function textureDisposals(contexts:readonly unknown[],data:Uint8Array){
  return contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===data).length;
}
function expectNarrowTexture(value:unknown,data?:Uint8Array):Data3DTexture{
  expect(value).toBeInstanceOf(Data3DTexture);
  if(!(value instanceof Data3DTexture))throw new Error('Expected the bound narrow Data3DTexture.');
  expect(value.format).toBe(RedFormat);expect(value.type).toBe(UnsignedByteType);
  expect(value.colorSpace).toBe(NoColorSpace);
  expect(value.minFilter).toBe(NearestFilter);expect(value.magFilter).toBe(NearestFilter);
  expect(value.generateMipmaps).toBe(false);expect(value.unpackAlignment).toBe(1);
  expect([value.image.width,value.image.height,value.image.depth]).toEqual([1,1,1]);
  if(data)expect(value.image.data).toBe(data);
  return value;
}
function expectDensityTexture(value:unknown,data:Uint8Array):Data3DTexture{
  if(!(value instanceof Data3DTexture))throw new Error('Expected the bound density R8 texture.');
  expect(value.image.data).toBe(data);expect(value.format).toBe(RedFormat);expect(value.type).toBe(UnsignedByteType);
  expect(value.colorSpace).toBe(NoColorSpace);expect(value.generateMipmaps).toBe(false);expect(value.flipY).toBe(false);
  expect(value.minFilter).toBe(LinearFilter);expect(value.magFilter).toBe(LinearFilter);
  expect([value.wrapS,value.wrapT,value.wrapR]).toEqual([ClampToEdgeWrapping,ClampToEdgeWrapping,ClampToEdgeWrapping]);
  expect(value.unpackAlignment).toBe(1);return value;
}
type DensitySamplingSnapshot={path:string;format:string;dimensions:number[];textureBytes:number;extraCpuPayloadBytes:number;extraGpuPayloadBytes:number;fallback:string|null;reason:string;allocationAccounting:string};
function terrainComponents(value:TerrainCameraFrame['origin']):number[]{
 return 'x' in value?[value.x,value.y,value.z]:Array.from(value);
}
const nativePNGBytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=','base64'));
const nativePNG=()=>new NodeBlob([nativePNGBytes],{type:'image/png'}) as unknown as Blob;
type NativeTestDTO={schema:string;requestId:number;png:{width:number;height:number;sha256:string};metadata:{
 seed:number;quality:string;nominalSteps:number;stepSizeKm:number;output:number[];internal:number[];canvas:number[];
 frame:{ownerDrawSerial:number;rafTimestamp:number};camera:{origin:number[]};
 flowMode:string;flowComputeThisDraw:boolean;clocks:{simulationTime:number;forcingTime:number;precipitationUniformTime:number;flowUniformTime:number;flowFieldTime:number};
}};
function nativeButton(root:HTMLElement,action:string){return root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;}
function nativeSelect(root:HTMLElement,name:string,value:string){const select=root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}
function nativeStatus(root:HTMLElement){return root.querySelector<HTMLElement>('[data-testid="frame-export-status"]')!;}
function nativeData(root:HTMLElement):NativeTestDTO{return JSON.parse(root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-json"]')!.value) as NativeTestDTO;}
async function settleNative(){await flush();await new Promise<void>(resolve=>nativeTestImmediate(resolve));await flush();}
async function startNativeFixture(search='/?profile=1&timing=off&flow=frozen&seed=74'){
 history.replaceState(null,'',search);vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const clock={value:1000};vi.spyOn(performance,'now').mockImplementation(()=>clock.value);
 const {app,root}=createApp();Object.defineProperties(root,{clientWidth:{configurable:true,value:1},clientHeight:{configurable:true,value:1}});
 const starting=app.start();await flush();control.initResolve();await flush();control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
 const canvas=root.querySelector<HTMLCanvasElement>('canvas')!,frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
 nativeSelect(root,'output','window');
 return {app,root,canvas,clock,draw:(time:number)=>{clock.value=time;frame(time);}};
}

describe('whole terrain cache audit lifecycle',()=>{
 beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);});
 it('requires the explicit profile audit UI and rejects an animated scene before GPU readback',async()=>{
  const {app,root,draw}=await startNativeFixture('/?profile=1&terrainAudit=1&timing=off&flow=frozen&seed=74');
  const read=vi.fn();Object.defineProperty(control.renderer!,'readRenderTargetPixelsAsync',{value:read});
  try{
   draw(1000);expect(nativeButton(root,'terrain-cache-audit').disabled).toBe(false);
   nativeButton(root,'terrain-cache-audit').click();await flush();
   expect(read).not.toHaveBeenCalled();expect(root.querySelector('[data-testid="gpu-report-json"]')).not.toBeNull();
   expect(root.textContent).toContain('Fissa la scena');
  }finally{app.destroy();await settleNative();}
 });
 it('waits for a pending readback before disposing its target owner and skips the second read after destruction',async()=>{
  const {app,root,draw}=await startNativeFixture('/?profile=1&terrainAudit=1&timing=off&flow=frozen&seed=74');
  const renderer=control.renderer!,terrain=control.terrain[0],geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([0,0,0],3));
  Object.defineProperties(terrain,{target:{value:{texture:terrain.texture,width:1,height:1}},geometry:{value:geometry},invalidate:{value:vi.fn()}});
  let release!:(value:Float32Array)=>void;
  const read=vi.fn(()=>new Promise<Float32Array>(resolve=>{release=resolve;}));Object.defineProperty(renderer,'readRenderTargetPixelsAsync',{value:read});
  try{
   nativeButton(root,'probe-reference').click();await flush();draw(1000);draw(4000);
   nativeSelect(root,'output','1080');nativeButton(root,'terrain-cache-audit').click();await flush();
   expect(read).not.toHaveBeenCalled();expect(root.textContent).toContain('Attendi un disegno ordinario');
   draw(4500);nativeButton(root,'terrain-cache-audit').click();await flush();expect(read).toHaveBeenCalledOnce();
   const draws=control.render.mock.calls.length;draw(5000);expect(control.render).toHaveBeenCalledTimes(draws);
   expect(nativeButton(root,'frame-capture').disabled).toBe(true);expect(nativeButton(root,'benchmark').disabled).toBe(true);
   app.destroy();await flush();expect(renderer.dispose).not.toHaveBeenCalled();expect(terrain.dispose).not.toHaveBeenCalled();
   release(new Float32Array([0,0,0,-1]));await settleNative();await vi.waitFor(()=>expect(renderer.dispose).toHaveBeenCalledOnce());
   expect(terrain.dispose).toHaveBeenCalledOnce();expect(read).toHaveBeenCalledOnce();
   expect(root.querySelector<HTMLTextAreaElement>('[data-testid="gpu-report-json"]')!.value).toBe('');
  }finally{release?.(new Float32Array([0,0,0,-1]));app.destroy();geometry.dispose();await settleNative();}
 });
});

describe('native PNG export engine/App lifecycle regression',()=>{
 beforeEach(()=>{vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('crypto',webcrypto);});
 it('acquires only after the next quad draw and keeps that draw DTO while later frames continue',async()=>{
  const bindings:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
  vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,narrow,r8)=>new Proxy(original(mode,narrow,r8),{
   apply(target,thisArg,args){bindings.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);},
  }));
  const {app,root,canvas,draw}=await startNativeFixture();
  let callback!:(blob:Blob|null)=>void,drawOrigin:number[]=[];
  const encoder=vi.fn((done:(blob:Blob|null)=>void)=>{callback=done;drawOrigin=(bindings.at(-1)!.origin as {value:{toArray:()=>number[]}}).value.toArray();});
  Object.defineProperty(canvas,'toBlob',{configurable:true,value:encoder});
  try{
   const renderCount=control.render.mock.calls.length;nativeButton(root,'frame-capture').click();
   expect(nativeStatus(root).dataset.state).toBe('pending');expect(encoder).not.toHaveBeenCalled();
   expect(nativeButton(root,'benchmark').disabled).toBe(true);
   draw(1000);expect(control.render).toHaveBeenCalledTimes(renderCount+1);expect(encoder).toHaveBeenCalledOnce();
   expect(control.render.mock.invocationCallOrder.at(-1)!).toBeLessThan(encoder.mock.invocationCallOrder[0]);
   expect([canvas.width,canvas.height]).toEqual([1,1]);
   nativeButton(root,'zoom-in').click();draw(2000); // mutate live camera/time before PNG callback
   callback(nativePNG());await vi.waitFor(()=>expect(nativeStatus(root).dataset.state).toBe('ready'));
   const result=nativeData(root);expect(result.schema).toBe('cloudia-native-frame-v1');
   expect(result.metadata.frame).toMatchObject({ownerDrawSerial:1,rafTimestamp:1000});
   expect(result.metadata.camera.origin).toEqual(drawOrigin);
   expect(result.metadata.camera.origin).not.toEqual((bindings.at(-1)!.origin as {value:{toArray:()=>number[]}}).value.toArray());
   expect(result.metadata.clocks.simulationTime).toBe(60);
   expect(result.png).toMatchObject({width:1,height:1,sha256:createHash('sha256').update(nativePNGBytes).digest('hex')});
   expect(root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-png"]')!.value).toBe(`data:image/png;base64,${Buffer.from(nativePNGBytes).toString('base64')}`);
   expect(encoder).toHaveBeenCalledOnce();
  }finally{app.destroy();await settleNative();}
 });
 it('captures applied native128/ultra384 at identical dimensions with the actual pre-forcing precipitation and frozen-field clocks',async()=>{
  const {app,root,canvas,draw}=await startNativeFixture();
  const encoder=vi.fn((done:(blob:Blob|null)=>void)=>done(nativePNG()));Object.defineProperty(canvas,'toBlob',{configurable:true,value:encoder});
  try{
   draw(1000);const initialCompute=control.compute.mock.calls.length;
   nativeSelect(root,'quality','native');nativeButton(root,'frame-capture').click();expect(encoder).not.toHaveBeenCalled();
   draw(2000);await vi.waitFor(()=>expect(nativeStatus(root).dataset.state).toBe('ready'));const native=nativeData(root).metadata;
   expect(native).toMatchObject({quality:'native',nominalSteps:128,output:[1,1],internal:[1,1],canvas:[1,1],flowMode:'frozen',flowComputeThisDraw:false});
   expect(native.stepSizeKm).toBe(7/128);expect(native.clocks).toMatchObject({forcingTime:0,precipitationUniformTime:0,flowFieldTime:60});
   expect(native.clocks.flowUniformTime).toBe(60);expect(native.clocks.simulationTime).toBe(60);
   draw(2500); // first ordinary interval after applySize reset its interval anchor
   nativeSelect(root,'quality','ultra');nativeButton(root,'frame-capture').click();draw(3000);
   await vi.waitFor(()=>expect(nativeStatus(root).dataset.state).toBe('ready'));const ultra=nativeData(root).metadata;
   expect(ultra).toMatchObject({quality:'ultra',nominalSteps:384,output:[1,1],internal:[1,1],canvas:[1,1],flowMode:'frozen',flowComputeThisDraw:false});
   expect(ultra.stepSizeKm).toBe(7/384);expect(ultra.clocks).toMatchObject({forcingTime:.5,precipitationUniformTime:.5,flowFieldTime:60});
   expect(ultra.clocks.flowUniformTime).toBeCloseTo(60.05,10);expect(control.compute).toHaveBeenCalledTimes(initialCompute);
   expect(ultra.frame.rafTimestamp).toBe(3000);expect(encoder).toHaveBeenCalledTimes(2);
   nativeButton(root,'frame-capture').click();draw(4000);await vi.waitFor(()=>expect(nativeStatus(root).dataset.state).toBe('ready'));
   const advanced=nativeData(root).metadata;
   expect(advanced.clocks).toMatchObject({forcingTime:1.5,precipitationUniformTime:.5,flowFieldTime:60});
   expect(advanced.clocks.flowUniformTime).toBeCloseTo(60.1,10);expect(encoder).toHaveBeenCalledTimes(3);
  }finally{app.destroy();await settleNative();}
 });
 it('clears UI during the App Blob read but retains the engine display slot until that old conversion finally ACKs',async()=>{
  const {app,root,canvas,draw}=await startNativeFixture();
  let release!:(buffer:ArrayBuffer)=>void;
  class AppReadHeldBlob extends NodeBlob {
   reads=0;
   override arrayBuffer():Promise<ArrayBuffer>{this.reads++;return this.reads===2?new Promise(resolve=>{release=resolve;}):super.arrayBuffer();}
  }
  const blob=new AppReadHeldBlob([nativePNGBytes],{type:'image/png'}),encoder=vi.fn((done:(blob:Blob|null)=>void)=>done(blob as unknown as Blob));
  Object.defineProperty(canvas,'toBlob',{configurable:true,value:encoder});
  try{
   nativeButton(root,'frame-capture').click();draw(1000);await vi.waitFor(()=>expect(blob.reads).toBe(2));
   expect(nativeStatus(root).dataset.state).toBe('encoding');nativeButton(root,'frame-clear').click();
   expect(nativeStatus(root).dataset.state).toBe('cleared');expect(nativeButton(root,'benchmark').disabled).toBe(true);expect(nativeButton(root,'frame-capture').disabled).toBe(true);
   expect(root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-json"]')!.value).toBe('');
   draw(2000);nativeButton(root,'benchmark').click();expect(root.querySelector('[data-testid="benchmark-result"]')!.textContent).not.toContain('Riscaldamento');expect(encoder).toHaveBeenCalledOnce();
   release(nativePNGBytes.slice().buffer);await vi.waitFor(()=>expect(nativeButton(root,'benchmark').disabled).toBe(false));
   expect(nativeButton(root,'frame-capture').disabled).toBe(false);expect(nativeStatus(root).dataset.state).toBe('cleared');
   expect(root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-json"]')!.value).toBe('');
   expect(root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-png"]')!.value).toBe('');
   expect(root.querySelector<HTMLElement>('[data-testid="frame-export-data"]')!.hidden).toBe(true);
  }finally{release?.(nativePNGBytes.slice().buffer);app.destroy();await settleNative();}
 });
 it('rejects a stale capture command while collecting/closing a benchmark and exposes no PNG controls in ordinary mode',async()=>{
  const {app,root,canvas,draw,clock}=await startNativeFixture();
  const fences:Array<()=>void>=[];device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>fences.push(resolve)));
  const encoder=vi.fn((done:(blob:Blob|null)=>void)=>done(nativePNG()));Object.defineProperty(canvas,'toBlob',{configurable:true,value:encoder});
  try{
   nativeButton(root,'benchmark').click();expect(nativeButton(root,'frame-capture').disabled).toBe(true);
   const staleCapture=()=>{const capture=nativeButton(root,'frame-capture');capture.disabled=false;capture.click();}; // public UI command from a deliberately stale enabled control
   staleCapture();expect(nativeStatus(root).textContent).toContain('Termina la misura');expect(nativeButton(root,'frame-capture').disabled).toBe(true);
   draw(3000);draw(3050);draw(33000);expect(fences).toHaveLength(3);
   expect(root.querySelector('[data-testid="benchmark-result"]')!.textContent).toContain('prefisso GPU finale');
   staleCapture();expect(nativeStatus(root).textContent).toContain('Termina la misura');expect(encoder).not.toHaveBeenCalled();
   clock.value=33100;fences.forEach(resolve=>resolve());await vi.waitFor(()=>expect(nativeButton(root,'frame-capture').disabled).toBe(false));
  }finally{app.destroy();fences.forEach(resolve=>resolve());await settleNative();}
  history.replaceState(null,'','/');const ordinary=createApp();
  try{expect(ordinary.root.querySelector('[data-action="frame-capture"]')).toBeNull();expect(ordinary.root.querySelector('[data-action="frame-clear"]')).toBeNull();expect(ordinary.root.querySelector('[data-testid="frame-export-json"]')).toBeNull();}
  finally{ordinary.app.destroy();await settleNative();}
 });
});
describe('scene async lifecycle',()=>{
  it('reports a missing measured cover before generating clouds instead of silently colouring every slope as forest',async()=>{
    vi.mocked(loadTerrainCover).mockRejectedValueOnce(new Error('Copertura del suolo non disponibile (404)'));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await starting;
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Copertura del suolo non disponibile (404)');
    expect(control.workers).toHaveLength(0);expect(control.terrain).toHaveLength(0);expect(control.render).not.toHaveBeenCalled();
    expect(control.renderer!.dispose).toHaveBeenCalledOnce();app.destroy();await flush();
  });
  it('aborts a pending cover request and cannot allocate resources if it resolves after teardown',async()=>{
    let finish!:(value:TerrainCover)=>void;
    vi.mocked(loadTerrainCover).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const signal=vi.mocked(loadTerrainCover).mock.calls.at(-1)![0]!;
    app.destroy();await flush();expect(signal.aborted).toBe(true);
    const fractions=new Uint8Array(48);for(let i=0;i<4;i++)fractions[i*12]=255;
    finish({side:2,spacingKm:64,minX:-64,minZ:-64,fractions});await starting;
    expect(control.workers).toHaveLength(0);expect(control.terrain).toHaveLength(0);expect(control.render).not.toHaveBeenCalled();
    expect(control.renderer!.dispose).toHaveBeenCalledOnce();
  });
  it('rejects cover with a geographic extent that cannot align with the measured terrain',async()=>{
    const fractions=new Uint8Array(48);for(let i=0;i<4;i++)fractions[i*12]=255;
    vi.mocked(loadTerrainCover).mockResolvedValueOnce({side:2,spacingKm:64,minX:-63,minZ:-64,fractions});
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await starting;
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Estensione della copertura del suolo incompatibile');
    expect(control.workers).toHaveLength(0);expect(control.terrain).toHaveLength(0);expect(control.render).not.toHaveBeenCalled();
    app.destroy();await flush();
  });
  it('reports a missing measured landscape before starting cloud generation, without a silent terrain fallback',async()=>{
    vi.mocked(loadTerrainDem).mockRejectedValueOnce(new Error('Rilievo non disponibile (404)'));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await starting;
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Rilievo non disponibile (404)');
    expect(control.workers).toHaveLength(0);expect(control.terrain).toHaveLength(0);expect(control.render).not.toHaveBeenCalled();
    expect(control.renderer!.dispose).toHaveBeenCalledOnce();app.destroy();await flush();
  });
  it('cannot allocate landscape or cloud resources when teardown wins over the measured-data request',async()=>{
    let finish!:(value:TerrainDem)=>void;
    vi.mocked(loadTerrainDem).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const signal=vi.mocked(loadTerrainDem).mock.calls.at(-1)![0]!;
    app.destroy();await flush();
    expect(signal.aborted).toBe(true);
    finish({side:3,spacingKm:64,minX:-64,minZ:-64,heights:new Uint16Array(9),coast:new Int16Array(9)});await starting;
    expect(control.workers).toHaveLength(0);expect(control.terrain).toHaveLength(0);expect(control.render).not.toHaveBeenCalled();
    expect(control.renderer!.dispose).toHaveBeenCalledOnce();
  });
  it('retains one bound terrain raster across weather changes and resizes it to the native output',async()=>{
    history.replaceState(null,'','/?profile=1&timing=off&flow=frozen');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const inputs:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
    vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,narrow,r8)=>new Proxy(original(mode,narrow,r8),{
      apply(target,thisArg,args){inputs.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);},
    }));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    try{
      expect(control.terrain).toHaveLength(1);const terrain=control.terrain[0];
      expect(terrain.configuration.sample).toEqual(expect.any(Function));expect(terrain.configuration.shade).toEqual(expect.any(Function));
      // The mocked source uses a different lattice from the shipped DEM. The
      // refinement adapter must pass the loaded metadata, not a 125m constant.
      expect(terrain.configuration.refinement?.sourceGrid).toEqual({minXKm:-64,minZKm:-64,spacingKm:64,columns:3,rows:3});
      expect(terrain.configuration.refinement?.maxErrorKm).toBe(.005);
      expect(terrain.configuration.refinement?.domain).toEqual({minXKm:-48,maxXKm:48,minZKm:-48,maxZKm:48});
      expect(terrain.resize).toHaveBeenLastCalledWith(1920,1080);
      expect((inputs[0].terrainRaster as {value:unknown}).value).toBe(terrain.texture);
      expect(terrain.render).toHaveBeenCalledOnce();
      expect(terrain.render.mock.invocationCallOrder[0]).toBeLessThan(control.render.mock.invocationCallOrder[0]);
      const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];frame(1000);
      expect(terrain.render).toHaveBeenCalledTimes(2);
      const camera=terrain.render.mock.calls.at(-1)![1] as TerrainCameraFrame;
      expect(terrain.render.mock.calls.at(-1)![0]).toBe(control.renderer);
      expect(terrain.render.mock.calls.at(-1)![2]).toBe((inputs[0].sun as {value:unknown}).value);
      for(const key of ['origin','forward','right','up'] as const){
        expect(terrainComponents(camera[key])).toEqual((inputs[0][key] as {value:{toArray:()=>number[]}}).value.toArray());
      }
      expect(camera.aspect).toBe((inputs[0].aspect as {value:number}).value);
      expect(camera.inspection).toBe((inputs[0].inspection as {value:number}).value);
      expect(camera.tanFov).toBe(.2867);
      app.applyAtmosphereIntent({type:'rain',amount:.8});
      expect(inputs).toHaveLength(2);expect(control.terrain).toHaveLength(1);
      expect((inputs[1].terrainRaster as {value:unknown}).value).toBe(terrain.texture);
      const output=root.querySelector<HTMLSelectElement>('[name="output"]')!;
      output.value='720';output.dispatchEvent(new Event('change',{bubbles:true}));frame(2000);
      expect(terrain.resize).toHaveBeenLastCalledWith(1280,720);
      expect(terrain.render).toHaveBeenCalledTimes(3);expect(terrain.dispose).not.toHaveBeenCalled();
      expect(terrain.render.mock.calls.at(-1)![2]).toBe((inputs[1].sun as {value:unknown}).value);
    }finally{app.destroy();await flush();}
  });
  it('skips the terrain prepass for ground zero and resumes it before the cloud draw when enabled',async()=>{
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    try{
      const terrain=control.terrain[0],frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
      expect(terrain.render).toHaveBeenCalledOnce();
      const ground=root.querySelector<HTMLSelectElement>('[name="ground"]')!;
      ground.value='0';ground.dispatchEvent(new Event('change',{bubbles:true}));frame(1000);
      expect(terrain.render).toHaveBeenCalledOnce();expect(control.render).toHaveBeenCalledTimes(2);
      ground.value='1';ground.dispatchEvent(new Event('change',{bubbles:true}));frame(2000);
      expect(terrain.render).toHaveBeenCalledTimes(2);expect(control.render).toHaveBeenCalledTimes(3);
      expect(terrain.render.mock.invocationCallOrder.at(-1)).toBeLessThan(control.render.mock.invocationCallOrder.at(-1)!);
      expect(control.terrain).toHaveLength(1);expect(terrain.dispose).not.toHaveBeenCalled();
    }finally{app.destroy();await flush();}
  });
  it('disposes the terrain target once after device loss and cannot render it during later teardown',async()=>{
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const terrain=control.terrain[0],dispose=vi.spyOn(terrain.texture,'dispose');
    expect(terrain.render).toHaveBeenCalledOnce();
    control.renderer!.onDeviceLost();await flush();
    expect(terrain.dispose).toHaveBeenCalledOnce();expect(dispose).toHaveBeenCalledOnce();
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];frame(1000);
    expect(terrain.render).toHaveBeenCalledOnce();
    app.destroy();await flush();
    expect(terrain.dispose).toHaveBeenCalledOnce();expect(dispose).toHaveBeenCalledOnce();
  });
  it('publishes fresh pass coverage for explicit draw ranges, excluding warmup and the interval anchor',async()=>{
    control.timestamps=true;history.replaceState(null,'','/?profile=1&timing=stages');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const fences:Array<()=>void>=[];
    device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>fences.push(resolve)));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0],draw=(time:number)=>{clock=time;frame(time);};
    const completeQueries=async()=>{control.timestampJobs.forEach(job=>job.finish());await flush();};
    const raw=root.querySelector('[data-testid="benchmark-json"]')!;
    try{
      draw(1000);await completeQueries(); // resolve compiler/initialization work outside the run
      root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.click();
      draw(2999);await completeQueries(); // warmup is in the ledger, outside measured intervals
      draw(3000);draw(3050);draw(3250); // anchor and two measured draws share Three frame41
      clock=3260;await completeQueries();
      draw(33000);expect(fences).toHaveLength(3);expect(raw.textContent).toBe('');
      clock=33010;await completeQueries();expect(raw.textContent).toBe('');
      clock=33020;fences[0]();fences[1]();await flush();expect(raw.textContent).toBe('');
      clock=33030;fences[2]();await flush();
      const report=JSON.parse(raw.textContent!) as {stats:{frames:number};gpu:{meanMs:number};
        queuePrefix:{status:string;measuredSubmissions:number;confirmedPrefixId:number;samples:Array<{kind:string}>};timestampPasses:TimestampBatchMeasurementReport};
      const passes=report.timestampPasses;
      expect(report.stats.frames).toBe(3);expect(report.queuePrefix.status).toBe('completed');expect(report.queuePrefix.confirmedPrefixId).toBe(3);
      expect(report.queuePrefix.measuredSubmissions).toBe(3);expect(report.queuePrefix.samples.filter(s=>s.kind==='end')).toHaveLength(1);
      expect(passes.status).toBe('closed');expect(passes.draws.map(d=>d.measuredIntervalId)).toEqual([null,null,1,2,3]);
      expect(new Set(passes.draws.flatMap(d=>[d.before.frame,d.after.frame]))).toEqual(new Set([41]));
      expect(passes.draws.map(d=>[d.before.renderFrameCalls,d.after.renderFrameCalls])).toEqual([[4,6],[6,8],[8,10],[10,12],[12,14]]);
      expect(passes.draws.map(d=>d.after.computeFrameCalls-d.before.computeFrameCalls)).toEqual([1,1,1,1,1]);
      expect(passes.coverage.render).toMatchObject({measuredDraws:3,expectedCalls:6,matchedFreshCalls:6,completeDraws:3,missingDraws:0});
      expect(passes.coverage.compute).toMatchObject({measuredDraws:3,expectedCalls:3,matchedFreshCalls:3,completeDraws:3});
      expect(passes.completeSamples.render.map(s=>s.passSumMs)).toEqual([7,7,7]);expect(passes.statistics.compute?.meanMs).toBe(.25);
      expect(passes.diagnostics).toMatchObject({outsideWindowPassRows:6,unmatchedPassRows:0,ambiguousPassRows:0,duplicateUidRows:0,staleBatchCount:0});
      expect(report.gpu.meanMs).toBe(21); // legacy scalar sums three mock draws in one Three frame
      expect(passes.statistics.render?.meanMs).toBe(7); // explicit app draw ranges stay separate
    }finally{app.destroy();fences.forEach(resolve=>resolve());await completeQueries();}
  });
  it('isolates canceled timestamp batches and publishes finite coverage without waiting for a late final readback',async()=>{
    control.timestamps=true;history.replaceState(null,'','/?profile=1&timing=stages');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const fences:Array<()=>void>=[];
    device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>fences.push(resolve)));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0],draw=(time:number)=>{clock=time;frame(time);};
    const completeQueries=async()=>{control.timestampJobs.forEach(job=>job.finish());await flush();};
    const benchmark=root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!,raw=root.querySelector('[data-testid="benchmark-json"]')!;
    try{
      draw(1000);await completeQueries();const initialJobs=control.timestampJobs.length;
      benchmark.click();draw(3000);const oldJobs=control.timestampJobs.slice(initialJobs),oldUids=new Set(oldJobs.flatMap(job=>job.uids));
      expect(oldJobs).toHaveLength(2);window.dispatchEvent(new Event('resize'));await flush();
      expect(root.querySelector('[data-testid="benchmark-result"]')!.textContent).toContain('annullata');
      clock=4000;benchmark.click();draw(6000); // new collector while the previous batch is still pending
      clock=6010;oldJobs.forEach(job=>job.finish());fences[0]();await flush();
      expect(raw.textContent).toBe('');expect(root.querySelector<HTMLButtonElement>('[data-action="export"]')!.disabled).toBe(true);
      draw(6050);clock=6060;await completeQueries();
      const beforeFinalJobs=control.timestampJobs.length;draw(36000);expect(control.timestampJobs.length-beforeFinalJobs).toBe(2);
      expect(fences).toHaveLength(4); // canceled initial prefix, new initial, periodic, final
      clock=36010;fences.slice(1).forEach(resolve=>resolve());await flush(); // final queries deliberately unresolved
      const report=JSON.parse(raw.textContent!) as {stats:{frames:number};queuePrefix:{status:string;confirmedPrefixId:number};timestampPasses:TimestampBatchMeasurementReport};
      expect(report.stats.frames).toBe(2);expect(report.queuePrefix.status).toBe('completed');expect(report.queuePrefix.confirmedPrefixId).toBe(2);
      expect(report.timestampPasses.draws.map(d=>d.measuredIntervalId)).toEqual([null,1,2]);
      expect(report.timestampPasses.coverage.render).toMatchObject({measuredDraws:2,completeDraws:1,missingDraws:1});
      expect(report.timestampPasses.statistics.render).toMatchObject({sampleCount:1,meanMs:7});
      expect(report.timestampPasses.rawBatches.flatMap(b=>b.observedAfter).some(p=>oldUids.has(p.uid))).toBe(false);
      const published=raw.textContent;clock=36020;await completeQueries();expect(raw.textContent).toBe(published);
    }finally{app.destroy();fences.forEach(resolve=>resolve());await completeQueries();}
  });
  it('does not publish an old benchmark after resize cancels its final fence and a new run starts',async()=>{
    history.replaceState(null,'','/?profile=1&timing=off&flow=frozen');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const fences:Array<()=>void>=[];
    device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>fences.push(resolve)));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    const draw=(time:number)=>{clock=time;frame(time);};
    const benchmark=root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!;
    const raw=root.querySelector('[data-testid="benchmark-json"]')!;
    const exportButton=root.querySelector<HTMLButtonElement>('[data-action="export"]')!;
    benchmark.click();draw(2999);expect(fences).toHaveLength(0);
    draw(3000);draw(3050);draw(33000); // stats complete; start, periodic and end fences remain pending
    expect(fences).toHaveLength(3);expect(raw.textContent).toBe('');expect(exportButton.disabled).toBe(true);
    window.dispatchEvent(new Event('resize'));await flush();
    expect(root.querySelector('[data-testid="benchmark-result"]')!.textContent).toContain('annullata');
    expect(benchmark.disabled).toBe(false);
    clock=34000;benchmark.click();draw(36000);
    expect(fences).toHaveLength(4); // the new run owns a different initial prefix
    clock=36010;fences.slice(0,3).forEach(resolve=>resolve());await flush();draw(36016);
    expect(raw.textContent).toBe('');expect(exportButton.disabled).toBe(true);
    expect(root.querySelector('[data-testid="benchmark-result"]')!.textContent).not.toContain('annullata');
    app.destroy();fences[3]();await flush();
  });
  it('publishes matching measured-submission and interval counts after exactly one final fence',async()=>{
    history.replaceState(null,'','/?profile=1&timing=off&flow=frozen');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const fences:Array<()=>void>=[];
    device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>fences.push(resolve)));
    const {app,root}=createApp();const starting=app.start();app.applyAtmosphereIntent({type:'rain',amount:.8});await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudWithNarrow()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    const draw=(time:number)=>{clock=time;frame(time);};
    const raw=root.querySelector('[data-testid="benchmark-json"]')!;
    root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.click();
    draw(2999);expect(fences).toHaveLength(0);draw(3000);draw(3050);draw(33000);
    expect(fences).toHaveLength(3);draw(33016);draw(33033);expect(fences).toHaveLength(3);
    clock=33100;fences[0]();fences[1]();await flush();
    expect(raw.textContent).toBe(''); // an initial/periodic completion cannot publish the report
    clock=33200;fences[2]();await flush();
    const report=JSON.parse(raw.textContent!) as {densitySamplingStart:DensitySamplingSnapshot;densitySamplingEnd:DensitySamplingSnapshot;rendererVersion:string;stats:{frames:number;fps:number};submissionFps:number;presentedCanvasFps:null;
      queuePrefix:{status:string;measuredSubmissions:number;confirmedPrefixId:number;samples:Array<{kind:string;prefixId:number}>}};
    expect(report.densitySamplingStart).toMatchObject({path:'r8unorm-extracted-r',format:'r8unorm',dimensions:[1,1,1],textureBytes:1,extraCpuPayloadBytes:1,extraGpuPayloadBytes:1,fallback:null});
    expect(report.densitySamplingEnd).toEqual(report.densitySamplingStart);
    expect(report.rendererVersion).toBe('experiment-v59-terrain-raster-cache');
    expect(report).toHaveProperty('terrainSurfaceId','copernicus-glo90-liguria-apuane-v1');
    expect(report).toHaveProperty('terrainGeography',expect.objectContaining({originDegrees:[44,10],verticalExaggeration:1,measuredSquareHalfWidthKm:48}));
    expect(report).toHaveProperty('terrainCover',expect.objectContaining({id:'esa-worldcover-2021-area-fractions-v1',year:2021,sourceClasses:12,materialGroups:8,gridSize:[2,2],sourceAssetBytes:80,retainedCpuPayloadBytes:32,totalGpuPayloadBytes:40}));
    expect(control.terrain[0].stats).toHaveBeenCalled();
    expect(report).toHaveProperty('terrainRaster',expect.objectContaining({width:1920,height:1080,targetPayloadBytes:1920*1080*20,perFrameCpuHeightSamples:0}));
    expect(report.stats.frames).toBe(2);expect(report.queuePrefix.measuredSubmissions).toBe(report.stats.frames);
    expect(report.queuePrefix.status).toBe('completed');expect(report.queuePrefix.confirmedPrefixId).toBe(2);
    expect(report.queuePrefix.samples.filter(sample=>sample.kind==='end')).toHaveLength(1);
    expect(report.submissionFps).toBe(report.stats.fps);expect(report.presentedCanvasFps).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-action="export"]')!.disabled).toBe(false);
    const snapshot=raw.textContent;draw(34000);await flush();
    expect(fences).toHaveLength(3);expect(raw.textContent).toBe(snapshot);
    app.destroy();await flush();
  });
  it('binds macro, narrow and density R8 and disposes both generations exactly once',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const inputs:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
    vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,useNarrow,useDensityR8)=>new Proxy(original(mode,useNarrow,useDensityR8),{
      apply(target,thisArg,args){inputs.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);},
    }));
    const initial=cloudWithNarrow(0),replacement=cloudWithNarrow();
    const narrowDisposed=(volume:typeof initial)=>textureDisposals(dispose.mock.contexts,volume.narrowMask.data);
    const {app,root}=createApp();const starting=app.start();app.applyAtmosphereIntent({type:'rain',amount:.8});await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    expect(inputs).toHaveLength(1);
    expectDensityTexture((inputs[0].densityR8 as {value:unknown}).value,initial.densityR8.data);
    expect((inputs[0].volume as {value:Data3DTexture}).value.image.data).toBe(initial.data);
    const firstNarrow=expectNarrowTexture((inputs[0].narrowCloud as {value:unknown}).value,initial.narrowMask.data);
    expect(disposed(initial)).toBe(0);expect(narrowDisposed(initial)).toBe(0);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(0);
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    expect(disposed(initial)).toBe(0);
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(0);
    expect(inputs).toHaveLength(2);
    expectDensityTexture((inputs[1].densityR8 as {value:unknown}).value,replacement.densityR8.data);
    const secondNarrow=expectNarrowTexture((inputs[1].narrowCloud as {value:unknown}).value,replacement.narrowMask.data);
    expect(secondNarrow).not.toBe(firstNarrow);
    expect(narrowDisposed(initial)).toBe(1);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(1);expect(narrowDisposed(replacement)).toBe(0);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(0);
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
    expect(narrowDisposed(initial)).toBe(1);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(1);expect(narrowDisposed(replacement)).toBe(1);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(1);
  });
  it('switches dry/rain bindings only on intent and residual-rain transitions, not on each frame',async()=>{
    const densityVariants:boolean[]=[],variants:boolean[]=[],inputs:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
    vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,useNarrow,useDensityR8)=>{
      variants.push(useNarrow===true);densityVariants.push(useDensityR8===true);
      return new Proxy(original(mode,useNarrow,useDensityR8),{
        apply(target,thisArg,args){inputs.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);},
      });
    });
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudWithNarrow()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    try{
      expect(variants).toEqual([false]);expect(inputs[0]).not.toHaveProperty('narrowCloud');expect(inputs[0]).not.toHaveProperty('densityR8');expect(densityVariants).toEqual([false]);
      app.applyAtmosphereIntent({type:'rain',amount:.8});
      expect(variants).toEqual([false,true]);expect(inputs[1]).toHaveProperty('narrowCloud');expect(inputs[1]).toHaveProperty('densityR8');expect(densityVariants).toEqual([false,true]);
      frame(1000);frame(2000);
      const weather=inputs[1].weather as {value:{z:number}};
      expect(weather.value.z).toBeGreaterThan(.001);expect(variants).toHaveLength(2);
      app.applyAtmosphereIntent({type:'scene',scene:'clear'});frame(3000);
      expect(weather.value.z).toBeGreaterThan(.001);expect(variants).toHaveLength(2);
      // Interrupt the drying transition: the rainy specialization remains installed.
      app.applyAtmosphereIntent({type:'scene',scene:'storm'});await flush();frame(4000);
      expect(variants).toHaveLength(2);
      app.applyAtmosphereIntent({type:'rain',amount:0});
      for(let time=5000;time<=13000;time+=1000)frame(time);
      expect(weather.value.z).toBeLessThanOrEqual(.001);
      expect(variants).toEqual([false,true,false]);expect(inputs[2]).not.toHaveProperty('narrowCloud');expect(inputs[2]).not.toHaveProperty('densityR8');expect(densityVariants).toEqual([false,true,false]);
      frame(14000);frame(15000);expect(variants).toHaveLength(3);
      app.applyAtmosphereIntent({type:'rain',amount:.6});
      expect(variants).toEqual([false,true,false,true]);expect(inputs[3]).toHaveProperty('narrowCloud');expect(inputs[3]).toHaveProperty('densityR8');expect(densityVariants).toEqual([false,true,false,true]);
    }finally{app.destroy();await flush();}
  });
  it('uses an occupied nearest R8 compatibility texture for a legacy packet without narrowMask',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudVolume();
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});await starting;
    expect(control.render).toHaveBeenCalledOnce();
    app.destroy();await flush();
    const narrow=dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.format===RedFormat);
    expect(narrow).toHaveLength(1);
    const fallback=expectNarrowTexture(narrow[0]);
    const fallbackData=fallback.image.data;
    if(!(fallbackData instanceof Uint8Array))throw new Error('Expected an R8 compatibility payload.');
    expect([...fallbackData]).toEqual([255]);
    expect(Object.hasOwn(volume,'narrowMask')).toBe(false);
    expect(textureDisposals(dispose.mock.contexts,volume.data)).toBe(1);
  });
  it('disposes an uninstalled initial macro texture if teardown wins before installation',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudWithNarrow();
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});
    app.destroy();await starting;await flush();
    expect(dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data)).toHaveLength(1);
    expect(textureDisposals(dispose.mock.contexts,volume.narrowMask.data)).toBe(1);
    expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
    expectDensityTexture(dispose.mock.contexts.find(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.densityR8.data),volume.densityR8.data);
    expectNarrowTexture(dispose.mock.contexts.find(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.narrowMask.data),volume.narrowMask.data);
    expect(control.render).not.toHaveBeenCalled();expect(device.destroy).toHaveBeenCalledOnce();
  });
  it('disposes an uninstalled replacement macro texture after teardown interrupts the GPU drain',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const initial=cloudWithNarrow(),replacement=cloudWithNarrow(0);
    const narrowDisposed=(volume:typeof initial)=>textureDisposals(dispose.mock.contexts,volume.narrowMask.data);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    let drained=()=>{};device.queue.onSubmittedWorkDone.mockImplementationOnce(()=>new Promise<void>(resolve=>{drained=resolve;}));
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(0);expect(disposed(replacement)).toBe(0);
    expect(narrowDisposed(initial)).toBe(0);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(0);expect(narrowDisposed(replacement)).toBe(0);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(0);
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(0);
    expect(narrowDisposed(initial)).toBe(1);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(1);expect(narrowDisposed(replacement)).toBe(0);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(0);
    drained();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
    expect(narrowDisposed(initial)).toBe(1);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(1);expect(narrowDisposed(replacement)).toBe(1);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(1);
    expect(control.render).toHaveBeenCalledOnce();
  });
  it('disposes a rejected replacement macro texture while retaining the installed texture until teardown',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const initial=cloudWithNarrow(),replacement=cloudWithNarrow(0);
    const narrowDisposed=(volume:typeof initial)=>textureDisposals(dispose.mock.contexts,volume.narrowMask.data);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    device.queue.onSubmittedWorkDone.mockRejectedValueOnce(new Error('GPU drain rejected'));
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(0);expect(disposed(replacement)).toBe(1);
    expect(narrowDisposed(initial)).toBe(0);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(0);expect(narrowDisposed(replacement)).toBe(1);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(1);
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('GPU drain rejected');
    expect(control.render).toHaveBeenCalledOnce();
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
    expect(narrowDisposed(initial)).toBe(1);expect(textureDisposals(dispose.mock.contexts,initial.densityR8.data)).toBe(1);expect(narrowDisposed(replacement)).toBe(1);expect(textureDisposals(dispose.mock.contexts,replacement.densityR8.data)).toBe(1);
  });
  it('reports dry macro sampling while retaining the allocated R8 payload across the measurement',async()=>{
    history.replaceState(null,'','/?profile=1&timing=off&flow=frozen');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudWithNarrow();
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.click();
    for(const time of [3000,3050,33000]){clock=time;frame(time);}await flush();
    const report=JSON.parse(root.querySelector('[data-testid="benchmark-json"]')!.textContent!) as {densitySamplingStart:DensitySamplingSnapshot;densitySamplingEnd:DensitySamplingSnapshot};
    expect(report.densitySamplingStart).toMatchObject({path:'macro-rgba8-r',dimensions:[1,1,1],textureBytes:4,extraCpuPayloadBytes:1,extraGpuPayloadBytes:1,reason:'dry weather; R8 retained but not bound',fallback:null});
    expect(report.densitySamplingStart.allocationAccounting).toContain('nominal');
    expect(report.densitySamplingEnd).toEqual(report.densitySamplingStart);
    expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(0);
    app.destroy();await flush();expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
  });
  it.each([undefined,{size:2,data:new Uint8Array(1)},{size:1,data:new Uint8Array(2)},{size:1,data:new Float32Array(1)}])('reports the original macro path for missing or invalid R8 payload: %s',async densityR8=>{
    history.replaceState(null,'','/?profile=1&timing=off&flow=frozen');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    let clock=1000;vi.spyOn(performance,'now').mockImplementation(()=>clock);
    const inputs:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
    vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,narrow,r8)=>{
      expect(r8).toBe(false);
      return new Proxy(original(mode,narrow,r8),{apply(target,thisArg,args){inputs.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);}});
    });
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:{...cloudVolume(),densityR8}}});await starting;
    expect(inputs[0]).not.toHaveProperty('densityR8');
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.click();
    for(const time of [3000,3050,33000]){clock=time;frame(time);}await flush();
    const report=JSON.parse(root.querySelector('[data-testid="benchmark-json"]')!.textContent!) as {densitySamplingStart:DensitySamplingSnapshot;densitySamplingEnd:DensitySamplingSnapshot};
    expect(report.densitySamplingStart).toMatchObject({path:'macro-rgba8-r',format:'rgba8unorm',dimensions:[1,1,1],textureBytes:4,extraCpuPayloadBytes:0,extraGpuPayloadBytes:0});
    expect(report.densitySamplingStart.fallback).toBeTruthy();expect(report.densitySamplingEnd).toEqual(report.densitySamplingStart);
    app.destroy();await flush();
  });
  it('keeps the density binding through diagnostic changes and removes it on a legacy seed swap',async()=>{
    history.replaceState(null,'','/?profile=1');
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudWithNarrow();
    const variants:Array<{mode:number|undefined;r8:boolean|undefined}>=[],inputs:Record<string,unknown>[]=[],original=cloudShader.createCloudIntegrator;
    vi.spyOn(cloudShader,'createCloudIntegrator').mockImplementation((mode,narrow,r8)=>{
      variants.push({mode,r8});return new Proxy(original(mode,narrow,r8),{apply(target,thisArg,args){inputs.push(args[0] as Record<string,unknown>);return Reflect.apply(target,thisArg,args);}});
    });
    const {app,root}=createApp();const starting=app.start();app.applyAtmosphereIntent({type:'rain',amount:.8});await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});await starting;
    const ablation=root.querySelector<HTMLSelectElement>('[name="ablation"]')!;
    for(const value of ['density','cache','no-flow','no-detail','no-flash','full']){ablation.value=value;ablation.dispatchEvent(new Event('change',{bubbles:true}));}
    expect(variants.every(variant=>variant.r8===true)).toBe(true);
    for(const input of inputs)expectDensityTexture((input.densityR8 as {value:unknown}).value,volume.densityR8.data);
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    control.workers[1].onmessage!({data:{volume:cloudVolume()}});await flush();
    expect(variants.at(-1)?.r8).toBe(false);expect(inputs.at(-1)).not.toHaveProperty('densityR8');
    expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
    app.destroy();await flush();expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
  });
  it('disposes installed density R8 once on device loss and subsequent teardown',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudWithNarrow();
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});await starting;
    control.renderer!.onDeviceLost();await flush();
    expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
    app.destroy();await flush();expect(textureDisposals(dispose.mock.contexts,volume.densityR8.data)).toBe(1);
  });
  it('does not declare ready when GPU shader validation fails',async()=>{
    Object.assign(device,{pushErrorScope:vi.fn(),popErrorScope:vi.fn(async()=>({message:'invalid sampler'}))});
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});
    await starting;
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Compilazione GPU fallita: invalid sampler');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLButtonElement>('[data-action="sustained"]')!.disabled).toBe(true);
    app.destroy();await flush();
    Reflect.deleteProperty(device,'pushErrorScope');Reflect.deleteProperty(device,'popErrorScope');
  });

  it('bounds submitted frames until GPU completion without counting skipped callbacks as draws',async()=>{
    history.replaceState(null,'','/?profile=1&inflight=2');
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const completions:Array<()=>void>=[];
    device.queue.onSubmittedWorkDone.mockImplementation(()=>new Promise<void>(resolve=>completions.push(resolve)));
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const volume=cloudVolume();
    control.workers[0].onmessage!({data:{volume}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    frame(1000);frame(1017);frame(1034);
    expect(control.render).toHaveBeenCalledTimes(3); // initial draw + two submitted frames
    completions.splice(0).forEach(resolve=>resolve());await flush();
    frame(1051);
    expect(control.render).toHaveBeenCalledTimes(4);
    frame(1068);frame(1085);
    expect(control.render).toHaveBeenCalledTimes(5);
    const policy=root.querySelector<HTMLSelectElement>('select[name="inflight"]')!;
    policy.value='0';policy.dispatchEvent(new Event('change',{bubbles:true}));
    frame(1102);
    expect(control.render).toHaveBeenCalledTimes(6); // switches without rebuilding the GPU context
    completions.splice(0).forEach(resolve=>resolve());await flush();app.destroy();await flush();
    device.queue.onSubmittedWorkDone.mockImplementation(()=>Promise.resolve());
  });
  it('initializes frozen flow again when a newly seeded volume is installed',async()=>{
    history.replaceState(null,'','/?profile=1&flow=frozen');
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const volume=cloudVolume();
    control.workers[0].onmessage!({data:{volume}});await starting;
    expect(control.compute).toHaveBeenCalledOnce();
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    control.workers[1].onmessage!({data:{volume}});await flush();
    expect(control.compute).toHaveBeenCalledTimes(2);
    app.destroy();await flush();
  });
  it('starts exactly one RAF when initial generation finishes in a hidden tab',async()=>{
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(control.compute).toHaveBeenCalledOnce();
    expect(control.compute.mock.invocationCallOrder[0]).toBeLessThan(control.render.mock.invocationCallOrder[0]);
    hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    app.destroy();await flush();hidden.mockRestore();
  });
  it('rebuilds density and lighting together and never resumes a regenerated scene after teardown',async()=>{
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    expect(control.workers).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    const lateMessage=control.workers[1].onmessage!;
    app.destroy();await flush();
    lateMessage({data:{volume:cloudVolume()}});await flush();
    expect(control.render).toHaveBeenCalledOnce();
    expect(device.destroy).toHaveBeenCalledOnce();
  });
  it('keeps an installed scene animating after hide/show during regeneration',async()=>{
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const volume=cloudVolume();
    control.workers[0].onmessage!({data:{volume}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));
    const calls=vi.mocked(requestAnimationFrame).mock.calls.length;
    hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(calls+1);
    const frame=vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0];frame(2000);
    expect(control.render).toHaveBeenCalledTimes(2);
    app.destroy();await flush();
  });
  it('does not start a second RAF loop when visibility changes during the final GPU drain',async()=>{
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const volume=cloudVolume();
    control.workers[0].onmessage!({data:{volume}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    let drained=()=>{};device.queue.onSubmittedWorkDone.mockImplementationOnce(()=>new Promise<void>(resolve=>{drained=resolve;}));
    control.workers[1].onmessage!({data:{volume}});await flush();
    const calls=vi.mocked(requestAnimationFrame).mock.calls.length;
    hidden.mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(calls);
    drained();await flush();expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(calls+1);
    app.destroy();await flush();
  });
  it('freezes active dispersal when paused and resumes it on the cloud clock',async()=>{
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];frame(1000);
    root.querySelector<HTMLButtonElement>('[data-action="disperse"]')!.click();frame(2000);
    root.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();frame(3000);
    const before=root.querySelector('[data-testid="cloud-flow-status"]')!.textContent;
    frame(8000);expect(root.querySelector('[data-testid="cloud-flow-status"]')!.textContent).toBe(before);
    root.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();frame(9000);
    expect(root.querySelector('[data-testid="cloud-flow-status"]')!.textContent).not.toBe(before);
    app.destroy();await flush();
  });
  it('performs final renderer cleanup after a pending initialization completes',async()=>{
    const {app}=createApp();const starting=app.start();await flush();
    app.destroy();await flush();const callsBefore=control.renderer!.dispose.mock.calls.length;
    control.initResolve();await starting;await flush();
    expect(control.renderer!.dispose.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(device.destroy).toHaveBeenCalled();
    expect(control.workers).toHaveLength(0);
  });
  it('preserves Three device-loss handling and cannot restart when a worker result arrives late',async()=>{
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    expect(control.workers).toHaveLength(1);
    const worker=control.workers[0];const lateMessage=worker.onmessage!;
    control.renderer!.onDeviceLost();await flush();
    lateMessage({data:{volume:cloudVolume()}});await starting;await flush();
    expect(control.originalLost).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalled();
    expect(control.render).not.toHaveBeenCalled();
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Connessione alla GPU persa');
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    app.destroy();await flush();
  });
});
