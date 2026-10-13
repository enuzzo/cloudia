import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const control = vi.hoisted(()=>({initResolve:()=>{},renderer:null as null | {dispose:ReturnType<typeof vi.fn>;onDeviceLost:()=>void;initialized:boolean},workers:[] as Array<{onmessage:((event:unknown)=>void)|null;terminate:ReturnType<typeof vi.fn>}>,render:vi.fn(),compute:vi.fn(),originalLost:vi.fn()}));
vi.mock('three/webgpu',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('three/webgpu')>();
  return {...actual,WebGPURenderer:class {
    backend={isWebGPUBackend:true}; domElement=document.createElement('canvas'); initialized=false;
    compute=control.compute; dispose=vi.fn(); onDeviceLost=control.originalLost;
    constructor() {control.renderer=this;}
    async init() {await new Promise<void>(resolve=>{control.initResolve=resolve;});this.initialized=true;}
    hasFeature() {return false;}
    setPixelRatio() {} setSize() {}
  },QuadMesh:class {render=control.render;}};
});
import { CumulonimbusApp } from './CumulonimbusApp';
async function flush() {for(let i=0;i<15;i++) await Promise.resolve();}
const device={destroy:vi.fn(),queue:{onSubmittedWorkDone:vi.fn(()=>Promise.resolve())}};
beforeEach(()=>{
  vi.clearAllMocks(); control.renderer=null; control.workers=[];
  Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({info:{vendor:'test'},features:new Set(),requestDevice:async()=>device})}});
  vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1)); vi.stubGlobal('cancelAnimationFrame',vi.fn());
  vi.stubGlobal('Worker',class {
    onmessage:((event:unknown)=>void)|null=null; terminate=vi.fn();
    constructor() {control.workers.push(this);} postMessage() {}
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';history.replaceState(null,'','/');});
function createApp() {const root=document.createElement('main');document.body.append(root);return {app:new CumulonimbusApp(root),root};}
describe('scene async lifecycle',()=>{
  it('does not declare ready when GPU shader validation fails',async()=>{
    Object.assign(device,{pushErrorScope:vi.fn(),popErrorScope:vi.fn(async()=>({message:'invalid sampler'}))});
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});
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
    const volume={size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}};
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
    const volume={size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}};
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
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});await starting;
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(control.compute).toHaveBeenCalledOnce();
    expect(control.compute.mock.invocationCallOrder[0]).toBeLessThan(control.render.mock.invocationCallOrder[0]);
    hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    app.destroy();await flush();hidden.mockRestore();
  });
  it('rebuilds density and lighting together and never resumes a regenerated scene after teardown',async()=>{
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    expect(control.workers).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    const lateMessage=control.workers[1].onmessage!;
    app.destroy();await flush();
    lateMessage({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});await flush();
    expect(control.render).toHaveBeenCalledOnce();
    expect(device.destroy).toHaveBeenCalledOnce();
  });
  it('keeps an installed scene animating after hide/show during regeneration',async()=>{
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    const volume={size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}};
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
    const volume={size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}};
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
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});await starting;
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
    lateMessage({data:{volume:{size:1,data:new Uint8Array(4),sunsetLight:new Uint8Array(2),detail:{size:1,data:new Uint8Array(4)},supportBounds:{min:[-5,-.5,-3.5],max:[5,8,3.5]}}}});await starting;await flush();
    expect(control.originalLost).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalled();
    expect(control.render).not.toHaveBeenCalled();
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Connessione alla GPU persa');
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    app.destroy();await flush();
  });
});
