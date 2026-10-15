import {describe,it,expect,vi} from 'vitest';
import {TimestampBatchMeasurement,type TimestampDrawLedger} from './timestampBatchMeasurement';
import {resolveThree186TimestampBatch,type TimestampBatchReport,type TimestampPass,type TimestampPoolKind} from './three186TimestampBatch';
const pass=(call:number,ms:number,frame=10,kind:TimestampPoolKind='render',context='17'):TimestampPass=>({
 uid:`${kind==='render'?'r':'c'}:${call}:${context}:f${frame}`,kind,frameCall:call,threeFrame:frame,contextId:context,durationMs:ms,queryIndices:[0,1]});
function batch(rows:TimestampPass[],status:TimestampBatchReport['status']='fresh'):TimestampBatchReport{
 const passes=rows.map((p,i)=>({...p,queryIndices:[i*2,i*2+1] as [number,number]})),frames=[...new Set(passes.map(p=>p.threeFrame))];
 const groups=frames.map(threeFrame=>{const items=passes.filter(p=>p.threeFrame===threeFrame);return {threeFrame,passCount:items.length,passSumMs:items.reduce((sum,p)=>sum+p.durationMs,0),uids:items.map(p=>p.uid)};});
 const snapshot={available:true,reason:null,currentQueryIndex:rows.length*2,pendingResolve:false,lastValue:0,frames:[],offsets:passes.map((p,i)=>({uid:p.uid,baseOffset:i*2})),timestamps:[]};
 return {adapter:'three-r186-timestamp-batch-v1',revision:'186',kind:passes[0]?.kind??'render',status,reason:null,fresh:status==='fresh',
  requestAppDrawId:999,appDrawMapping:'not-verified',requestedAtMs:100,resolvedAtMs:110,returnedScalarMs:groups.at(-1)?.passSumMs??0,
  before:{...snapshot},after:{...snapshot,currentQueryIndex:0,offsets:[],frames,timestamps:passes.map(p=>({uid:p.uid,durationMs:p.durationMs})),lastValue:groups.at(-1)?.passSumMs??0},
  passes:status==='fresh'?passes:[],groups,observedAfter:passes,selectedThreeFrame:frames.at(-1)??null,selectedPassSumMs:groups.at(-1)?.passSumMs??null};
}
const draw=(id:number,interval:number|null,start:number,end:number,frame=10,computeStart=0,computeEnd=0):TimestampDrawLedger=>({
 id,measuredIntervalId:interval,before:{frame,renderFrameCalls:start,computeFrameCalls:computeStart},after:{frame,renderFrameCalls:end,computeFrameCalls:computeEnd}});

