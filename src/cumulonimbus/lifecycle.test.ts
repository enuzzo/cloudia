import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const control = vi.hoisted(()=>({initResolve:()=>{},renderer:null as MockRendererControl|null,
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
    constructor() {control.renderer=this;}
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
    setPixelRatio() {} setSize() {}
  },QuadMesh:class {render(renderer:MockRendererControl){control.render(renderer);renderer.recordRenderPasses();}}};
});
import { CumulonimbusApp } from './CumulonimbusApp';
import { Data3DTexture } from 'three/webgpu';
import type { CloudVolume } from './volume';
import type {TimestampBatchMeasurementReport} from './timestampBatchMeasurement';
async function flush() {for(let i=0;i<15;i++) await Promise.resolve();}
const device={destroy:vi.fn(),queue:{onSubmittedWorkDone:vi.fn(()=>Promise.resolve())}};
beforeEach(()=>{
  vi.clearAllMocks(); control.renderer=null; control.workers=[];control.timestamps=false;control.timestampJobs=[];
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
describe('scene async lifecycle',()=>{
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
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:cloudVolume()}});await starting;
    const frame=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    const draw=(time:number)=>{clock=time;frame(time);};
    const raw=root.querySelector('[data-testid="benchmark-json"]')!;
    root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.click();
    draw(2999);expect(fences).toHaveLength(0);draw(3000);draw(3050);draw(33000);
    expect(fences).toHaveLength(3);draw(33016);draw(33033);expect(fences).toHaveLength(3);
    clock=33100;fences[0]();fences[1]();await flush();
    expect(raw.textContent).toBe(''); // an initial/periodic completion cannot publish the report
    clock=33200;fences[2]();await flush();
    const report=JSON.parse(raw.textContent!) as {stats:{frames:number;fps:number};submissionFps:number;presentedCanvasFps:null;
      queuePrefix:{status:string;measuredSubmissions:number;confirmedPrefixId:number;samples:Array<{kind:string;prefixId:number}>}};
    expect(report.stats.frames).toBe(2);expect(report.queuePrefix.measuredSubmissions).toBe(report.stats.frames);
    expect(report.queuePrefix.status).toBe('completed');expect(report.queuePrefix.confirmedPrefixId).toBe(2);
    expect(report.queuePrefix.samples.filter(sample=>sample.kind==='end')).toHaveLength(1);
    expect(report.submissionFps).toBe(report.stats.fps);expect(report.presentedCanvasFps).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-action="export"]')!.disabled).toBe(false);
    const snapshot=raw.textContent;draw(34000);await flush();
    expect(fences).toHaveLength(3);expect(raw.textContent).toBe(snapshot);
    app.destroy();await flush();
  });
  it('disposes the previous macro texture at replacement and the current texture once at teardown',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const initial=cloudVolume(),replacement=cloudVolume();
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    expect(disposed(initial)).toBe(0);
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(0);
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
  });
  it('disposes an uninstalled initial macro texture if teardown wins before installation',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose'),volume=cloudVolume();
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume}});
    app.destroy();await starting;await flush();
    expect(dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data)).toHaveLength(1);
    expect(control.render).not.toHaveBeenCalled();expect(device.destroy).toHaveBeenCalledOnce();
  });
  it('disposes an uninstalled replacement macro texture after teardown interrupts the GPU drain',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const initial=cloudVolume(),replacement=cloudVolume();
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    let drained=()=>{};device.queue.onSubmittedWorkDone.mockImplementationOnce(()=>new Promise<void>(resolve=>{drained=resolve;}));
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(0);expect(disposed(replacement)).toBe(0);
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(0);
    drained();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
    expect(control.render).toHaveBeenCalledOnce();
  });
  it('disposes a rejected replacement macro texture while retaining the installed texture until teardown',async()=>{
    const dispose=vi.spyOn(Data3DTexture.prototype,'dispose');
    const disposed=(volume:CloudVolume)=>dispose.mock.contexts.filter(texture=>texture instanceof Data3DTexture&&texture.image.data===volume.data).length;
    const initial=cloudVolume(),replacement=cloudVolume();
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:initial}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    device.queue.onSubmittedWorkDone.mockRejectedValueOnce(new Error('GPU drain rejected'));
    control.workers[1].onmessage!({data:{volume:replacement}});await flush();
    expect(disposed(initial)).toBe(0);expect(disposed(replacement)).toBe(1);
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('GPU drain rejected');
    expect(control.render).toHaveBeenCalledOnce();
    app.destroy();await flush();
    expect(disposed(initial)).toBe(1);expect(disposed(replacement)).toBe(1);
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
