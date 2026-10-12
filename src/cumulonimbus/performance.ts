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
  readonly computeSamplesMs: number[] = [];
  readonly queueSamplesMs: number[] = [];
  readonly dispatchSamplesMs: number[] = [];
  readonly cpuComputeSamplesMs: number[] = [];
  readonly cpuRenderSamplesMs: number[] = [];
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
  private sample(values:number[],ms:number,startedAt=Infinity) { if(this.previous!==null && !this.result && !this.cancelReason && startedAt>=this.start+this.warmup && Number.isFinite(ms) && ms>=0) values.push(ms); }
  recordGPU(ms: number,stage:'render'|'compute'='render',startedAt=Infinity) {this.sample(stage==='render'?this.gpuSamplesMs:this.computeSamplesMs,ms,startedAt);}
  recordCPU(ms: number) {this.sample(this.cpuSamplesMs,ms);}
  recordQueue(ms:number,startedAt=Infinity) {this.sample(this.queueSamplesMs,ms,startedAt);}
  recordDispatch(ms:number) {this.sample(this.dispatchSamplesMs,ms);}
  recordStages(compute:number,render:number) {this.sample(this.cpuComputeSamplesMs,compute);this.sample(this.cpuRenderSamplesMs,render);}
  cancel(reason: string) { if (!this.result) this.cancelReason = reason; }
}
export function summarizeSamples(values:readonly number[]) {
  if(!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return {sampleCount:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)};
}