describe('fresh timestamp sums with an explicit app draw ledger',()=>{
 it('separates multiple app draws sharing a Three frame and never assumes two passes',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,101,0,2,10,0,1));m.recordDraw(draw(2,102,2,5,10,1,3));
  m.recordBatch(batch([pass(1,1),pass(2,2),pass(3,3),pass(4,4),pass(5,5)]));
  m.recordBatch(batch([pass(1,.1,10,'compute'),pass(2,.2,10,'compute'),pass(3,.3,10,'compute')]));
  const r=m.finish();expect(r.completeSamples.render.map(s=>[s.drawId,s.passCount,s.passSumMs])).toEqual([[1,2,3],[2,3,12]]);
  expect(r.completeSamples.compute.map(s=>s.passCount)).toEqual([1,2]);expect(r.statistics.render?.meanMs).toBe(7.5);
  expect(r.draws[0].compute.passSumMs).toBe(.1);expect(r.rawBatches[0].requestAppDrawId).toBe(999);
 });
 it('maps warmup and outside-window draws but excludes them from measured statistics',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,null,0,1));m.recordDraw(draw(2,1,1,2));m.recordDraw(draw(3,null,2,3));
  m.recordBatch(batch([pass(1,100),pass(2,4),pass(3,200)]));const r=m.finish();
  expect(r.draws.map(d=>d.render.passSumMs)).toEqual([100,4,200]);expect(r.completeSamples.render).toEqual([{drawId:2,intervalId:1,passCount:1,passSumMs:4}]);
  expect(r.statistics.render?.meanMs).toBe(4);expect(r.diagnostics.outsideWindowPassRows).toBe(2);
 });
 it('keeps partial sums null and completes only after every expected call arrives fresh',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,3));m.recordBatch(batch([pass(1,1),pass(3,3)]));
  const partial=m.snapshot();expect(partial.draws[0].render.status).toBe('partial');expect(partial.draws[0].render.missingCallRanges).toEqual([[2,2]]);
  expect(partial.draws[0].render.passSumMs).toBeNull();expect(partial.statistics.render).toBeNull();
  m.recordBatch(batch([pass(2,2)]));const complete=m.finish();expect(complete.draws[0].render.passSumMs).toBe(6);expect(complete.coverage.render.completeDraws).toBe(1);
 });
 it('rejects changed frames and ambiguous overlapping call ranges instead of guessing',()=>{
  const m=new TimestampBatchMeasurement(),changed=draw(1,1,0,1);changed.after.frame=11;m.recordDraw(changed);
  m.recordDraw(draw(2,2,0,2,12));m.recordDraw(draw(3,3,1,3,12));
  m.recordBatch(batch([pass(1,8),pass(2,9,12)]));const r=m.finish();
  expect(r.draws[0].issues).toContain('frame-changed');expect(r.draws[0].render.status).toBe('invalid-ledger');
  expect(r.diagnostics.unmatchedPassRows).toBe(1);expect(r.diagnostics.ambiguousPassRows).toBe(1);expect(r.statistics.render).toBeNull();
  expect(r.unmatchedPasses[1].candidateDrawIds).toEqual([2,3]);
 });
 it('excludes repeated UIDs and different UIDs for one expected call',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,1));m.recordBatch(batch([pass(1,4)]));m.recordBatch(batch([pass(1,4)]));
  const repeated=m.finish();expect(repeated.diagnostics.duplicateUidRows).toBe(1);expect(repeated.draws[0].render.status).toBe('conflict');expect(repeated.statistics.render).toBeNull();
  const n=new TimestampBatchMeasurement();n.recordDraw(draw(1,1,0,1));n.recordBatch(batch([pass(1,4),pass(1,5,10,'render','18')]));
  const overlap=n.finish();expect(overlap.diagnostics.duplicateUidRows).toBe(0);expect(overlap.diagnostics.duplicateCallSlots).toBe(1);expect(overlap.draws[0].render.duplicateCallNumbers).toEqual([1]);
 });
 it('marks duplicate ledger and measured interval IDs explicitly',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,1));m.recordDraw(draw(1,2,1,2));m.recordBatch(batch([pass(1,4),pass(2,5)]));
  expect(m.snapshot().diagnostics.duplicateLedgerIds).toEqual([1]);expect(m.snapshot().coverage.render.invalidLedgerDraws).toBe(2);
  const n=new TimestampBatchMeasurement();n.recordDraw(draw(1,7,0,1));n.recordDraw(draw(2,7,1,2));n.recordBatch(batch([pass(1,4),pass(2,5)]));
  const r=n.finish();expect(r.diagnostics.duplicateMeasuredIntervalIds).toEqual([7]);expect(r.statistics.render).toBeNull();expect(r.draws[0].render.passSumMs).toBe(4);
 });
 it('does not promote stale observations or malformed pass metadata',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,1));m.recordBatch(batch([pass(1,99)],'cached'));
  const forged=pass(1,50);forged.frameCall=2;m.recordBatch(batch([forged]));m.recordBatch(batch([pass(1,3)]));
  const r=m.finish();expect(r.statistics.render?.meanMs).toBe(3);expect(r.diagnostics.staleBatchCount).toBe(1);expect(r.diagnostics.staleObservedPassRows).toBe(1);expect(r.diagnostics.invalidPassRows).toBe(1);
 });
 it('accepts equal-valued new UIDs and distinguishes no requested work from a real zero query',()=>{
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,1));m.recordDraw(draw(2,2,0,1,11));
  m.recordBatch(batch([pass(1,0)]));m.recordBatch(batch([pass(1,0,11)]));const r=m.finish();
  expect(r.statistics.render?.sampleCount).toBe(2);expect(r.statistics.render?.meanMs).toBe(0);
  expect(r.draws[0].compute.status).toBe('not-requested');expect(r.draws[0].compute.passSumMs).toBeNull();expect(r.statistics.compute).toBeNull();
 });
 it('keeps published snapshots detached and rejects async data after close',async()=>{
  const m=new TimestampBatchMeasurement(),ledger=draw(1,1,0,2),first=batch([pass(1,1)]);m.recordDraw(ledger);m.recordBatch(first);
  ledger.after.renderFrameCalls=99;first.passes[0].durationMs=999;
  let release:(b:TimestampBatchReport)=>void=()=>{};const pending=new Promise<TimestampBatchReport>(done=>{release=done;});
  const late=pending.then(b=>m.recordBatch(b)),snapshot=vi.spyOn(m,'snapshot');
  m.close();expect(snapshot).not.toHaveBeenCalled();expect(m.recordDraw(draw(2,2,2,3))).toBe(false);
  const final=m.finish(),before=JSON.stringify(final);expect(snapshot).toHaveBeenCalledTimes(1);
  release(batch([pass(2,2)]));expect(await late).toBe(false);expect(m.recordDraw(draw(2,2,2,3))).toBe(false);
  expect(JSON.stringify(final)).toBe(before);expect(m.snapshot().draws[0].render.expectedCalls).toBe(2);
  final.rawBatches[0].passes[0].durationMs=123;expect(m.snapshot().rawBatches[0].passes[0].durationMs).toBe(1);
 });
 it('consumes an actual adapter result and leaves the legacy scalar distinct',async()=>{
  const source=batch([pass(1,1),pass(2,2),pass(3,3)]),pool={currentQueryIndex:6,pendingResolve:false,lastValue:100,frames:[] as number[],
   queryOffsets:new Map(source.before.offsets.map(o=>[o.uid,o.baseOffset])),timestamps:new Map<string,number>()};
  const renderer={backend:{timestampQueryPool:{render:pool}},async resolveTimestampsAsync(){
   pool.currentQueryIndex=0;pool.queryOffsets.clear();pool.timestamps=new Map(source.after.timestamps.map(p=>[p.uid,p.durationMs]));pool.frames=[10];pool.lastValue=6;return 6;
  }};
  const result=await resolveThree186TimestampBatch(renderer,'render',{revision:186});expect(result.fresh).toBe(true);
  const m=new TimestampBatchMeasurement();m.recordDraw(draw(1,1,0,1));m.recordDraw(draw(2,2,1,3));m.recordBatch(result);const r=m.finish();
  expect(r.rawBatches[0].returnedScalarMs).toBe(6);expect(r.completeSamples.render.map(s=>s.passSumMs)).toEqual([1,5]);expect(r.statistics.render?.meanMs).toBe(3);
 });
});
