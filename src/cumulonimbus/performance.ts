export interface FrameStats {
  frames: number; durationMs: number; fps: number;
  medianMs: number; p95Ms: number; p99Ms: number; maxMs: number;
  over18Ms: number; over33Ms: number;
}
export function summarizeFrames(values: readonly number[]): FrameStats {
  const sorted = [...values].sort((a,b) => a-b);
  const durationMs = values.reduce((a,b) => a+b, 0);
  const percentile = (p: number) => sorted[Math.min(sorted.length-1, Math.floor(sorted.length*p))] ?? 0;
  return { frames: values.length, durationMs, fps: durationMs ? values.length*1000/durationMs : 0,
    medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: sorted.at(-1) ?? 0,
    over18Ms: values.filter(v => v > 18).length, over33Ms: values.filter(v => v > 33.34).length };
}
export class FrameMeasurement {
  readonly intervals: number[] = [];
  readonly gpuSamplesMs: number[] = [];
  readonly cpuSamplesMs: number[] = [];
  result: FrameStats | null = null;
  cancelReason = '';
  private previous: number | null = null;
  private first: number | null = null;
  constructor(readonly start: number, readonly duration = 30000, readonly warmup = 2000) {}
  record(now: number) {
    if (this.result || this.cancelReason || now < this.start + this.warmup) return;
    if (this.previous !== null) this.intervals.push(now - this.previous);
    this.first ??= now;
    this.previous = now;
    if (now - this.first >= this.duration) this.result = summarizeFrames(this.intervals);
  }
  recordGPU(ms: number) { if (this.previous !== null && !this.result && !this.cancelReason && Number.isFinite(ms)) this.gpuSamplesMs.push(ms); }
  recordCPU(ms: number) { if (this.previous !== null && !this.result && !this.cancelReason && Number.isFinite(ms)) this.cpuSamplesMs.push(ms); }
  cancel(reason: string) { if (!this.result) this.cancelReason = reason; }
}
