import {describe,it,expect} from 'vitest';
import {resolveThree186TimestampBatch,type TimestampPoolKind} from './three186TimestampBatch';

type Row=readonly [uid:string,duration:number];
interface Pool {
 currentQueryIndex:number;pendingResolve:false|null|Promise<number>;lastValue:number;
 frames:number[];queryOffsets:Map<string,number>;timestamps:Map<string,number>;
}
const rows:Row[]=[['r:1:17:f2',1],['r:2:18:f2',2],['r:1:17:f3',3],['r:2:18:f3',4]];
function resolved(pool:Pool,data:readonly Row[]){
 pool.timestamps=new Map(data);pool.frames=[...new Set(data.map(([uid])=>Number(uid.slice(uid.lastIndexOf(':f')+2))))];
 const last=pool.frames.at(-1);pool.lastValue=data.filter(([uid])=>uid.endsWith(`:f${last}`)).reduce((sum,[,ms])=>sum+ms,0);
}
function harness(data:readonly Row[]=rows){
 const pool:Pool={currentQueryIndex:data.length*2,pendingResolve:false,lastValue:7,frames:[1],
  queryOffsets:new Map(data.map(([uid],i)=>[uid,i*2])),timestamps:new Map([['r:1:17:f1',7]])};
 let calls=0;
 const renderer={backend:{timestampQueryPool:{render:pool}},async resolveTimestampsAsync(kind:TimestampPoolKind):Promise<number>{
  expect(kind).toBe('render');calls++;
  if(pool.currentQueryIndex===0)return pool.lastValue;
  pool.currentQueryIndex=0;pool.queryOffsets.clear();await Promise.resolve();resolved(pool,data);return pool.lastValue;
 }};
 return {pool,renderer,calls:()=>calls};
}
const options={revision:'186',requestAppDrawId:42,now:()=>100};
describe('Three186 timestamp batch adapter without a GPU',()=>{
 it('exports all fresh passes and groups, even when the scalar equals the previous value',async()=>{
  const h=harness(),r=await resolveThree186TimestampBatch(h.renderer,'render',options);
  expect(r.status).toBe('fresh');expect(r.passes).toHaveLength(4);expect(r.groups.map(g=>g.passSumMs)).toEqual([3,7]);
  expect(r.passes[2].queryIndices).toEqual([4,5]);expect(r.selectedThreeFrame).toBe(3);expect(r.returnedScalarMs).toBe(7);
  expect(r.appDrawMapping).toBe('not-verified');expect(r.requestAppDrawId).toBe(42);expect(r.passes[0]).not.toHaveProperty('appDrawId');
  expect(h.calls()).toBe(1);h.pool.timestamps.clear();expect(r.after.timestamps).toHaveLength(4);
 });
 it('does not count an empty batch or unchanged lastValue as new query data',async()=>{
  const h=harness();h.pool.currentQueryIndex=0;h.pool.queryOffsets.clear();
  const empty=await resolveThree186TimestampBatch(h.renderer,'render',options);
  expect(empty.status).toBe('empty');expect(empty.returnedScalarMs).toBe(7);expect(empty.passes).toEqual([]);expect(empty.observedAfter).toHaveLength(1);
  const cached=harness();cached.renderer.resolveTimestampsAsync=async()=>7;
  const old=await resolveThree186TimestampBatch(cached.renderer,'render',options);
  expect(old.status).toBe('cached');expect(old.fresh).toBe(false);expect(old.passes).toEqual([]);
 });
 it('distinguishes the owning async resolve from a shared pending batch',async()=>{
  const h=harness();let release=()=>{};
  h.renderer.resolveTimestampsAsync=async()=>{
   if(h.pool.currentQueryIndex===0)return h.pool.lastValue;
   if(h.pool.pendingResolve)return h.pool.pendingResolve;
   h.pool.currentQueryIndex=0;h.pool.queryOffsets.clear();
   const pending=new Promise<number>(done=>{release=()=>{resolved(h.pool,rows);done(h.pool.lastValue);};});
   h.pool.pendingResolve=pending;
   try{return await pending;}finally{h.pool.pendingResolve=null;}
  };
  const owner=resolveThree186TimestampBatch(h.renderer,'render',options);
  h.pool.currentQueryIndex=2;h.pool.queryOffsets.set('r:1:17:f4',0);
  const shared=resolveThree186TimestampBatch(h.renderer,'render',options);
  release();const [fresh,stale]=await Promise.all([owner,shared]);
  expect(fresh.status).toBe('fresh');expect(fresh.passes).toHaveLength(4);
  expect(stale.status).toBe('shared-pending');expect(stale.passes).toEqual([]);expect(stale.observedAfter).toHaveLength(4);
 });
 it('gracefully delegates with absent internals or an unsupported revision',async()=>{
  let calls=0;
  const absent=await resolveThree186TimestampBatch({async resolveTimestampsAsync(){calls++;return 4;}},'render',options);
  expect(calls).toBe(1);expect(absent.status).toBe('unavailable');expect(absent.returnedScalarMs).toBe(4);
  const h=harness(),unsupported=await resolveThree186TimestampBatch(h.renderer,'render',{...options,revision:'187'});
  expect(unsupported.status).toBe('unsupported-revision');expect(unsupported.fresh).toBe(false);expect(h.calls()).toBe(1);
 });
 it('rejects a replaced pool, malformed UID and unaccounted allocated query pairs',async()=>{
  const h=harness();h.renderer.resolveTimestampsAsync=async()=>{h.renderer.backend.timestampQueryPool.render={...h.pool};return 7;};
  expect((await resolveThree186TimestampBatch(h.renderer,'render',options)).status).toBe('pool-replaced');
  const gap=harness();gap.pool.currentQueryIndex=10;
  expect((await resolveThree186TimestampBatch(gap.renderer,'render',options)).status).toBe('unverified');
  const bad=harness([['r:bad:17:f2',7]]);
  expect((await resolveThree186TimestampBatch(bad.renderer,'render',options)).status).toBe('unverified');
 });
 it('preserves real zero-duration query samples and exposes resolver errors',async()=>{
  const zero=harness([['r:1:17:f2',0]]),result=await resolveThree186TimestampBatch(zero.renderer,'render',options);
  expect(result.fresh).toBe(true);expect(result.passes[0].durationMs).toBe(0);
  const h=harness();h.renderer.resolveTimestampsAsync=async()=>{throw new Error('readback failed');};
  const failure=await resolveThree186TimestampBatch(h.renderer,'render',options);
  expect(failure.status).toBe('error');expect(failure.reason).toBe('readback failed');expect(failure.passes).toEqual([]);
 });
});
