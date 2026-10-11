import { describe, expect, it } from 'vitest';
import { summarizeFrames, FrameMeasurement } from './performance';

describe('real frame measurements', () => {
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
