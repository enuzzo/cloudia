import { describe, expect, it } from 'vitest';
import { summarizeFrames, FrameMeasurement } from './performance';

describe('real frame measurements', () => {
  it('rejects async probes initiated during warmup even if they complete during measurement',()=>{
    const run=new FrameMeasurement(0,100,20);
    run.record(20);
    run.recordGPU(99,'compute',10);run.recordQueue(99,10);
    run.recordGPU(.06,'compute',21);run.recordQueue(8,21);
    expect(run.computeSamplesMs).toEqual([.06]);expect(run.queueSamplesMs).toEqual([8]);
  });
  it('keeps compute, queue completion and callback delay separate and ignores invalid or stale samples',()=>{
    const run=new FrameMeasurement(0,100,20);
    run.recordGPU(9,'compute');run.recordQueue(9);run.recordDispatch(9);
    run.record(20);
    run.recordGPU(.12,'compute');run.recordGPU(5);
    run.recordQueue(8);run.recordDispatch(1.5);run.recordStages(.3,.4);
    run.recordGPU(NaN,'compute');run.recordQueue(-1);run.recordDispatch(Infinity);
    run.record(120);
    run.recordGPU(99,'compute');run.recordQueue(99);run.recordStages(99,99);
    expect(run.computeSamplesMs).toEqual([.12]);expect(run.gpuSamplesMs).toEqual([5]);
    expect(run.queueSamplesMs).toEqual([8]);expect(run.dispatchSamplesMs).toEqual([1.5]);
    expect(run.cpuComputeSamplesMs).toEqual([.3]);expect(run.cpuRenderSamplesMs).toEqual([.4]);
  });
  it('uses elapsed time and exposes stalls instead of averaging FPS reciprocals', () => {
    const stats = summarizeFrames([...Array<number>(99).fill(10), 110]);
    expect(stats.fps).toBeCloseTo(100000 / 1100);
    expect(stats.p99Ms).toBe(110);
    expect(stats.over33Ms).toBe(1);
  });
  it('excludes warmup and measures only complete intervals inside the sampling window', () => {
    const run = new FrameMeasurement(0, 1000, 200);
    for (let t = 0; t <= 1200; t += 10) run.record(t);
    expect(run.result?.frames).toBe(100);
    expect(run.result?.durationMs).toBe(1000);
    expect(run.result?.fps).toBe(100);
  });
  it('invalidates interrupted visible runs rather than publishing an inflated result', () => {
    const run = new FrameMeasurement(0, 1000, 0);
    run.record(10); run.cancel('Scheda nascosta'); run.record(1100);
    expect(run.result).toBeNull();
    expect(run.cancelReason).toBe('Scheda nascosta');
  });
  it('separates CPU submission samples and excludes warmup and cancelled work', () => {
    const run = new FrameMeasurement(0, 1000, 200);
    run.recordCPU(80);
    run.record(200); run.recordCPU(2); run.record(210);
    run.cancel('Resize'); run.recordCPU(99);
    expect(run.cpuSamplesMs).toEqual([2]);
  });
});
