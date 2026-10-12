import { Data3DTexture, LinearFilter, MeshBasicNodeMaterial, NoColorSpace, QuadMesh,
  RGBAFormat, RepeatWrapping, UnsignedByteType, HalfFloatType, Storage3DTexture, Vector2, Vector3, WebGPURenderer } from 'three/webgpu';
import { Fn, instanceIndex, vec3, mix, storageTexture3D, textureStore, texture3D, texture3DLoad, uniform, uv } from 'three/tsl';
import { integrateCloud } from './cloudShader';
import { motionState,MOTION_LOOP_SECONDS } from './motion';
import { fillMotionAtlas,MOTION_FIELD_SIZE,MOTION_PHASES } from './motionField';
import { EXTINCTION, ICE_EXTINCTION, DETAIL_RESOLUTION, EMPTY_SKIP_LIMIT, SUN_LEFT, SUN_RIGHT, VOLUME_RESOLUTION, cloudParameters, iceHeights, type CloudVolume } from './volume';
import { FrameMeasurement, summarizeFrames, summarizeSamples } from './performance';
import type {RenderHost,Viewport,RenderEvent} from './renderProtocol';

export const QUALITY = {
  native: {label:'Alta · 100% / 128 passi', scale:1, steps:128},
  ultra: {label:'Massima · 100% / 384 passi', scale:1, steps:384},
  balanced: {label:'Fluida · 75% / 96 passi', scale:.75, steps:96},
} as const;
export type Quality = keyof typeof QUALITY;
type CloudTextures = {macro:Data3DTexture;detail:Data3DTexture;supportBounds:CloudVolume['supportBounds']};

