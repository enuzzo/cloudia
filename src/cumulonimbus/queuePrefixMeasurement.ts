/** Benchmark-only queue observations. No GPU resources or presentation claims. */
export interface QueueFenceSource {onSubmittedWorkDone():Promise<void>}
interface PrefixSample {
  kind:'start'|'periodic'|'end';prefixId:number;requestedAtMs:number;
  status:'pending'|'completed'|'failed';resolvedAtMs:number|null;latencyMs:number|null;error:string|null;
}
export interface QueuePrefixReport {
  status:'completed'|'incomplete'|'timeout'|'cancelled'|'not-started';reason:string|null;
  windowStartedAtMs:number|null;firstRafTimestamp:number|null;measuredSubmissions:number;confirmedPrefixId:number;
  unconfirmedMeasuredFrames:number;maxUnconfirmedMeasuredFrames:number;
  endDrainMs:number|null;completionBoundedSubmissionFps:number|null;
  periodicEveryMs:number;finishTimeoutMs:number;samples:PrefixSample[];method:string;
}
export class QueuePrefixMeasurement {
  private startedAt:number|null=null;private firstRaf:number|null=null;
  private submitted=0;private confirmed=0;private maxUnconfirmed=0;
  private lastPeriodic=0;private periodicPending=false;private closed=false;private finishing=false;
  private samples:PrefixSample[]=[];private start:Promise<void>|null=null;
  private done:Promise<QueuePrefixReport>|null=null;private abortFinish:(()=>void)|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;private cancelReason:string|null=null;
  constructor(private readonly queue:QueueFenceSource,private readonly now:()=>number=()=>performance.now(),
    private readonly periodicEveryMs=1000,private readonly finishTimeoutMs=5000){}
  /** Call after each accepted measured draw. The first is the interval anchor,
   * matching FrameMeasurement: prefix0 includes all work through that anchor. */
  recordSubmission(rafTimestamp:number){
    if(this.closed||this.finishing)return;
    if(this.startedAt===null){
      this.startedAt=this.now();this.firstRaf=rafTimestamp;this.lastPeriodic=rafTimestamp;this.start=this.request('start').done;return;
    }
    this.submitted++;this.maxUnconfirmed=Math.max(this.maxUnconfirmed,this.submitted-this.confirmed);
    if(!this.periodicPending&&rafTimestamp-this.lastPeriodic>=this.periodicEveryMs){
      this.lastPeriodic=rafTimestamp;this.periodicPending=true;
      void this.request('periodic').done.then(()=>{this.periodicPending=false;});
    }
  }
  private request(kind:PrefixSample['kind']){
    // Capture the prefix now. Later RAF draws must not inflate the completion ID.
    const sample:PrefixSample={kind,prefixId:this.submitted,requestedAtMs:this.now(),status:'pending',resolvedAtMs:null,latencyMs:null,error:null};
    this.samples.push(sample);
    let fence:Promise<void>;
    try{fence=this.queue.onSubmittedWorkDone();}catch(error){fence=Promise.reject(error);}
    const done=Promise.resolve(fence).then(()=>{
      if(this.closed)return;
      sample.resolvedAtMs=this.now();sample.latencyMs=sample.resolvedAtMs-sample.requestedAtMs;sample.status='completed';
      this.confirmed=Math.max(this.confirmed,sample.prefixId);
    },error=>{
      if(this.closed)return;
      sample.resolvedAtMs=this.now();sample.latencyMs=sample.resolvedAtMs-sample.requestedAtMs;sample.status='failed';
      sample.error=error instanceof Error?error.message:String(error);
    });
    return {sample,done};
  }
  finish():Promise<QueuePrefixReport>{
    if(this.done)return this.done;
    if(this.closed)return Promise.resolve(this.snapshot('cancelled',null));
    if(this.startedAt===null)return Promise.resolve(this.snapshot('not-started',null));
    this.finishing=true;
    // End is mandatory even if the initial or periodic observation is pending.
    const end=this.request('end');
    this.done=new Promise(resolve=>{
      const close=(status:QueuePrefixReport['status'])=>{
        if(this.closed)return;
        this.closed=true;if(this.timer!==null)clearTimeout(this.timer);this.timer=null;this.abortFinish=null;
        resolve(this.snapshot(status,end.sample));
      };
      this.abortFinish=()=>close('cancelled');
      this.timer=setTimeout(()=>close('timeout'),this.finishTimeoutMs);
      void Promise.all([this.start,end.done]).then(()=>close(
        this.samples[0].status==='completed'&&end.sample.status==='completed'?'completed':'incomplete'));
    });
    return this.done;
  }
  cancel(reason:string){
    if(this.closed)return;
    this.cancelReason=reason;
    if(this.abortFinish)this.abortFinish();else this.closed=true;
  }
  private snapshot(status:QueuePrefixReport['status'],end:PrefixSample|null):QueuePrefixReport{
    const endDrain=end?.status==='completed'?end.latencyMs:null;
    const elapsed=end?.resolvedAtMs!==null&&end?.resolvedAtMs!==undefined&&this.startedAt!==null?end.resolvedAtMs-this.startedAt:0;
    return {status,reason:this.cancelReason,windowStartedAtMs:this.startedAt,firstRafTimestamp:this.firstRaf,measuredSubmissions:this.submitted,confirmedPrefixId:this.confirmed,
      unconfirmedMeasuredFrames:Math.max(0,this.submitted-this.confirmed),maxUnconfirmedMeasuredFrames:this.maxUnconfirmed,
      endDrainMs:endDrain,completionBoundedSubmissionFps:status==='completed'&&elapsed>0?this.submitted*1000/elapsed:null,
      periodicEveryMs:this.periodicEveryMs,finishTimeoutMs:this.finishTimeoutMs,samples:this.samples.map(sample=>({...sample})),
      method:'Logical measured draws, excluding the initial interval anchor. Fence IDs are immutable submitted prefixes. Unconfirmed frames are an upper bound on measured draws not yet confirmed to JS, not physical queue depth. Completion-bounded rate uses one local performance.now clock from the anchor observation through final prefix notification; RAF is stored separately and used only for periodic spacing. Includes inherited backlog and JS delivery, not isolated GPU throughput or compositor presentation.'};
  }
}
