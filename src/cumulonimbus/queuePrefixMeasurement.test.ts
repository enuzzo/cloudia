import {afterEach,describe,expect,it,vi} from 'vitest';
import {QueuePrefixMeasurement} from './queuePrefixMeasurement';
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function harness(period=1000,timeout=5000){
  let clock=0;
  const fences:Array<{resolve:()=>void;reject:(error:Error)=>void}>=[];
  const queue={onSubmittedWorkDone:vi.fn(()=>new Promise<void>((resolve,reject)=>fences.push({resolve,reject})))};
  return {probe:new QueuePrefixMeasurement(queue,()=>clock,period,timeout),queue,fences,time:(value:number)=>{clock=value;}};
}
afterEach(()=>vi.useRealTimers());
describe('benchmark queue prefixes, not presentation',()=>{
  it('uses one local clock for completion even when RAF has a different origin',async()=>{
    const h=harness();h.time(100);h.probe.recordSubmission(50000);
    h.fences[0].resolve();await flush();
    h.time(110);h.probe.recordSubmission(50010);
    const done=h.probe.finish();h.time(120);h.fences[1].resolve();
    const report=await done;
    expect(report.firstRafTimestamp).toBe(50000);expect(report.windowStartedAtMs).toBe(100);
    expect(report.completionBoundedSubmissionFps).toBe(50);
  });
  it('does no queue work until measured draws and excludes the first interval anchor',async()=>{
    const h=harness();expect(h.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
    h.time(100);h.probe.recordSubmission(100);h.fences[0].resolve();await flush();
    h.time(110);h.probe.recordSubmission(110);h.time(120);h.probe.recordSubmission(120);
    const done=h.probe.finish();h.time(140);h.fences[1].resolve();const report=await done;
    expect(report.measuredSubmissions).toBe(2);expect(report.confirmedPrefixId).toBe(2);
    expect(report.samples.map(sample=>sample.prefixId)).toEqual([0,2]);
    expect(report.completionBoundedSubmissionFps).toBe(50);expect(report.endDrainMs).toBe(20);
  });
  it('captures immutable prefixes, coalesces pending periodic work, and always issues end',async()=>{
    const h=harness();h.probe.recordSubmission(0);
    h.time(1000);h.probe.recordSubmission(1000);h.probe.recordSubmission(2000);
    expect(h.queue.onSubmittedWorkDone).toHaveBeenCalledTimes(2);
    const done=h.probe.finish();expect(h.queue.onSubmittedWorkDone).toHaveBeenCalledTimes(3);
    h.probe.recordSubmission(3000);h.time(3100);h.fences.forEach(fence=>fence.resolve());
    const report=await done;
    expect(report.measuredSubmissions).toBe(2);expect(report.samples.map(sample=>sample.prefixId)).toEqual([0,1,2]);
    expect(report.unconfirmedMeasuredFrames).toBe(0);
  });
  it('reports a timeout without fabricating completion and ignores late callback mutation',async()=>{
    vi.useFakeTimers();const h=harness(1000,10);h.probe.recordSubmission(0);h.probe.recordSubmission(1);
    const done=h.probe.finish();await vi.advanceTimersByTimeAsync(10);const report=await done;
    const before=JSON.stringify(report);h.fences.forEach(fence=>fence.resolve());await flush();
    expect(report.status).toBe('timeout');expect(report.completionBoundedSubmissionFps).toBeNull();
    expect(report.unconfirmedMeasuredFrames).toBe(1);expect(JSON.stringify(report)).toBe(before);
  });
  it('handles rejected and synchronously thrown fences as incomplete data',async()=>{
    const h=harness();h.probe.recordSubmission(0);h.probe.recordSubmission(1);
    const done=h.probe.finish();h.fences[0].reject(new Error('device lost'));h.fences[1].reject(new Error('device lost'));
    const report=await done;expect(report.status).toBe('incomplete');expect(report.completionBoundedSubmissionFps).toBeNull();
    expect(report.samples.every(sample=>sample.status==='failed')).toBe(true);
    const broken=new QueuePrefixMeasurement({onSubmittedWorkDone(){throw new Error('sync failure');}});
    broken.recordSubmission(0);const failed=await broken.finish();expect(failed.status).toBe('incomplete');
  });
  it('cancel during final wait resolves promptly, clears the timer and cannot publish later data',async()=>{
    vi.useFakeTimers();const h=harness();h.probe.recordSubmission(0);h.probe.recordSubmission(1);
    const done=h.probe.finish();h.probe.cancel('hidden');const report=await done;
    expect(report.status).toBe('cancelled');expect(report.reason).toBe('hidden');expect(vi.getTimerCount()).toBe(0);
    const before=JSON.stringify(report);h.fences.forEach(fence=>fence.reject(new Error('late loss')));await flush();
    expect(JSON.stringify(report)).toBe(before);
  });
});
