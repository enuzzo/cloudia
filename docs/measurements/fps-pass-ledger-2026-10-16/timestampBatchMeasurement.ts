import type {TimestampBatchReport,TimestampPass,TimestampPoolKind} from './three186TimestampBatch';

export interface TimestampDrawCounters {frame:number;renderFrameCalls:number;computeFrameCalls:number}
export interface TimestampDrawLedger {
 id:number;measuredIntervalId:number|null;before:TimestampDrawCounters;after:TimestampDrawCounters;
}
export interface TimestampDrawCoverage {
 status:'complete'|'partial'|'missing'|'not-requested'|'invalid-ledger'|'conflict';
 expectedCalls:number|null;matchedFreshCalls:number;missingCallRanges:[number,number][];
 duplicateCallNumbers:number[];uids:string[];passSumMs:number|null;
}
export interface TimestampMeasuredSample {drawId:number;intervalId:number;passCount:number;passSumMs:number}
interface KindCoverage {
 measuredDraws:number;expectedCalls:number;matchedFreshCalls:number;completeDraws:number;
 partialDraws:number;missingDraws:number;notRequestedDraws:number;invalidLedgerDraws:number;conflictDraws:number;
}
export interface TimestampBatchMeasurementReport {
 status:'open'|'closed';method:string;
 draws:{ledgerIndex:number;id:number;measuredIntervalId:number|null;issues:string[];
  before:TimestampDrawCounters;after:TimestampDrawCounters;render:TimestampDrawCoverage;compute:TimestampDrawCoverage}[];
 rawBatches:TimestampBatchReport[];
 diagnostics:{batchCount:number;freshBatchCount:number;staleBatchCount:number;staleObservedPassRows:number;
  batchStatusCounts:Partial<Record<TimestampBatchReport['status'],number>>;freshPassRows:number;
  invalidPassRows:number;unmatchedPassRows:number;ambiguousPassRows:number;duplicateUidRows:number;duplicateCallSlots:number;
  outsideWindowPassRows:number;duplicateLedgerIds:number[];duplicateMeasuredIntervalIds:number[]};
 unmatchedPasses:{pass:TimestampPass;reason:'invalid-pass'|'no-ledger-range'|'ambiguous-ledger-range';candidateDrawIds:number[]}[];
 coverage:Record<TimestampPoolKind,KindCoverage>;
 completeSamples:Record<TimestampPoolKind,TimestampMeasuredSample[]>;
 statistics:Record<TimestampPoolKind,{sampleCount:number;meanMs:number;p95Ms:number;maxMs:number}|null>;
}
const kinds:TimestampPoolKind[]=['render','compute'];
const uint=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const copyPass=(p:TimestampPass):TimestampPass=>({...p,queryIndices:p.queryIndices?[...p.queryIndices]:null});
const copyBatch=(b:TimestampBatchReport):TimestampBatchReport=>{
 const snapshot=(s:TimestampBatchReport['before'])=>({...s,frames:[...s.frames],offsets:s.offsets.map(r=>({...r})),timestamps:s.timestamps.map(r=>({...r}))});
 return {...b,before:snapshot(b.before),after:snapshot(b.after),passes:b.passes.map(copyPass),
  groups:b.groups.map(g=>({...g,uids:[...g.uids]})),observedAfter:b.observedAfter.map(copyPass)};
};
const counter=(d:TimestampDrawCounters,k:TimestampPoolKind)=>k==='render'?d.renderFrameCalls:d.computeFrameCalls;
const emptyKind=():KindCoverage=>({measuredDraws:0,expectedCalls:0,matchedFreshCalls:0,completeDraws:0,
 partialDraws:0,missingDraws:0,notRequestedDraws:0,invalidLedgerDraws:0,conflictDraws:0});
const repeated=(values:readonly number[])=>{const counts=new Map<number,number>();for(const v of values)counts.set(v,(counts.get(v)??0)+1);return [...counts].filter(([,n])=>n>1).map(([v])=>v);};
function validPass(p:TimestampPass,kind:TimestampPoolKind):boolean{
 const pair=p.queryIndices;
 return p.kind===kind&&uint(p.threeFrame)&&uint(p.frameCall)&&p.frameCall>0&&p.contextId.length>0&&
  p.uid===`${kind==='render'?'r':'c'}:${p.frameCall}:${p.contextId}:f${p.threeFrame}`&&
  typeof p.durationMs==='number'&&Number.isFinite(p.durationMs)&&p.durationMs>=0&&
  pair!==null&&pair.length===2&&uint(pair[0])&&pair[0]%2===0&&pair[1]===pair[0]+1;
}
/** Benchmark-only ledger. Record all draws (warmup/outside-window use intervalId:null),
 * and route async batches to the instance captured when their resolve began.
 * No raw scalar is promoted to an app draw. Snapshots are explicit, not per-frame.
 */
