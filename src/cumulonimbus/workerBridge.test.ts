import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CumulonimbusApp} from './CumulonimbusApp';
const workers:Array<{onmessage:((event:MessageEvent)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;postMessage:ReturnType<typeof vi.fn>;terminate:ReturnType<typeof vi.fn>}>=[];
const offscreen={width:300,height:150} as OffscreenCanvas;
const flush=async()=>{for(let i=0;i<15;i++) await Promise.resolve();};
beforeEach(()=>{
  workers.length=0;history.replaceState(null,'','/?worker=1&seed=1571198069');
  Object.defineProperty(HTMLCanvasElement.prototype,'transferControlToOffscreen',{configurable:true,value:vi.fn(()=>offscreen)});
  vi.stubGlobal('Worker',class {
    onmessage:((event:MessageEvent)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;
    postMessage=vi.fn();terminate=vi.fn();constructor(){workers.push(this);}
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();history.replaceState(null,'','/');document.body.innerHTML='';delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).transferControlToOffscreen;});
function create(){const root=document.createElement('main');document.body.append(root);return{root,app:new CumulonimbusApp(root)};}
describe('render-worker ownership',()=>{
  it('reports a blocked worker constructor without rejecting startup',async()=>{
    vi.stubGlobal('Worker',class {constructor(){throw new DOMException('Blocked by CSP','SecurityError');}});
    const {root,app}=create();await expect(app.start()).resolves.toBeUndefined();
    expect(root.querySelector('[data-testid="scene-status"]')!.textContent).toContain('Blocked by CSP');
    expect(root.querySelector<HTMLButtonElement>('[data-action="pause"]')!.disabled).toBe(true);app.destroy();
  });
  it('cleans up a worker whose init message throws',async()=>{
    const {root,app}=create();
    const original=Worker;vi.stubGlobal('Worker',class extends original {constructor(){super('');workers.at(-1)!.postMessage.mockImplementation(()=>{throw new Error('Transfer failed');});}});
    await expect(app.start()).resolves.toBeUndefined();
    expect(root.textContent).toContain('Transfer failed');expect(workers[0].terminate).toHaveBeenCalledOnce();app.destroy();
  });
  it('makes worker errors terminal and rejects late output',async()=>{
    const {root,app}=create();const start=app.start();await flush();const late=workers[0].onmessage!;
    workers[0].onerror!({message:'GPU failure'} as ErrorEvent);await start;
    late({data:{type:'text',field:'status',text:'STALE'}} as MessageEvent);
    late({data:{type:'enabled',action:'benchmark',enabled:true}} as MessageEvent);
    expect(root.textContent).toContain('GPU failure');expect(root.textContent).not.toContain('STALE');
    expect(root.querySelector<HTMLButtonElement>('[data-action="benchmark"]')!.disabled).toBe(true);
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'stop'});
    late({data:{type:'closed'}} as MessageEvent);expect(workers[0].terminate).toHaveBeenCalledOnce();app.destroy();
  });
  it('transfers one surface, forwards controls and waits for renderer readiness',async()=>{
    const {root,app}=create();const start=app.start();await flush();
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage.mock.calls[0][0]).toMatchObject({type:'init',canvas:offscreen});
    expect(workers[0].postMessage.mock.calls[0][1]).toEqual([offscreen]);
    workers[0].onmessage!({data:{type:'ready'}} as MessageEvent);await start;
    const messages=workers[0].postMessage.mock.calls.length;
    root.querySelector<HTMLButtonElement>('#tab-atmosphere')!.click();
    root.querySelector<HTMLButtonElement>('[data-close-panel]')!.click();
    expect(workers[0].postMessage.mock.calls).toHaveLength(messages);
    root.querySelector('[data-action="pause"] svg')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toMatchObject({type:'action',action:'pause'});
    workers[0].onmessage!({data:{type:'state',paused:true,orbit:false,side:0}} as MessageEvent);
    expect(root.querySelector('[data-action="pause"]')!.getAttribute('aria-label')).toBe('Riprendi');
    expect(root.querySelector('[data-action="pause"] svg')).not.toBeNull();
    window.dispatchEvent(new Event('resize'));
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toMatchObject({type:'resize',viewport:{dpr:window.devicePixelRatio}});
    vi.spyOn(document,'hidden','get').mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'visibility',visible:false});
    app.destroy();workers[0].onmessage!({data:{type:'closed'}} as MessageEvent);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('forwards keyboard orbit, recenter and future hand impulses through the same worker',async()=>{
    const {root,app}=create();const start=app.start();await flush();workers[0].onmessage!({data:{type:'ready'}} as MessageEvent);await start;
    const canvas=root.querySelector('canvas')!;vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({width:800,height:600} as DOMRect);
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'rotate',dx:36,dy:0,width:800,height:600});
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Home'}));
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'action',action:'center'});
    app.applyWeatherImpulse({type:'gust',strength:.6});
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'impulse',impulse:{type:'gust',strength:.6}});
    root.querySelector<HTMLButtonElement>('[data-scene="rain"]')!.click();
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'atmosphere',intent:{type:'scene',scene:'rain'}});
    expect(root.querySelector<HTMLSelectElement>('[name="sky"]')!.value).toBe('rain');
    expect(root.querySelector('[data-scene="rain"]')!.getAttribute('aria-pressed')).toBe('true');
    app.applyAtmosphereIntent({type:'scene',scene:'sunset'});
    expect(workers[0].postMessage.mock.calls.at(-1)?.[0]).toEqual({type:'atmosphere',intent:{type:'scene',scene:'sunset'}});
    const hold=root.querySelector<HTMLInputElement>('input[name="dispersion"]')!;hold.value='100';
    app.applyWeatherImpulse({type:'condense'});expect(hold.value).toBe('0');
    workers[0].onmessage!({data:{type:'morphology',family:'multicell',seed:73}} as MessageEvent);
    expect(root.dataset.seed).toBe('73');expect(root.querySelector('[data-testid="morphology-label"]')!.textContent).toBe('Torri multiple');
    app.destroy();workers[0].onmessage!({data:{type:'closed'}} as MessageEvent);
  });
  it('cannot resume or publish stale worker output after closure during startup',async()=>{
    const {root,app}=create();const start=app.start();await flush();
    expect(workers).toHaveLength(1);const late=workers[0].onmessage!;
    app.destroy();await start;
    late({data:{type:'ready'}} as MessageEvent);late({data:{type:'text',field:'metrics',text:'STALE'}} as MessageEvent);
    expect(root.textContent).not.toContain('STALE');
    expect(root.querySelector<HTMLButtonElement>('[data-action="new-cloud"]')!.disabled).toBe(true);
    late({data:{type:'closed'}} as MessageEvent);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
});
