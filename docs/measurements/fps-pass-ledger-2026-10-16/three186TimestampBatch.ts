/** Opt-in benchmark adapter for the inspected Three 0.186.0 pool layout.
 * Replaces an existing resolve call; allocates no GPU queries/resources.
 * Uses pinned internals defensively. Durations are pass sums, never frame time.
 */
export type TimestampPoolKind='render'|'compute';
export interface PoolSnapshot {
 available:boolean;reason:string|null;currentQueryIndex:number|null;pendingResolve:boolean|null;
 lastValue:number|null;frames:number[];offsets:{uid:string;baseOffset:number}[];
 timestamps:{uid:string;durationMs:number}[];
}
export interface TimestampPass {
 uid:string;kind:TimestampPoolKind;threeFrame:number;frameCall:number;contextId:string;
 durationMs:number;queryIndices:[number,number]|null;
}
export interface TimestampFrameGroup {
 threeFrame:number;passCount:number;passSumMs:number;uids:string[];
}
export interface TimestampBatchReport {
 adapter:'three-r186-timestamp-batch-v1';revision:string;kind:TimestampPoolKind;
 status:'fresh'|'empty'|'cached'|'shared-pending'|'unavailable'|'unsupported-revision'|'pool-replaced'|'unverified'|'error';
 reason:string|null;fresh:boolean;requestAppDrawId:number|null;appDrawMapping:'not-verified';
 requestedAtMs:number;resolvedAtMs:number;returnedScalarMs:number|null;
 before:PoolSnapshot;after:PoolSnapshot;
 /** Only validated fresh rows may enter aggregates. */
 passes:TimestampPass[];groups:TimestampFrameGroup[];
 /** Diagnostic observations are not automatically fresh or aligned to this request. */
 observedAfter:TimestampPass[];selectedThreeFrame:number|null;selectedPassSumMs:number|null;
}
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&(typeof v==='object'||typeof v==='function')?v as Record<string,unknown>:null;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const uint=(v:unknown):v is number=>finite(v)&&Number.isSafeInteger(v)&&v>=0;
const absent=(reason:string):PoolSnapshot=>({available:false,reason,currentQueryIndex:null,pendingResolve:null,lastValue:null,frames:[],offsets:[],timestamps:[]});
function capture(renderer:unknown,kind:TimestampPoolKind):{identity:unknown;snapshot:PoolSnapshot}{
 try{
  const backend=object(object(renderer)?.backend),pools=object(backend?.timestampQueryPool),pool=object(pools?.[kind]);
  if(!pool)return {identity:null,snapshot:absent('Timestamp pool absent')};
  if(!(pool.queryOffsets instanceof Map)||!(pool.timestamps instanceof Map)||!Array.isArray(pool.frames)||
   !uint(pool.currentQueryIndex)||!finite(pool.lastValue)||pool.pendingResolve===undefined){
   return {identity:pool,snapshot:absent('Inspected r186 pool properties absent or incompatible')};
  }
  const offsets:{uid:string;baseOffset:number}[]=[],timestamps:{uid:string;durationMs:number}[]=[];
  for(const [uid,baseOffset] of pool.queryOffsets){
   if(typeof uid!=='string'||!uint(baseOffset))return {identity:pool,snapshot:absent('Invalid query offset entry')};
   offsets.push({uid,baseOffset});
  }
  for(const [uid,durationMs] of pool.timestamps){
   if(typeof uid!=='string'||!finite(durationMs)||durationMs<0)return {identity:pool,snapshot:absent('Invalid timestamp entry')};
   timestamps.push({uid,durationMs});
  }
  if(!pool.frames.every(uint))return {identity:pool,snapshot:absent('Invalid Three frame list')};
  return {identity:pool,snapshot:{available:true,reason:null,currentQueryIndex:pool.currentQueryIndex,
   pendingResolve:Boolean(pool.pendingResolve),lastValue:pool.lastValue,frames:[...pool.frames] as number[],offsets,timestamps}};
 }catch(error){return {identity:null,snapshot:absent(error instanceof Error?error.message:String(error))};}
}
function parse(uid:string,durationMs:number,kind:TimestampPoolKind):TimestampPass|null{
 const match=/^([rc]):(\d+):(.*):f(\d+)$/.exec(uid);
 if(!match||match[1]!== (kind==='render'?'r':'c'))return null;
 const frameCall=Number(match[2]),threeFrame=Number(match[4]);
 if(!uint(frameCall)||!uint(threeFrame))return null;
 return {uid,kind,threeFrame,frameCall,contextId:match[3],durationMs,queryIndices:null};
}
const signature=(rows:readonly {uid:string}[])=>JSON.stringify(rows.map(r=>r.uid));
function group(rows:readonly TimestampPass[]):TimestampFrameGroup[]{
 const groups=new Map<number,TimestampFrameGroup>();
 for(const row of rows){
  let item=groups.get(row.threeFrame);
  if(!item){item={threeFrame:row.threeFrame,passCount:0,passSumMs:0,uids:[]};groups.set(row.threeFrame,item);}
  item.passCount++;item.passSumMs+=row.durationMs;item.uids.push(row.uid);
 }
 return [...groups.values()];
}
/** Call once IN PLACE OF renderer.resolveTimestampsAsync(kind).
 * requestAppDrawId identifies the JS request only; it never labels returned passes.
 * A separate verified draw→(Three frame, frameCalls range) ledger is needed.
 */