export class GPUSceneEngine {
  private renderer: WebGPURenderer | null = null;
  private device: GPUDevice | null = null;
  private quad: QuadMesh | null = null;
  private material: MeshBasicNodeMaterial | null = null;
  private volume: Data3DTexture | null = null;
  private detailVolume: Data3DTexture | null = null;
  private worker: Worker | null = null;
  private raf = 0;
  private destroyed = false;
  private deviceLost = false;
  private releasingGPU = false;
  private initialization: Promise<void> | null = null;
  private cleanup: Promise<void> | null = null;
  private rejectVolume: ((reason: Error)=>void) | null = null;
  private ready = false;
  private seed = 71;
  private paused = false;
  private orbit = false;
  private simulationTime = 0;
  private previous = 0;
  private uiTime = 0;
  private timestampPending = false;
  private timestampTime = 0;
  private timestampPromise: Promise<void> | null = null;
  private timestampSupported = false;
  private gpuMs: number | null = null;
  private computeMs:number|null=null;
  private queueMs:number|null=null;
  private queuePromise:Promise<void>|null=null;
  private queuePending=false;
  private queueTime=0;
  private readonly profiling:boolean;
  private readonly timingMode:string;
  private readonly frozenFlow:boolean;
  private frameLimit:number;
  private viewport:Viewport;
  private visible:boolean;
  private clockSample:Record<string,number>|null=null;
  private framesInFlight=0;
  private skippedFrames=0;
  private readonly frameCompletions=new Set<Promise<void>>();
  private intervals: number[] = [];
  private measurement: FrameMeasurement | null = null;
  private benchmarkContext: Record<string, unknown> = {};
  private report: Record<string, unknown> | null = null;
  private quality: Quality = 'ultra';
  private outputMode = 'window';
  private outputWidth = 0;
  private outputHeight = 0;
  private internalWidth = 0;
  private internalHeight = 0;
  private dirtySize = true;
  private side = 0;
  private adapterInfo: Record<string, unknown> = {};
  private readonly origin = uniform(new Vector3(0,3.5,16));
  private readonly forward = uniform(new Vector3(0,0,-1));
  private readonly right = uniform(new Vector3(1,0,0));
  private readonly up = uniform(new Vector3(0,1,0));
  private readonly aspect = uniform(16/9);
  private readonly resolution = uniform(new Vector2(1280,720));
  private readonly stepSize = uniform(7/128);
  private readonly emptyStep = uniform(7/128);
  private readonly drift = uniform(new Vector3());
  private readonly growth = uniform(new Vector3(.68,.88,.58));
  private readonly supportMin=uniform(new Vector3(-5,-.5,-3.5));
  private readonly supportMax=uniform(new Vector3(5,8,3.5));
  private readonly flowData=new Uint16Array(MOTION_FIELD_SIZE**3*MOTION_PHASES*4);
  private readonly flowTexture=new Data3DTexture(this.flowData,MOTION_FIELD_SIZE,MOTION_FIELD_SIZE,MOTION_FIELD_SIZE*MOTION_PHASES);
  private readonly flowPhase=uniform(new Vector3());
  private readonly currentFlow=new Storage3DTexture(MOTION_FIELD_SIZE,MOTION_FIELD_SIZE,MOTION_FIELD_SIZE);
  private readonly interpolateFlow=Fn(()=>{
    const x=instanceIndex.mod(MOTION_FIELD_SIZE).toFloat(), y=instanceIndex.div(MOTION_FIELD_SIZE).mod(MOTION_FIELD_SIZE).toFloat(), z=instanceIndex.div(MOTION_FIELD_SIZE**2).toFloat();
    const a=texture3DLoad(this.flowTexture,vec3(x,y,z.add(this.flowPhase.x.mul(MOTION_FIELD_SIZE))));
    const b=texture3DLoad(this.flowTexture,vec3(x,y,z.add(this.flowPhase.y.mul(MOTION_FIELD_SIZE))));
    textureStore(storageTexture3D(this.currentFlow).toWriteOnly(),vec3(x,y,z),mix(a,b,this.flowPhase.z));
  })().compute(MOTION_FIELD_SIZE**3);
  private readonly sun = uniform(new Vector3(...SUN_LEFT).normalize());
  private readonly lightSide = uniform(0);
  private readonly iceRange = uniform(new Vector2());
  constructor(private readonly host:RenderHost) {
    const params=new URLSearchParams(host.search),requested=Number(params.get('seed'));
    if(params.has('seed')&&Number.isInteger(requested)&&requested>=0&&requested<=0xffffffff) this.seed=requested;
    this.profiling=params.get('profile')==='1';this.timingMode=params.get('timing')??'stages';this.frozenFlow=params.get('flow')==='frozen';
    this.frameLimit=[1,2].includes(Number(params.get('inflight')))?Number(params.get('inflight')):0;
    this.viewport={...host.viewport};this.visible=host.visible;
    if(this.profiling){this.outputMode='1080';this.simulationTime=60;}
  }
  private emit(event:RenderEvent){this.host.emit(event);}
  private text(field:'status'|'metrics'|'result',text:string){this.emit({type:'text',field,text});}
  private state(){this.emit({type:'state',paused:this.paused,orbit:this.orbit,side:this.side});}
  async start() {
    try {
      if (!navigator.gpu) throw new Error('Questo browser non espone WebGPU. Apri Cloudia in una versione recente di Chrome o Edge con accelerazione grafica.');
      const adapter = await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(this.destroyed) return;
      if(!adapter) throw new Error('Nessun adattatore WebGPU disponibile.');
      const info=adapter.info;
      this.adapterInfo={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter};
      const device=await adapter.requestDevice({requiredFeatures:this.timingMode!=='off'&&adapter.features.has('timestamp-query')?['timestamp-query']:[]});
      if(this.destroyed) { device.destroy(); return; }
      this.device=device;
      const renderer = new WebGPURenderer({canvas:this.host.canvas as HTMLCanvasElement,antialias:false,device,trackTimestamp:this.timingMode!=='off'});
      this.renderer = renderer;
      const originalDeviceLost=renderer.onDeviceLost.bind(renderer);
      renderer.onDeviceLost=(info)=>{
        if(this.destroyed || this.releasingGPU) return;
        originalDeviceLost(info);
        if(this.deviceLost) return;
        this.deviceLost=true; this.ready=false; cancelAnimationFrame(this.raf);
        this.worker?.terminate(); this.worker=null;
        this.rejectVolume?.(new Error('Connessione alla GPU persa')); this.rejectVolume=null;
        this.invalidate('Connessione alla GPU persa');
        this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false); this.setButtonEnabled('new-cloud',false);
        this.text('status','Connessione alla GPU persa. Ricarica la scena.');
        this.emit({type:'statusState',state:'failed'});
        void this.releaseGPU();
      };
      this.initialization=renderer.init().then(()=>{});
      await this.initialization;
      if(this.destroyed || this.deviceLost) { await this.releaseGPU(); return; }
      if(!('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend)) throw new Error('WebGPU non è disponibile sulla GPU selezionata. Il vecchio laboratorio resta accessibile con ?legacy.');
      // Timestamp queries are optional; RAF measurements remain available without them.
      this.timestampSupported = this.timingMode!=='off' && renderer.hasFeature('timestamp-query');
      const texture = await this.loadVolume();
      if(this.destroyed || this.deviceLost) { texture.macro.dispose();texture.detail.dispose(); return; }
      this.installVolume(texture);
      this.applySize();
      this.quad!.render(renderer); // Compile the shader before declaring the scene ready.
      this.ready=true;
      this.text('status',`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`);
      this.emit({type:'statusState',state:'loaded'});
      this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      this.setButtonEnabled('new-cloud',true);this.emit({type:'ready'});
      this.previous=0;
      if(!!this.visible) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      this.text('status',error instanceof Error ? error.message : String(error));
      this.emit({type:'statusState',state:'failed'});
      await this.releaseGPU();
    }
  }
  private installVolume(textures: CloudTextures) {
    const oldMaterial=this.material, oldVolume=this.volume, oldDetail=this.detailVolume;
    const volumeNode=texture3D(textures.macro), detailNode=texture3D(textures.detail);
    this.volume=textures.macro;this.detailVolume=textures.detail; this.material=new MeshBasicNodeMaterial();
    this.iceRange.value.fromArray(iceHeights(this.seed));
    this.supportMin.value.fromArray(textures.supportBounds.min);this.supportMax.value.fromArray(textures.supportBounds.max);
    this.flowTexture.format=RGBAFormat;this.flowTexture.type=HalfFloatType;this.flowTexture.colorSpace=NoColorSpace;
    this.flowTexture.minFilter=LinearFilter;this.flowTexture.magFilter=LinearFilter;this.flowTexture.generateMipmaps=false;this.flowTexture.unpackAlignment=1;
    fillMotionAtlas(this.flowData,MOTION_FIELD_SIZE,MOTION_PHASES,this.seed,this.iceRange.value.toArray());
    this.flowTexture.needsUpdate=true;
    this.updateEvolution();
    this.currentFlow.type=HalfFloatType;this.currentFlow.format=RGBAFormat;this.currentFlow.colorSpace=NoColorSpace;
    this.currentFlow.generateMipmaps=false;
    const flowNode=texture3D(this.currentFlow);
    this.material.fragmentNode=integrateCloud({uv:uv(),volume:volumeNode,volumeSampler:volumeNode,detail:detailNode,detailSampler:detailNode,flow:flowNode,flowSampler:flowNode,iceRange:this.iceRange,
      origin:this.origin,forward:this.forward,right:this.right,up:this.up,aspect:this.aspect,tanFov:uniform(.2867),
      stepSize:this.stepSize,emptyStep:this.emptyStep,resolution:this.resolution,drift:this.drift,growth:this.growth,supportMin:this.supportMin,supportMax:this.supportMax,sun:this.sun,lightSide:this.lightSide,extinction:uniform(EXTINCTION),iceExtinction:uniform(ICE_EXTINCTION)});
    this.quad=new QuadMesh(this.material);
    this.renderer?.compute(this.interpolateFlow); // Initialize this seed even for the frozen diagnostic control.
    oldMaterial?.dispose(); oldVolume?.dispose();oldDetail?.dispose();
  }
  private async newCloud() {
    if(!this.ready) return;
    this.invalidate('Nuova nube'); this.ready=false; cancelAnimationFrame(this.raf);
    this.setButtonEnabled('new-cloud',false); this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.emit({type:'statusState',state:'loading'}); this.text('status','Formazione di una nuova nube…');
    this.seed=crypto.getRandomValues(new Uint32Array(1))[0];
    try {
      const texture=await this.loadVolume();
      if(this.destroyed || this.deviceLost) {texture.macro.dispose();texture.detail.dispose();return;}
      this.simulationTime=0; this.installVolume(texture);
      this.previous=0; this.intervals=[]; this.ready=true;
      this.text('status',`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`); this.emit({type:'statusState',state:'loaded'});
      this.setButtonEnabled('new-cloud',true); this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      if(!!this.visible) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      this.text('status',error instanceof Error?error.message:String(error)); this.emit({type:'statusState',state:'failed'});
    }
  }
  private loadVolume(): Promise<CloudTextures> {
    this.worker = new Worker(new URL('./volume.worker.ts',import.meta.url),{type:'module'});
    return new Promise((resolve,reject)=>{
      const worker=this.worker!;
      this.rejectVolume=reject;
      worker.onmessage=(event: MessageEvent<{progress?:number;volume?:CloudVolume;error?:string}>)=>{
        if(this.destroyed || this.deviceLost) return;
        if(event.data.progress!==undefined) this.text('status',`Formazione della nube e della luce · ${Math.round(event.data.progress*100)}%`);
        if(event.data.error) { worker.terminate(); this.worker=null; this.rejectVolume=null; reject(new Error(event.data.error)); }
        if(event.data.volume) {
          const {size,data,detail}=event.data.volume;
          const texture = new Data3DTexture(data,size,size,size);
          texture.format=RGBAFormat; texture.type=UnsignedByteType; texture.colorSpace=NoColorSpace;
          texture.minFilter=LinearFilter; texture.magFilter=LinearFilter; texture.unpackAlignment=1;
          texture.generateMipmaps=false; texture.needsUpdate=true;
          const detailTexture=new Data3DTexture(detail.data,detail.size,detail.size,detail.size);
          detailTexture.format=RGBAFormat;detailTexture.type=UnsignedByteType;detailTexture.colorSpace=NoColorSpace;
          detailTexture.minFilter=LinearFilter;detailTexture.magFilter=LinearFilter;detailTexture.unpackAlignment=1;
          detailTexture.wrapS=RepeatWrapping;detailTexture.wrapT=RepeatWrapping;detailTexture.wrapR=RepeatWrapping;
          detailTexture.generateMipmaps=false;detailTexture.needsUpdate=true;
          worker.terminate(); this.worker=null; this.rejectVolume=null; resolve({macro:texture,detail:detailTexture,supportBounds:event.data.volume.supportBounds});
        }
      };
      worker.onerror=()=>{ worker.terminate(); this.worker=null; this.rejectVolume=null; reject(new Error('La generazione del volume è fallita. Ricarica la scena.')); };
      worker.postMessage({size:VOLUME_RESOLUTION,seed:this.seed});
    });
  }
  private frame = (now: number) => {
    if(this.destroyed || this.deviceLost || !this.visible || !this.renderer || !this.quad) return;
    const cpuStart=performance.now();
    this.clockSample??={rafTimestamp:now,localNow:cpuStart,localTimeOrigin:performance.timeOrigin};
    this.raf=requestAnimationFrame(this.frame);
    if(this.frameLimit && this.framesInFlight>=this.frameLimit) {this.skippedFrames++;return;}
    if(this.dirtySize) this.applySize();
    const interval=this.previous ? now-this.previous : 0;
    this.previous=now;
    if(interval>0) { this.intervals.push(interval); if(this.intervals.length>180) this.intervals.shift(); }
    if(!this.paused) this.simulationTime+=Math.min(interval/1000,.05);
    const t=this.simulationTime;
    this.updateEvolution();
    this.drift.value.set(Math.sin(t*.065)*.055, Math.sin(t*.04)*.018,0);
    const angle=this.orbit?Math.sin(t*.09)*.38:0;
    const distance=16*Math.max(1,.85/this.aspect.value);
    this.origin.value.set(Math.sin(angle)*distance,3.5,Math.cos(angle)*distance);
    this.forward.value.copy(this.origin.value).sub(new Vector3(0,3.5,0)).negate().normalize();
    this.right.value.crossVectors(this.forward.value,new Vector3(0,1,0)).normalize();
    this.up.value.crossVectors(this.right.value,this.forward.value).normalize();
    const computeStart=performance.now();
    if(!this.frozenFlow) this.renderer.compute(this.interpolateFlow);
    const renderStart=performance.now();
    this.quad.render(this.renderer);
    this.measurement?.recordStages(renderStart-computeStart,performance.now()-renderStart);
    this.measurement?.recordDispatch(Math.max(0,cpuStart-now));
    this.measurement?.recordCPU(performance.now()-cpuStart);
    this.measurement?.record(now);
    if(this.measurement?.result && !this.report) this.finishBenchmark();
    if(now-this.uiTime>500) { this.uiTime=now; this.updateMetrics(now); }
    if(this.timestampSupported && !this.timestampPending && now-this.timestampTime>=200) {
      this.timestampPending=true; this.timestampTime=now;
      const run=this.measurement,renderer=this.renderer,started=performance.now();
      this.timestampPromise=Promise.all([renderer.resolveTimestampsAsync('render'),...(this.timingMode==='render'?[]:[renderer.resolveTimestampsAsync('compute')])]).then(()=>{
        if(this.destroyed || !this.renderer) return;
        const ms=renderer.info.render.timestamp,compute=renderer.info.compute.timestamp;
        if(Number.isFinite(ms) && ms>0) {this.gpuMs=ms;run?.recordGPU(ms,'render',started);}
        if(this.timingMode!=='render' && !this.frozenFlow && Number.isFinite(compute) && compute>=0) {this.computeMs=compute;run?.recordGPU(compute,'compute',started);}
      }).catch(()=>{ this.timestampSupported=false; this.gpuMs=null; }).finally(()=>{this.timestampPending=false;});
    }
    if(this.timingMode==='queue' && !this.frameLimit && !this.queuePending && this.device && now-this.queueTime>=500) {
      this.queuePending=true;this.queueTime=now;
      const started=performance.now(),run=this.measurement;
      this.queuePromise=this.device.queue.onSubmittedWorkDone().then(()=>{
        if(this.destroyed) return;
        this.queueMs=performance.now()-started;run?.recordQueue(this.queueMs,started);
      }).catch(()=>{}).finally(()=>{this.queuePending=false;});
    }
    if(this.frameLimit && this.device) {
      this.framesInFlight++;
      const started=performance.now(),run=this.measurement;
      const completion=this.device.queue.onSubmittedWorkDone().then(()=>{
        if(this.destroyed) return;
        this.queueMs=performance.now()-started;run?.recordQueue(this.queueMs,started);
      }).catch(()=>{}).finally(()=>{this.framesInFlight--;this.frameCompletions.delete(completion);});
      this.frameCompletions.add(completion);
    }
  };
  private updateEvolution() {
    const evolution=motionState(this.simulationTime,this.seed);
    this.growth.value.set(1/evolution.height,1/evolution.width,1/evolution.anvil);
    // Once growth is complete, reference space is identical to world space.
    // The enlarged mask contains the flow bound and the original fine-warp halo,
    // so the original conservative integer stride is safe again.
    this.emptyStep.value=this.stepSize.value*(this.simulationTime>=38?Math.max(1,Math.floor(EMPTY_SKIP_LIMIT/this.stepSize.value)):1);
    const phase=(this.simulationTime%MOTION_LOOP_SECONDS)/MOTION_LOOP_SECONDS*MOTION_PHASES,rawIndex=Math.floor(phase),index=rawIndex%MOTION_PHASES;
    this.flowPhase.value.set(index,(index+1)%MOTION_PHASES,phase-rawIndex);
  }
  private applySize() {
    if(!this.renderer) return;
    const pixelScale=this.outputMode==='screen'?this.viewport.dpr:1;
    this.outputWidth=this.outputMode==='720'?1280:this.outputMode==='1080'?1920:Math.max(1,Math.round(this.viewport.width*pixelScale));
    this.outputHeight=this.outputMode==='720'?720:this.outputMode==='1080'?1080:Math.max(1,Math.round(this.viewport.height*pixelScale));
    this.internalWidth=Math.round(this.outputWidth*QUALITY[this.quality].scale);
    this.internalHeight=Math.round(this.outputHeight*QUALITY[this.quality].scale);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.internalWidth,this.internalHeight,false);
    this.aspect.value=this.outputWidth/this.outputHeight;
    this.emit({type:'layout',fixed:this.outputMode==='720'||this.outputMode==='1080'});
    this.resolution.value.set(this.internalWidth,this.internalHeight);
    this.stepSize.value=7/QUALITY[this.quality].steps;
    // Deformation changes the material-space distance of a world step. Retain
    // ordinary integration steps until a new accelerated margin is proven.
    this.emptyStep.value=this.stepSize.value;
    this.dirtySize=false;
    this.intervals=[]; this.previous=0;
  }
  private updateMetrics(now: number) {
    const stats=summarizeFrames(this.intervals);
    this.text('status',this.simulationTime<38?`WebGPU · formazione accelerata · ${Math.round(Math.min(1,this.simulationTime/38)*100)}%`:'WebGPU · convezione attiva');
    this.text('metrics',`${this.host.thread==='worker'?'Worker WebGPU':'WebGPU'} · ${stats.fps.toFixed(1)} fps rAF · ${this.adapterInfo.description || this.adapterInfo.vendor || 'GPU non identificata'}\nOutput ${this.outputWidth}×${this.outputHeight} · interno ${this.internalWidth}×${this.internalHeight}\n${QUALITY[this.quality].steps} passi nominali · mediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} ms\nGPU rendering ${this.gpuMs===null?'non disponibile':`${this.gpuMs.toFixed(2)} ms`} · flusso ${this.computeMs===null?'n/d':`${this.computeMs.toFixed(3)} ms`}\n${this.queueMs===null?'':`Coda completata: ${this.queueMs.toFixed(2)} ms · non è presentazione\n`}Volume ${VOLUME_RESOLUTION}³ + dettaglio ${DETAIL_RESOLUTION}³ · nessun TAA\nTempo della nube: ${this.simulationTime.toFixed(1)} s · seme: ${this.seed}`);
    if(this.measurement && !this.measurement.result && !this.measurement.cancelReason) {
      const remaining=Math.max(0,(this.measurement.start+this.measurement.warmup+this.measurement.duration-now)/1000);
      this.text('result',`Misura in corso · ${Math.ceil(remaining)} s · ${this.measurement.intervals.length} frame raccolti`);
    }
  }
  private startBenchmark(duration: number) {
    if(!this.ready || !this.visible) return;
    if(this.dirtySize) this.applySize();
    this.invalidate('Nuova misura');
    this.report=null; this.emit({type:'report',report:null}); this.setButtonEnabled('export',false);
    this.measurement=new FrameMeasurement(performance.now(),duration,2000);
    this.benchmarkContext={date:new Date().toISOString(),backend:'WebGPU',adapter:this.adapterInfo,threeRevision:'186',quality:this.quality,
      output:[this.outputWidth,this.outputHeight],internal:[this.internalWidth,this.internalHeight],nominalSteps:QUALITY[this.quality].steps,
      rendererVersion:'convective-thread-v11',executionThread:this.host.thread,clockSample:this.clockSample,skippedFramesScope:'includes warmup',profiling:this.profiling,timingMode:this.timingMode,automaticComputeReadback:this.timingMode==='render',maxFramesInFlight:this.frameLimit||null,skippedFramesAtStart:this.skippedFrames,queueSampling:this.frameLimit?'after-each-submitted-frame':'every-500ms-in-queue-mode',flowMode:this.frozenFlow?'frozen':'full',simulationTimeStart:this.simulationTime,motionModel:'16-cubed GPU flow, 64 atlas phases interpolated by compute every frame, 68-second loop; co-deformed cached light',supportBounds:{min:this.supportMin.value.toArray(),max:this.supportMax.value.toArray()},outputMode:this.outputMode,emptyStepWorld:this.emptyStep.value,volume:[VOLUME_RESOLUTION,VOLUME_RESOLUTION,VOLUME_RESOLUTION],detailVolume:[DETAIL_RESOLUTION,DETAIL_RESOLUTION,DETAIL_RESOLUTION],seed:this.seed,shape:cloudParameters(this.seed),sun:this.side===0?'left':'right',orbit:this.orbit,paused:this.paused,
      userAgent:navigator.userAgent,devicePixelRatio:this.viewport.dpr,
      method:'Visible requestAnimationFrame intervals, CPU compute/render submission and callback dispatch delay. GPU render and compute timestamps sampled separately; their last-frame samples are not necessarily paired. Optional queue completion latency includes GPU work, readback and JS delivery; not compositor presentation.',warmupMs:2000,targetDurationMs:duration};
    this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.text('result','Riscaldamento · 2 s…');
  }
  private finishBenchmark() {
    if(!this.measurement?.result) return;
    const stats=this.measurement.result;
    const gpu=this.measurement.gpuSamplesMs;
    const cpu=this.measurement.cpuSamplesMs;
    this.report={...this.benchmarkContext,simulationTimeEnd:this.simulationTime,skippedFrames:this.skippedFrames-(this.benchmarkContext.skippedFramesAtStart as number),emptyStepWorldEnd:this.emptyStep.value,stats,
      gpu:summarizeSamples(gpu),cpu:summarizeSamples(cpu),gpuCompute:summarizeSamples(this.measurement.computeSamplesMs),queueCompletion:summarizeSamples(this.measurement.queueSamplesMs),
      rafDispatch:summarizeSamples(this.measurement.dispatchSamplesMs),cpuCompute:summarizeSamples(this.measurement.cpuComputeSamplesMs),cpuRender:summarizeSamples(this.measurement.cpuRenderSamplesMs),
      frameIntervalsMs:this.measurement.intervals,gpuSamplesMs:gpu,cpuSamplesMs:cpu,computeSamplesMs:this.measurement.computeSamplesMs,queueSamplesMs:this.measurement.queueSamplesMs,
      dispatchSamplesMs:this.measurement.dispatchSamplesMs,cpuComputeSamplesMs:this.measurement.cpuComputeSamplesMs,cpuRenderSamplesMs:this.measurement.cpuRenderSamplesMs};
    this.emit({type:'report',report:this.report});
    this.text('result',`${stats.fps.toFixed(1)} fps · ${(stats.durationMs/1000).toFixed(1)} s · ${stats.frames} frame\nMediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} · p99 ${stats.p99Ms.toFixed(2)}\n${stats.over33Ms} frame oltre 33,34 ms · massimo ${stats.maxMs.toFixed(2)} ms`);
    this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true); this.setButtonEnabled('export',true);
  }
  private invalidate(reason: string) {
    if(this.measurement && !this.measurement.result && !this.measurement.cancelReason) {
      this.measurement.cancel(reason); this.text('result',`Misura annullata: ${reason}.`);
      this.setButtonEnabled('benchmark',this.ready); this.setButtonEnabled('sustained',this.ready);
    }
  }
  private setButtonEnabled(action:string,enabled:boolean){this.emit({type:'enabled',action,enabled});}
  action(action:string){
    if(this.destroyed) return;
    if(action==='benchmark'||action==='sustained'){this.startBenchmark(action==='benchmark'?30000:90000);return;}
    if(action==='new-cloud'){void this.newCloud();return;}
    this.invalidate('Controlli modificati');
    if(action==='pause')this.paused=!this.paused;
    if(action==='orbit')this.orbit=!this.orbit;
    if(action==='light'){this.side=1-this.side;this.lightSide.value=this.side;this.sun.value.fromArray(this.side===0?SUN_LEFT:SUN_RIGHT).normalize();}
    if(action==='reset'){this.simulationTime=0;this.orbit=false;this.paused=false;this.side=0;this.lightSide.value=0;this.sun.value.set(...SUN_LEFT).normalize();}
    this.state();
  }
  change(name:string,value:string){
    if(this.destroyed) return;
    if(name==='inflight'){this.invalidate('Gestione della coda modificata');this.frameLimit=[1,2].includes(Number(value))?Number(value):0;return;}
    this.invalidate('Qualità o risoluzione modificata');
    if(name==='quality'&&value in QUALITY)this.quality=value as Quality;
    if(name==='output')this.outputMode=value;
    this.dirtySize=true;
  }
  resize(viewport:Viewport){this.viewport={...viewport};this.invalidate('Finestra ridimensionata');this.dirtySize=true;}
  visibility(visible:boolean){
    this.visible=visible;
    if(!visible){cancelAnimationFrame(this.raf);this.invalidate('Scheda nascosta');}
    else if(this.ready&&!this.destroyed){cancelAnimationFrame(this.raf);this.previous=0;this.intervals=[];this.raf=requestAnimationFrame(this.frame);}
  }
  private releaseGPU(): Promise<void> {
    this.cleanup ??= (async()=>{
      // Init can allocate Three's internal animation manager after teardown was requested.
      await this.initialization?.catch(()=>{});
      await this.timestampPromise;
      await this.queuePromise;
      await Promise.all(this.frameCompletions);
      this.releasingGPU=true;
      this.material?.dispose(); this.volume?.dispose();this.detailVolume?.dispose();this.flowTexture.dispose();this.currentFlow.dispose();this.interpolateFlow.dispose(); this.renderer?.dispose(); this.device?.destroy();
    })();
    return this.cleanup;
  }
  destroy():Promise<void>{
    this.destroyed=true;this.ready=false;cancelAnimationFrame(this.raf);this.worker?.terminate();this.worker=null;
    this.rejectVolume?.(new Error('Scena chiusa'));this.rejectVolume=null;
    this.invalidate('Scena chiusa');return this.releaseGPU();
  }
}
