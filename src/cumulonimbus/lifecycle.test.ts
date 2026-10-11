import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const control = vi.hoisted(()=>({initResolve:()=>{},renderer:null as null | {dispose:ReturnType<typeof vi.fn>;onDeviceLost:()=>void;initialized:boolean},workers:[] as Array<{onmessage:((event:unknown)=>void)|null;terminate:ReturnType<typeof vi.fn>}>,render:vi.fn(),originalLost:vi.fn()}));
vi.mock('three/webgpu',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('three/webgpu')>();
  return {...actual,WebGPURenderer:class {
    backend={isWebGPUBackend:true}; domElement=document.createElement('canvas'); initialized=false;
    dispose=vi.fn(); onDeviceLost=control.originalLost;
    constructor() {control.renderer=this;}
    async init() {await new Promise<void>(resolve=>{control.initResolve=resolve;});this.initialized=true;}
    hasFeature() {return false;}
    setPixelRatio() {} setSize() {}
  },QuadMesh:class {render=control.render;}};
});
import { CumulonimbusApp } from './CumulonimbusApp';
async function flush() {for(let i=0;i<15;i++) await Promise.resolve();}
const device={destroy:vi.fn()};
beforeEach(()=>{
  vi.clearAllMocks(); control.renderer=null; control.workers=[];
  Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({info:{vendor:'test'},features:new Set(),requestDevice:async()=>device})}});
  vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1)); vi.stubGlobal('cancelAnimationFrame',vi.fn());
  vi.stubGlobal('Worker',class {
    onmessage:((event:unknown)=>void)|null=null; terminate=vi.fn();
    constructor() {control.workers.push(this);} postMessage() {}
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});
function createApp() {const root=document.createElement('main');document.body.append(root);return {app:new CumulonimbusApp(root),root};}
describe('scene async lifecycle',()=>{
  it('starts exactly one RAF when initial generation finishes in a hidden tab',async()=>{
    const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);
    const {app}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),detail:{size:1,data:new Uint8Array(4)}}}});await starting;
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    app.destroy();await flush();hidden.mockRestore();
  });
  it('rebuilds density and lighting together and never resumes a regenerated scene after teardown',async()=>{
    const {app,root}=createApp();const starting=app.start();await flush();control.initResolve();await flush();
    control.workers[0].onmessage!({data:{volume:{size:1,data:new Uint8Array(4),detail:{size:1,data:new Uint8Array(4)}}}});await starting;
    root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.click();await flush();
    expect(control.workers).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    const lateMessage=control.workers[1].onmessage!;
    app.destroy();await flush();
    lateMessage({data:{volume:{size:1,data:new Uint8Array(4),detail:{size:1,data:new Uint8Array(4)}}}});await flush();
    expect(control.render).toHaveBeenCalledOnce();
    expect(device.destroy).toHaveBeenCalledOnce();
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
    lateMessage({data:{volume:{size:1,data:new Uint8Array(4),detail:{size:1,data:new Uint8Array(4)}}}});await starting;await flush();
    expect(control.originalLost).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalled();
    expect(control.render).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    app.destroy();await flush();
  });
});