export async function resolveThree186TimestampBatch(renderer:unknown,kind:TimestampPoolKind,
 options:{revision:string|number;requestAppDrawId?:number|null;now?:()=>number}):Promise<TimestampBatchReport>{
 const now=options.now??(()=>performance.now()),requestedAtMs=now(),before=capture(renderer,kind);
 let scalar:unknown,error:string|null=null;
 try{
  const resolve=object(renderer)?.resolveTimestampsAsync;
  if(typeof resolve!=='function')throw new Error('renderer.resolveTimestampsAsync is absent');
  scalar=await resolve.call(renderer,kind);
 }catch(reason){error=reason instanceof Error?reason.message:String(reason);}
 const after=capture(renderer,kind),resolvedAtMs=now();
 const observedAfter=after.snapshot.timestamps.map(row=>parse(row.uid,row.durationMs,kind)).filter((r):r is TimestampPass=>r!==null);
 const observedGroups=group(observedAfter),selectedThreeFrame=after.snapshot.frames.at(-1)??null;
 const selectedPassSumMs=observedGroups.find(g=>g.threeFrame===selectedThreeFrame)?.passSumMs??null;
 const result:TimestampBatchReport={adapter:'three-r186-timestamp-batch-v1',revision:String(options.revision),kind,
  status:'unverified',reason:null,fresh:false,requestAppDrawId:options.requestAppDrawId??null,appDrawMapping:'not-verified',
  requestedAtMs,resolvedAtMs,returnedScalarMs:finite(scalar)?scalar:null,before:before.snapshot,after:after.snapshot,
  passes:[],groups:[],observedAfter,selectedThreeFrame,selectedPassSumMs};
 const stop=(status:TimestampBatchReport['status'],reason:string)=>{result.status=status;result.reason=reason;return result;};
 if(error!==null)return stop('error',error); // Caller must preserve its previous error policy.
 if(String(options.revision)!=='186')return stop('unsupported-revision','This adapter only recognizes the inspected Three revision 186');
 if(!before.snapshot.available||!after.snapshot.available)return stop('unavailable',before.snapshot.reason??after.snapshot.reason??'Pool unavailable');
 if(before.identity!==after.identity)return stop('pool-replaced','Pool identity changed while resolving');
 if(before.snapshot.currentQueryIndex===0)return stop('empty','No allocated queries at request; r186 may return lastValue');
 if(before.snapshot.pendingResolve)return stop('shared-pending','An older resolve was already pending; the requested offsets do not identify its batch');
 if(!finite(scalar)||scalar<0)return stop('unverified','Resolve did not return a finite nonnegative scalar');
 if(signature(before.snapshot.timestamps)===signature(after.snapshot.timestamps))return stop('cached','Resolved UID signature unchanged: cached scalar or UID reuse cannot be distinguished');
 if(observedAfter.length!==after.snapshot.timestamps.length)return stop('unverified','One or more UID formats differ from the inspected r186 layout');
 const requested=before.snapshot.offsets;
 if(signature(requested)!==signature(after.snapshot.timestamps))return stop('unverified','Resolved UIDs do not match the pre-resolve offset snapshot');
 const indices=requested.map(r=>r.baseOffset),queryCount=before.snapshot.currentQueryIndex!;
 if(queryCount!==requested.length*2||new Set(indices).size!==indices.length||
  indices.some(i=>i%2!==0||i+1>=queryCount))return stop('unverified','Offset map does not uniquely cover every allocated query pair');
 const expectedFrames=[...new Set(observedAfter.map(p=>p.threeFrame))];
 if(JSON.stringify(expectedFrames)!==JSON.stringify(after.snapshot.frames))return stop('unverified','Frame list differs from the resolved UID order');
 if(selectedPassSumMs===null||Math.abs(selectedPassSumMs-scalar)>1e-9*Math.max(1,Math.abs(scalar)))return stop('unverified','Last-frame pass sum differs from returned scalar');
 if(after.snapshot.lastValue!==scalar)return stop('unverified','Pool lastValue differs from returned scalar');
 const offsets=new Map(requested.map(r=>[r.uid,r.baseOffset]));
 result.passes=observedAfter.map((p):TimestampPass=>({...p,queryIndices:[offsets.get(p.uid)!,offsets.get(p.uid)!+1]}));
 result.groups=group(result.passes);result.status='fresh';result.fresh=true;
 return result;
}
