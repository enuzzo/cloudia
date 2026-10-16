// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {setImmediate as realImmediate} from 'node:timers';
import {NativeFrameExporter,NATIVE_FRAME_MAX_PIXELS,NATIVE_FRAME_MAX_PNG_BYTES,NATIVE_FRAME_TIMEOUT_MS,type NativeCanvasLike,type NativeFrameExportEvent} from './nativeFrameExport';

const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=','base64'));
const png=()=>new Blob([bytes],{type:'image/png'});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const owners:NativeFrameExporter[]=[];
function harness(){
 const events:NativeFrameExportEvent[]=[],availability:{busy:boolean;waiting:boolean}[]=[];
 let wake:((event:NativeFrameExportEvent)=>void)|null=null;
 const exporter=new NativeFrameExporter(event=>{events.push(event);wake?.(event);},()=>availability.push({busy:exporter.busy,waiting:exporter.waiting}));owners.push(exporter);
 function event(state:NativeFrameExportEvent['state']):Promise<NativeFrameExportEvent>{
  const existing=events.find(e=>e.state===state);if(existing)return Promise.resolve(existing);
  return new Promise(resolve=>{wake=e=>{if(e.state===state){wake=null;resolve(e);}};});
 }
 return {exporter,events,availability,event};
}
async function flush(){for(let n=0;n<8;n++)await Promise.resolve();await new Promise<void>(resolve=>realImmediate(resolve));}
afterEach(()=>{for(const owner of owners)owner.dispose();owners.length=0;vi.restoreAllMocks();vi.useRealTimers();});