export class TimestampBatchMeasurement {
 private closed=false;
 private readonly ledger:TimestampDrawLedger[]=[];
 private readonly batches:TimestampBatchReport[]=[];
 recordDraw(draw:TimestampDrawLedger):boolean{
  if(this.closed)return false;
  this.ledger.push({...draw,before:{...draw.before},after:{...draw.after}});return true;
 }
 recordBatch(batch:TimestampBatchReport):boolean{
  if(this.closed)return false;
  this.batches.push(copyBatch(batch));return true;
 }
 /** Cancellation/device loss: reject later callbacks without aggregating discarded data. */
 close():void{this.closed=true;}
 /** Snapshot only data already received; never waits for more queries or readbacks. */
 finish():TimestampBatchMeasurementReport{this.close();return this.snapshot();}
 snapshot():TimestampBatchMeasurementReport{
  const duplicateLedgerIds=repeated(this.ledger.filter(d=>uint(d.id)).map(d=>d.id));
  const duplicateIntervals=repeated(this.ledger.filter(d=>d.measuredIntervalId!==null&&uint(d.measuredIntervalId)).map(d=>d.measuredIntervalId!));
  const duplicateIds=new Set(duplicateLedgerIds),duplicateMeasured=new Set(duplicateIntervals);
  type Entry={draw:TimestampDrawLedger;issues:string[];valid:Record<TimestampPoolKind,boolean>};
  const entries:Entry[]=this.ledger.map(draw=>{
   const issues:string[]=[];
   if(!uint(draw.id))issues.push('invalid-draw-id');if(duplicateIds.has(draw.id))issues.push('duplicate-draw-id');
   if(draw.measuredIntervalId!==null&&!uint(draw.measuredIntervalId))issues.push('invalid-measured-interval');
   if(draw.measuredIntervalId!==null&&duplicateMeasured.has(draw.measuredIntervalId))issues.push('duplicate-measured-interval');
   if(!uint(draw.before.frame)||!uint(draw.after.frame))issues.push('invalid-frame');
   else if(draw.before.frame!==draw.after.frame)issues.push('frame-changed');
   const common=uint(draw.id)&&!duplicateIds.has(draw.id)&&uint(draw.before.frame)&&draw.before.frame===draw.after.frame;
   const valid={render:false,compute:false};
   for(const k of kinds){
    const start=counter(draw.before,k),end=counter(draw.after,k);
    valid[k]=common&&uint(start)&&uint(end)&&end>=start;
    if(!uint(start)||!uint(end)||end<start)issues.push(`${k}-counter-invalid-or-reset`);
   }
   return {draw,issues,valid};
  });
  const index=new Map<string,number[]>();
  entries.forEach((e,i)=>{for(const k of kinds)if(e.valid[k]){
   const key=`${k}:${e.draw.before.frame}`,list=index.get(key)??[];list.push(i);index.set(key,list);
  }});
  const slots=entries.map(()=>({render:new Map<number,TimestampPass[]>(),compute:new Map<number,TimestampPass[]>()}));
  const diagnostics:TimestampBatchMeasurementReport['diagnostics']={batchCount:this.batches.length,freshBatchCount:0,
   staleBatchCount:0,staleObservedPassRows:0,batchStatusCounts:{},freshPassRows:0,invalidPassRows:0,
   unmatchedPassRows:0,ambiguousPassRows:0,duplicateUidRows:0,duplicateCallSlots:0,outsideWindowPassRows:0,
   duplicateLedgerIds,duplicateMeasuredIntervalIds:duplicateIntervals};
  const unmatched:TimestampBatchMeasurementReport['unmatchedPasses']=[],uidCounts=new Map<string,number>();
  for(const batch of this.batches){
   diagnostics.batchStatusCounts[batch.status]=(diagnostics.batchStatusCounts[batch.status]??0)+1;
   if(!batch.fresh||batch.status!=='fresh'){
    diagnostics.staleBatchCount++;diagnostics.staleObservedPassRows+=batch.observedAfter.length;continue;
   }
   diagnostics.freshBatchCount++;diagnostics.freshPassRows+=batch.passes.length;
   for(const pass of batch.passes){
    if(!validPass(pass,batch.kind)){
     diagnostics.invalidPassRows++;unmatched.push({pass:copyPass(pass),reason:'invalid-pass',candidateDrawIds:[]});continue;
    }
    const uidKey=`${pass.kind}:${pass.uid}`,count=(uidCounts.get(uidKey)??0)+1;uidCounts.set(uidKey,count);
    if(count>1)diagnostics.duplicateUidRows++;
    const matches=(index.get(`${pass.kind}:${pass.threeFrame}`)??[]).filter(i=>{
     const d=entries[i].draw;return pass.frameCall>counter(d.before,pass.kind)&&pass.frameCall<=counter(d.after,pass.kind);
    });
    if(matches.length!==1){
     if(matches.length===0)diagnostics.unmatchedPassRows++;else diagnostics.ambiguousPassRows++;
     unmatched.push({pass:copyPass(pass),reason:matches.length?'ambiguous-ledger-range':'no-ledger-range',candidateDrawIds:matches.map(i=>entries[i].draw.id)});continue;
    }
    const i=matches[0],slot=slots[i][pass.kind],rows=slot.get(pass.frameCall)??[];rows.push(pass);slot.set(pass.frameCall,rows);
    if(entries[i].draw.measuredIntervalId===null)diagnostics.outsideWindowPassRows++;
   }
  }
  const coverage:Record<TimestampPoolKind,KindCoverage>={render:emptyKind(),compute:emptyKind()};
  const completeSamples:Record<TimestampPoolKind,TimestampMeasuredSample[]>={render:[],compute:[]};
  const draws:TimestampBatchMeasurementReport['draws']=entries.map((entry,i)=>{
   const d=entry.draw;
   const drawCoverage=(kind:TimestampPoolKind):TimestampDrawCoverage=>{
    if(!entry.valid[kind])return {status:'invalid-ledger',expectedCalls:null,matchedFreshCalls:0,missingCallRanges:[],duplicateCallNumbers:[],uids:[],passSumMs:null};
    const start=counter(d.before,kind),end=counter(d.after,kind),expected=end-start;
    const duplicateCallNumbers:number[]=[],matched:TimestampPass[]=[];
    for(const [call,rows] of slots[i][kind]){
     if(rows.length!==1||uidCounts.get(`${kind}:${rows[0].uid}`)!==1)duplicateCallNumbers.push(call);
     else matched.push(rows[0]);
    }
    duplicateCallNumbers.sort((a,b)=>a-b);diagnostics.duplicateCallSlots+=duplicateCallNumbers.length;
    matched.sort((a,b)=>a.frameCall-b.frameCall);
    const missing:[number,number][]=[],uids=matched.map(p=>p.uid);let cursor=start+1;
    for(const pass of matched){if(pass.frameCall>cursor)missing.push([cursor,pass.frameCall-1]);cursor=pass.frameCall+1;}
    if(cursor<=end)missing.push([cursor,end]);
    const status:TimestampDrawCoverage['status']=expected===0?'not-requested':duplicateCallNumbers.length?'conflict':matched.length===expected?'complete':matched.length?'partial':'missing';
    return {status,expectedCalls:expected,matchedFreshCalls:matched.length,missingCallRanges:missing,
     duplicateCallNumbers,uids,passSumMs:status==='complete'?matched.reduce((sum,p)=>sum+p.durationMs,0):null};
   };
   const result={ledgerIndex:i,id:d.id,measuredIntervalId:d.measuredIntervalId,issues:[...entry.issues],
    before:{...d.before},after:{...d.after},render:drawCoverage('render'),compute:drawCoverage('compute')};
   for(const kind of kinds){
    if(d.measuredIntervalId===null||!uint(d.measuredIntervalId))continue;
    const c=coverage[kind],v=result[kind];c.measuredDraws++;c.expectedCalls+=v.expectedCalls??0;c.matchedFreshCalls+=v.matchedFreshCalls;
    const invalidScope=entry.issues.includes('invalid-measured-interval')||entry.issues.includes('duplicate-measured-interval');
    if(invalidScope||v.status==='invalid-ledger'){c.invalidLedgerDraws++;continue;}
    if(v.status==='complete'){
     c.completeDraws++;completeSamples[kind].push({drawId:d.id,intervalId:d.measuredIntervalId,passCount:v.matchedFreshCalls,passSumMs:v.passSumMs!});
    }else if(v.status==='partial')c.partialDraws++;else if(v.status==='missing')c.missingDraws++;
    else if(v.status==='not-requested')c.notRequestedDraws++;else if(v.status==='conflict')c.conflictDraws++;
   }
   return result;
  });
  const statistics:TimestampBatchMeasurementReport['statistics']={render:null,compute:null};
  for(const kind of kinds){
   const values=completeSamples[kind].map(s=>s.passSumMs).sort((a,b)=>a-b);
   if(values.length)statistics[kind]={sampleCount:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,
    p95Ms:values[Math.floor(values.length*.95)],maxMs:values[values.length-1]};
  }
  return {status:this.closed?'closed':'open',method:'Fresh query-pair pass sums aligned only by an explicit unchanged-frame/call-range ledger. Complete measured draws only; not elapsed frame time, isolated GPU throughput or presentation. Legacy scalar metrics remain separate.',
   draws,rawBatches:this.batches.map(copyBatch),diagnostics,unmatchedPasses:unmatched,coverage,completeSamples,statistics};
 }
}