describe('native frame export state and same-draw acquisition',()=>{
 it('clones the applied DTO then starts the main encoder synchronously before capture returns',async()=>{
  const h=harness(),order:string[]=[],callback=deferred<(blob:Blob|null)=>void>();
  const mutable={time:60,camera:{origin:[1,2,3]}},canvas={width:1,height:1,toBlob:vi.fn((done:(blob:Blob|null)=>void,mime?:string)=>{order.push('encoder');expect(mime).toBe('image/png');callback.resolve(done);mutable.time=99;canvas.width=9;})};
  const metadata={get frame(){order.push('snapshot');return mutable;}};
  expect(h.exporter.request(1)).toBe(true);order.push('draw');h.exporter.capture(canvas,metadata);order.push('returned');
  expect(order).toEqual(['draw','snapshot','encoder','returned']);expect(h.exporter.waiting).toBe(false);expect(h.exporter.busy).toBe(true);
  mutable.camera.origin[0]=777;const ready=h.event('ready');(await callback.promise)(png());const result=await ready;
  expect(result.state).toBe('ready');if(result.state!=='ready')throw Error('Missing ready');
  expect(result.metadata).toEqual({frame:{time:60,camera:{origin:[1,2,3]}}});expect(result.info).toEqual({mime:'image/png',width:1,height:1,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  expect(result.png).toBeInstanceOf(Blob);expect(result.busy).toBe(true);await flush();expect(h.exporter.busy).toBe(false);
  expect(h.availability).toEqual([{busy:true,waiting:true},{busy:true,waiting:false},{busy:false,waiting:false}]);
 });
 it('starts an OffscreenCanvas-shaped encoder synchronously without DOM constructors',async()=>{
  const h=harness(),encoded=deferred<Blob>(),canvas:NativeCanvasLike={width:1,height:1,convertToBlob:vi.fn(()=>encoded.promise)};
  h.exporter.request(2);h.exporter.capture(canvas,{thread:'worker'});
  expect(canvas.convertToBlob).toHaveBeenCalledOnce();expect(canvas.convertToBlob).toHaveBeenCalledWith({type:'image/png'});
  const ready=h.event('ready');encoded.resolve(png());expect((await ready).requestId).toBe(2);await flush();expect(h.exporter.busy).toBe(false);
 });
 it('ignores capture without a pending draw and rejects overlap without replacing its owner',async()=>{
  const h=harness(),canvas={width:1,height:1,toBlob:vi.fn((done:(blob:Blob|null)=>void)=>done(png()))};
  h.exporter.capture(canvas,{});expect(canvas.toBlob).not.toHaveBeenCalled();h.exporter.request(10);expect(h.exporter.request(11)).toBe(false);
  expect(h.exporter.waiting).toBe(true);expect(h.events.at(-1)).toMatchObject({state:'error',requestId:11,busy:true});
  const ready=h.event('ready');h.exporter.capture(canvas,{owner:10});expect((await ready).requestId).toBe(10);await flush();expect(canvas.toBlob).toHaveBeenCalledOnce();
 });
 it('cancels only requests still waiting for a draw',async()=>{
  const h=harness(),encoded=deferred<Blob>();h.exporter.request(3);h.exporter.cancelPending('Scene changed before draw');
  expect(h.events.at(-1)).toMatchObject({state:'error',message:'Scene changed before draw',busy:false});expect(h.exporter.waiting).toBe(false);
  h.exporter.request(4);h.exporter.capture({width:1,height:1,convertToBlob:()=>encoded.promise},{seed:74});h.exporter.cancelPending('new scene');
  const ready=h.event('ready');encoded.resolve(png());expect((await ready).requestId).toBe(4);await flush();
 });
 it('rejects uncloneable DTOs before acquiring the encoder',()=>{
  const h=harness(),canvas={width:1,height:1,toBlob:vi.fn()};h.exporter.request(5);h.exporter.capture(canvas,{bad:()=>1});
  expect(canvas.toBlob).not.toHaveBeenCalled();expect(h.events.at(-1)).toMatchObject({state:'error',requestId:5,busy:false});expect(h.exporter.busy).toBe(false);
 });
});

describe('PNG validation and bounded allocation',()=>{
 it.each([['null',null],['wrong MIME',new Blob([bytes],{type:'image/jpeg'})],['empty',new Blob([],{type:'image/png'})]])('handles %s without publishing ready',async(_label,blob)=>{
  const h=harness();h.exporter.request(1);const error=h.event('error');h.exporter.capture({width:1,height:1,toBlob:done=>done(blob)},{});await error;await flush();
  expect(h.events.some(e=>e.state==='ready')).toBe(false);expect(h.exporter.busy).toBe(false);
 });
 it('rejects signature, IHDR and canvas dimension mismatch',async()=>{
  for(const kind of ['signature','IHDR','dimensions']){
   const h=harness(),invalid=bytes.slice();if(kind==='signature')invalid[0]=0;if(kind==='IHDR')invalid[12]=0;if(kind==='dimensions')invalid[19]=2;
   h.exporter.request(1);const error=h.event('error');h.exporter.capture({width:1,height:1,toBlob:done=>done(new Blob([invalid],{type:'image/png'}))},{});await error;await flush();
   expect(h.events.some(e=>e.state==='ready')).toBe(false);expect(h.exporter.busy).toBe(false);
  }
 });
 it('rejects invalid or oversized canvas dimensions without invoking an encoder',()=>{
  for(const [width,height] of [[0,1],[1,0],[Infinity,1],[1.5,1],[NATIVE_FRAME_MAX_PIXELS+1,1]]){
   const h=harness(),toBlob=vi.fn();h.exporter.request(1);h.exporter.capture({width,height,toBlob},{});
   expect(toBlob).not.toHaveBeenCalled();expect(h.events.at(-1)).toMatchObject({state:'error',busy:false});
  }
 });
 it('allows the exact pixel bound to reach the encoder without resizing',async()=>{
  const h=harness(),toBlob=vi.fn((done:(blob:Blob|null)=>void)=>done(null));h.exporter.request(1);const error=h.event('error');h.exporter.capture({width:4096,height:2048,toBlob},{});await error;
  expect(4096*2048).toBe(NATIVE_FRAME_MAX_PIXELS);expect(toBlob).toHaveBeenCalledOnce();await flush();
 });
 it('checks Blob byte limits before reading its buffer',async()=>{
  const h=harness(),arrayBuffer=vi.fn(),oversized={type:'image/png',size:NATIVE_FRAME_MAX_PNG_BYTES+1,arrayBuffer} as unknown as Blob;
  h.exporter.request(1);const error=h.event('error');h.exporter.capture({width:1,height:1,toBlob:done=>done(oversized)},{});await error;await flush();expect(arrayBuffer).not.toHaveBeenCalled();expect(h.exporter.busy).toBe(false);
 });
 it('checks Blob byteLength against the actual returned buffer',async()=>{
  const h=harness(),bad={type:'image/png',size:bytes.length+1,arrayBuffer:async()=>bytes.slice().buffer} as Blob;
  h.exporter.request(1);const error=h.event('error');h.exporter.capture({width:1,height:1,toBlob:done=>done(bad)},{});await error;await flush();expect(h.events.at(-1)).toMatchObject({state:'error',message:expect.stringContaining('byte length')});
 });
 it.each(['throw','reject','buffer'])('drains physical state after %s errors',async(kind)=>{
  const h=harness(),broken=png();if(kind==='buffer')vi.spyOn(broken,'arrayBuffer').mockRejectedValue(new Error('read failed'));
  const canvas:NativeCanvasLike=kind==='throw'?{width:1,height:1,toBlob:()=>{throw new Error('SecurityError');}}:{width:1,height:1,convertToBlob:()=>kind==='reject'?Promise.reject(new Error('encode failed')):Promise.resolve(broken)};
  h.exporter.request(1);const error=h.event('error');h.exporter.capture(canvas,{});await error;await flush();expect(h.exporter.busy).toBe(false);expect(h.events.filter(e=>e.state==='error')).toHaveLength(1);
 });
});

describe('timeouts, clear and destruction',()=>{
 it('releases a waiting timeout and never starts a later capture for that request',()=>{
  vi.useFakeTimers();const h=harness(),toBlob=vi.fn();h.exporter.request(1);vi.advanceTimersByTime(NATIVE_FRAME_TIMEOUT_MS);
  expect(h.exporter.busy).toBe(false);expect(h.events.at(-1)).toMatchObject({requestId:1,state:'error',busy:false});h.exporter.capture({width:1,height:1,toBlob},{});expect(toBlob).not.toHaveBeenCalled();expect(h.exporter.request(2)).toBe(true);
 });
 it('uses one request deadline and holds the physical slot after timeout until the late encoder ends',async()=>{
  vi.useFakeTimers();const h=harness();let callback!:(blob:Blob|null)=>void;const toBlob=vi.fn((done:(blob:Blob|null)=>void)=>{callback=done;});
  h.exporter.request(1);vi.advanceTimersByTime(15_000);h.exporter.capture({width:1,height:1,toBlob},{});vi.advanceTimersByTime(5_000);
  expect(h.events.at(-1)).toMatchObject({requestId:1,state:'error',busy:true});expect(h.exporter.waiting).toBe(false);expect(h.exporter.request(2)).toBe(false);callback(png());await flush();
  expect(h.events.some(e=>e.state==='ready')).toBe(false);expect(h.exporter.busy).toBe(false);expect(toBlob).toHaveBeenCalledOnce();expect(h.exporter.request(3)).toBe(true);
 });
 it('clear invalidates late callbacks and repeated requests cannot accumulate encoders',async()=>{
  const h=harness(),callbacks:((blob:Blob|null)=>void)[]=[],toBlob=vi.fn((done:(blob:Blob|null)=>void)=>callbacks.push(done));
  h.exporter.request(1);h.exporter.capture({width:1,height:1,toBlob},{old:true});h.exporter.clear(2);expect(h.events.at(-1)).toMatchObject({state:'cleared',requestId:2,busy:true});
  for(let id=3;id<8;id++){expect(h.exporter.request(id)).toBe(false);h.exporter.clear(id);}expect(toBlob).toHaveBeenCalledOnce();callbacks[0](png());await flush();expect(h.events.some(e=>e.state==='ready')).toBe(false);
  expect(h.exporter.request(8)).toBe(true);h.exporter.capture({width:1,height:1,toBlob},{new:true});callbacks[0](png());await flush();expect(h.exporter.busy).toBe(true);expect(toBlob).toHaveBeenCalledTimes(2);
  const ready=h.event('ready');callbacks[1](png());expect((await ready).requestId).toBe(8);await flush();expect(h.exporter.busy).toBe(false);
 });
 it('keeps validation in the physical slot even when clear invalidates the request',async()=>{
  const h=harness(),read=deferred<ArrayBuffer>(),hash=deferred<ArrayBuffer>(),blob=png();vi.spyOn(blob,'arrayBuffer').mockReturnValue(read.promise);const digest=vi.spyOn(crypto.subtle,'digest').mockReturnValue(hash.promise);
  h.exporter.request(1);h.exporter.capture({width:1,height:1,toBlob:done=>done(blob)},{});await flush();expect(blob.arrayBuffer).toHaveBeenCalledOnce();h.exporter.clear(2);expect(h.exporter.busy).toBe(true);expect(h.exporter.request(3)).toBe(false);
  read.resolve(bytes.slice().buffer);await flush();expect(digest).toHaveBeenCalledOnce();expect(h.exporter.busy).toBe(true);hash.resolve(new ArrayBuffer(32));await flush();expect(h.exporter.busy).toBe(false);expect(h.events.some(e=>e.state==='ready')).toBe(false);
 });
 it('keeps the deadline active while Blob validation is pending after encoding',async()=>{
  vi.useFakeTimers();const h=harness(),read=deferred<ArrayBuffer>(),blob=png();vi.spyOn(blob,'arrayBuffer').mockReturnValue(read.promise);vi.spyOn(crypto.subtle,'digest').mockResolvedValue(new ArrayBuffer(32));
  h.exporter.request(1);h.exporter.capture({width:1,height:1,toBlob:done=>done(blob)},{});await flush();expect(blob.arrayBuffer).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(NATIVE_FRAME_TIMEOUT_MS);expect(h.events.at(-1)).toMatchObject({requestId:1,state:'error',busy:true});expect(h.exporter.request(2)).toBe(false);
  read.resolve(bytes.slice().buffer);await flush();expect(h.events.some(e=>e.state==='ready')).toBe(false);expect(h.exporter.busy).toBe(false);
 });
 it('clears waiting state without reusing a timer or retaining a logical request',()=>{
  vi.useFakeTimers();const h=harness();h.exporter.request(1);h.exporter.clear(2);expect(h.exporter.busy).toBe(false);expect(h.events.at(-1)).toMatchObject({state:'cleared',requestId:2,busy:false});const count=h.events.length;vi.advanceTimersByTime(NATIVE_FRAME_TIMEOUT_MS*2);expect(h.events).toHaveLength(count);expect(h.exporter.request(1)).toBe(true);
 });
 it('disposes waiting silently and makes subsequent requests/captures no-ops',()=>{
  vi.useFakeTimers();const h=harness(),toBlob=vi.fn();h.exporter.request(1);const events=h.events.length,availability=h.availability.length;h.exporter.dispose();h.exporter.dispose();vi.advanceTimersByTime(NATIVE_FRAME_TIMEOUT_MS*2);
  expect(h.events).toHaveLength(events);expect(h.availability).toHaveLength(availability);expect(h.exporter.busy).toBe(false);expect(h.exporter.request(2)).toBe(false);h.exporter.capture({width:1,height:1,toBlob},{});h.exporter.clear(3);expect(toBlob).not.toHaveBeenCalled();expect(h.events).toHaveLength(events);
 });
 it('disposes physical work without publishing or notifying when its late callback arrives',async()=>{
  const h=harness(),encoded=deferred<Blob>();h.exporter.request(1);h.exporter.capture({width:1,height:1,convertToBlob:()=>encoded.promise},{});const events=h.events.length,availability=h.availability.length;h.exporter.dispose();expect(h.exporter.busy).toBe(true);encoded.resolve(png());await flush();expect(h.exporter.busy).toBe(false);expect(h.events).toHaveLength(events);expect(h.availability).toHaveLength(availability);
 });
});
