import { Data3DTexture, LinearFilter, MeshBasicNodeMaterial, NoColorSpace, QuadMesh,
  RGBAFormat, RepeatWrapping, UnsignedByteType, Vector2, Vector3, WebGPURenderer } from 'three/webgpu';
import { texture3D, uniform, uv } from 'three/tsl';
import { integrateCloud } from './cloudShader';
import { EXTINCTION, SUN_LEFT, SUN_RIGHT, VOLUME_RESOLUTION, cloudParameters, iceHeights, type CloudVolume } from './volume';
import { FrameMeasurement, summarizeFrames } from './performance';
import './scene.css';

const QUALITY = {
  native: {label:'Alta · 100% / 128 passi', scale:1, steps:128},
  ultra: {label:'Massima · 100% / 256 passi', scale:1, steps:256},
  balanced: {label:'Fluida · 75% / 96 passi', scale:.75, steps:96},
} as const;
type Quality = keyof typeof QUALITY;
type CloudTextures = {macro:Data3DTexture;detail:Data3DTexture};

export class CumulonimbusApp {
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
  private readonly events = new AbortController();
  private readonly origin = uniform(new Vector3(0,3.5,16));
  private readonly forward = uniform(new Vector3(0,0,-1));
  private readonly right = uniform(new Vector3(1,0,0));
  private readonly up = uniform(new Vector3(0,1,0));
  private readonly aspect = uniform(16/9);
  private readonly resolution = uniform(new Vector2(1280,720));
  private readonly stepSize = uniform(7/128);
  private readonly drift = uniform(new Vector3());
  private readonly sun = uniform(new Vector3(...SUN_LEFT).normalize());
  private readonly lightSide = uniform(0);
  private readonly iceRange = uniform(new Vector2());
  private readonly controls: HTMLElement;
  private readonly status: HTMLElement;
  private readonly metrics: HTMLElement;
  private readonly result: HTMLElement;
  private readonly rawReport: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    const seedParam=new URLSearchParams(location.search).get('seed');
    const requestedSeed=seedParam===null?NaN:Number(seedParam);
    if(Number.isInteger(requestedSeed) && requestedSeed>=0 && requestedSeed<=0xffffffff) this.seed=requestedSeed;
    root.innerHTML = `<div class="cloud-stage" data-testid="cloudia-stage"></div>
      <header class="scene-heading"><span>CLOUDIA</span><h1>Cumulonembo</h1><p>Un piccolo cielo, tutto da muovere.</p></header>
      <p class="scene-loading" role="status" data-testid="scene-status">Preparazione del cielo…</p>
      <div class="scene-controls" aria-label="Controlli del cielo">
        <button data-action="pause">Pausa</button><button data-action="orbit" aria-pressed="false">Orbita</button>
        <button data-action="light">Luce da destra</button><button data-action="reset">Ricomincia</button><button data-action="new-cloud" disabled>Nuova nube</button>
        <details><summary>Qualità e misure</summary><div class="diagnostics">
          <label>Qualità<select name="quality">${Object.entries(QUALITY).map(([key,v])=>`<option value="${key}" ${key===this.quality?'selected':''}>${v.label}</option>`).join('')}</select></label>
          <label>Risoluzione output<select name="output"><option value="window">Finestra · 1 pixel per pixel CSS</option><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option></select></label>
          <p data-testid="performance-live">In attesa della GPU…</p>
          <div class="benchmark-controls"><button data-action="benchmark" disabled>Misura 30 secondi</button><button data-action="sustained" disabled>Misura 90 secondi</button><button data-action="export" disabled>Esporta JSON</button></div>
          <p data-testid="benchmark-result">Il test include 2 secondi di riscaldamento e si interrompe se cambi scena o nascondi la scheda.</p>
          <small>FPS = frame inviati per secondo di tempo reale tra callback rAF. Non certifica la presentazione del compositore. Tempi GPU separati quando disponibili. Nessuna risoluzione adattiva nascosta.</small>
          <a href="?legacy">Apri il vecchio laboratorio</a>
        </div></details>
      </div><script type="application/json" data-testid="benchmark-json"></script>`;
    this.controls = root.querySelector('.scene-controls')!;
    this.status = root.querySelector('[data-testid="scene-status"]')!;
    this.metrics = root.querySelector('[data-testid="performance-live"]')!;
    this.result = root.querySelector('[data-testid="benchmark-result"]')!;
    this.rawReport = root.querySelector('[data-testid="benchmark-json"]')!;
    this.controls.addEventListener('click',this.onClick,{signal:this.events.signal});
    this.controls.addEventListener('change',this.onChange,{signal:this.events.signal});
    window.addEventListener('resize',this.onResize,{signal:this.events.signal});
    document.addEventListener('visibilitychange',this.onVisibility,{signal:this.events.signal});
  }
  async start() {
    try {
      if (!navigator.gpu) throw new Error('Questo browser non espone WebGPU. Apri Cloudia in una versione recente di Chrome o Edge con accelerazione grafica.');
      const adapter = await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(this.destroyed) return;
      if(!adapter) throw new Error('Nessun adattatore WebGPU disponibile.');
      const info=adapter.info;
      this.adapterInfo={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter};
      const device=await adapter.requestDevice({requiredFeatures:adapter.features.has('timestamp-query')?['timestamp-query']:[]});
      if(this.destroyed) { device.destroy(); return; }
      this.device=device;
      const renderer = new WebGPURenderer({antialias:false,device,trackTimestamp:true});
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
        this.status.classList.remove('loaded'); this.status.classList.add('failed');
        this.status.textContent='Connessione alla GPU persa. Ricarica la scena.';
        void this.releaseGPU();
      };
      this.initialization=renderer.init().then(()=>{});
      await this.initialization;
      if(this.destroyed || this.deviceLost) { await this.releaseGPU(); return; }
      if(!('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend)) throw new Error('WebGPU non è disponibile sulla GPU selezionata. Il vecchio laboratorio resta accessibile con ?legacy.');
      // Timestamp queries are optional; RAF measurements remain available without them.
      this.timestampSupported = renderer.hasFeature('timestamp-query');
      renderer.domElement.setAttribute('aria-label','Cumulonembo volumetrico in un cielo diurno');
      this.root.querySelector('.cloud-stage')!.append(renderer.domElement);
      const texture = await this.loadVolume();
      if(this.destroyed || this.deviceLost) { texture.macro.dispose();texture.detail.dispose(); return; }
      this.installVolume(texture);
      this.applySize();
      this.quad!.render(renderer); // Compile the shader before declaring the scene ready.
      this.ready=true;
      this.status.textContent=`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`;
      this.status.classList.add('loaded');
      this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      this.setButtonEnabled('new-cloud',true);
      this.previous=0;
      if(!document.hidden) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      this.status.textContent=error instanceof Error ? error.message : String(error);
      this.status.classList.add('failed');
      await this.releaseGPU();
    }
  }
  private installVolume(textures: CloudTextures) {
    const oldMaterial=this.material, oldVolume=this.volume, oldDetail=this.detailVolume;
    const volumeNode=texture3D(textures.macro), detailNode=texture3D(textures.detail);
    this.volume=textures.macro;this.detailVolume=textures.detail; this.material=new MeshBasicNodeMaterial();
    this.iceRange.value.fromArray(iceHeights(this.seed));
    this.material.fragmentNode=integrateCloud({uv:uv(),volume:volumeNode,volumeSampler:volumeNode,detail:detailNode,detailSampler:detailNode,iceRange:this.iceRange,
      origin:this.origin,forward:this.forward,right:this.right,up:this.up,aspect:this.aspect,tanFov:uniform(.2867),
      stepSize:this.stepSize,resolution:this.resolution,drift:this.drift,sun:this.sun,lightSide:this.lightSide,extinction:uniform(EXTINCTION)});
    this.quad=new QuadMesh(this.material);
    oldMaterial?.dispose(); oldVolume?.dispose();oldDetail?.dispose();
  }
  private async newCloud() {
    if(!this.ready) return;
    this.invalidate('Nuova nube'); this.ready=false; cancelAnimationFrame(this.raf);
    this.setButtonEnabled('new-cloud',false); this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.status.classList.remove('loaded','failed'); this.status.textContent='Formazione di una nuova nube…';
    this.seed=crypto.getRandomValues(new Uint32Array(1))[0];
    try {
      const texture=await this.loadVolume();
      if(this.destroyed || this.deviceLost) {texture.macro.dispose();texture.detail.dispose();return;}
      this.installVolume(texture);
      this.simulationTime=0; this.previous=0; this.intervals=[]; this.ready=true;
      this.status.textContent=`WebGPU · volume ${VOLUME_RESOLUTION}³ · movimento lento`; this.status.classList.add('loaded');
      this.setButtonEnabled('new-cloud',true); this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true);
      if(!document.hidden) this.raf=requestAnimationFrame(this.frame);
    } catch(error) {
      if(this.destroyed || this.deviceLost) return;
      this.status.textContent=error instanceof Error?error.message:String(error); this.status.classList.add('failed');
    }
  }
  private loadVolume(): Promise<CloudTextures> {
    this.worker = new Worker(new URL('./volume.worker.ts',import.meta.url),{type:'module'});
    return new Promise((resolve,reject)=>{
      const worker=this.worker!;
      this.rejectVolume=reject;
      worker.onmessage=(event: MessageEvent<{progress?:number;volume?:CloudVolume;error?:string}>)=>{
        if(this.destroyed || this.deviceLost) return;
        if(event.data.progress!==undefined) this.status.textContent=`Formazione della nube e della luce · ${Math.round(event.data.progress*100)}%`;
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
          worker.terminate(); this.worker=null; this.rejectVolume=null; resolve({macro:texture,detail:detailTexture});
        }
      };
      worker.onerror=()=>{ worker.terminate(); this.worker=null; this.rejectVolume=null; reject(new Error('La generazione del volume è fallita. Ricarica la scena.')); };
      worker.postMessage({size:VOLUME_RESOLUTION,seed:this.seed});
    });
  }
  private frame = (now: number) => {
    if(this.destroyed || this.deviceLost || document.hidden || !this.renderer || !this.quad) return;
    const cpuStart=performance.now();
    this.raf=requestAnimationFrame(this.frame);
    if(this.dirtySize) this.applySize();
    const interval=this.previous ? now-this.previous : 0;
    this.previous=now;
    if(interval>0) { this.intervals.push(interval); if(this.intervals.length>180) this.intervals.shift(); }
    if(!this.paused) this.simulationTime+=Math.min(interval/1000,.05);
    const t=this.simulationTime;
    this.drift.value.set(Math.sin(t*.065)*.055, Math.sin(t*.04)*.018,0);
    const angle=this.orbit?Math.sin(t*.09)*.38:0;
    const distance=16*Math.max(1,.85/this.aspect.value);
    this.origin.value.set(Math.sin(angle)*distance,3.5,Math.cos(angle)*distance);
    this.forward.value.copy(this.origin.value).sub(new Vector3(0,3.5,0)).negate().normalize();
    this.right.value.crossVectors(this.forward.value,new Vector3(0,1,0)).normalize();
    this.up.value.crossVectors(this.right.value,this.forward.value).normalize();
    this.quad.render(this.renderer);
    this.measurement?.recordCPU(performance.now()-cpuStart);
    this.measurement?.record(now);
    if(this.measurement?.result && !this.report) this.finishBenchmark();
    if(now-this.uiTime>500) { this.uiTime=now; this.updateMetrics(now); }
    if(this.timestampSupported && !this.timestampPending && now-this.timestampTime>=200) {
      this.timestampPending=true; this.timestampTime=now;
      this.timestampPromise=this.renderer.resolveTimestampsAsync('render').then(()=>{
        if(this.destroyed || !this.renderer) return;
        const ms=this.renderer.info.render.timestamp;
        if(Number.isFinite(ms) && ms>0) { this.gpuMs=ms; this.measurement?.recordGPU(ms); }
      }).catch(()=>{ this.timestampSupported=false; this.gpuMs=null; }).finally(()=>{this.timestampPending=false;});
    }
  };
  private applySize() {
    if(!this.renderer) return;
    this.outputWidth=this.outputMode==='720'?1280:this.outputMode==='1080'?1920:Math.max(1,Math.round(this.root.clientWidth));
    this.outputHeight=this.outputMode==='720'?720:this.outputMode==='1080'?1080:Math.max(1,Math.round(this.root.clientHeight));
    this.internalWidth=Math.round(this.outputWidth*QUALITY[this.quality].scale);
    this.internalHeight=Math.round(this.outputHeight*QUALITY[this.quality].scale);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.internalWidth,this.internalHeight,false);
    this.aspect.value=this.outputWidth/this.outputHeight;
    this.root.classList.toggle('fixed-output',this.outputMode!=='window');
    this.resolution.value.set(this.internalWidth,this.internalHeight);
    this.stepSize.value=7/QUALITY[this.quality].steps;
    this.dirtySize=false;
    this.intervals=[]; this.previous=0;
  }
  private updateMetrics(now: number) {
    const stats=summarizeFrames(this.intervals);
    this.metrics.textContent=`WebGPU · ${stats.fps.toFixed(1)} fps rAF · ${this.adapterInfo.description || this.adapterInfo.vendor || 'GPU non identificata'}\nOutput ${this.outputWidth}×${this.outputHeight} · interno ${this.internalWidth}×${this.internalHeight}\n${QUALITY[this.quality].steps} passi nominali · mediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} ms\nGPU ${this.gpuMs===null?'non disponibile':`${this.gpuMs.toFixed(2)} ms`} · volume ${VOLUME_RESOLUTION}³ + dettaglio 64³ · nessun TAA\nSeme della nube: ${this.seed}`;
    if(this.measurement && !this.measurement.result && !this.measurement.cancelReason) {
      const remaining=Math.max(0,(this.measurement.start+this.measurement.warmup+this.measurement.duration-now)/1000);
      this.result.textContent=`Misura in corso · ${Math.ceil(remaining)} s · ${this.measurement.intervals.length} frame raccolti`;
    }
  }
  private startBenchmark(duration: number) {
    if(!this.ready || document.hidden) return;
    if(this.dirtySize) this.applySize();
    this.invalidate('Nuova misura');
    this.report=null; this.rawReport.textContent=''; this.setButtonEnabled('export',false);
    this.measurement=new FrameMeasurement(performance.now(),duration,2000);
    this.benchmarkContext={date:new Date().toISOString(),backend:'WebGPU',adapter:this.adapterInfo,threeRevision:'186',quality:this.quality,
      output:[this.outputWidth,this.outputHeight],internal:[this.internalWidth,this.internalHeight],nominalSteps:QUALITY[this.quality].steps,
      rendererVersion:'fibrous-detail-v3',volume:[VOLUME_RESOLUTION,VOLUME_RESOLUTION,VOLUME_RESOLUTION],detailVolume:[64,64,64],seed:this.seed,shape:cloudParameters(this.seed),sun:this.side===0?'left':'right',orbit:this.orbit,paused:this.paused,
      userAgent:navigator.userAgent,devicePixelRatio:window.devicePixelRatio,
      method:'Visible requestAnimationFrame intervals, one cloud draw submission per callback; not compositor presentation. CPU callback work through draw submission, asynchronous GPU timestamp samples when available.',warmupMs:2000,targetDurationMs:duration};
    this.setButtonEnabled('benchmark',false); this.setButtonEnabled('sustained',false);
    this.result.textContent='Riscaldamento · 2 s…';
  }
  private finishBenchmark() {
    if(!this.measurement?.result) return;
    const stats=this.measurement.result;
    const gpu=this.measurement.gpuSamplesMs;
    const cpu=this.measurement.cpuSamplesMs;
    this.report={...this.benchmarkContext,stats,gpu:gpu.length?{sampleCount:gpu.length,meanMs:gpu.reduce((a,b)=>a+b,0)/gpu.length,p95Ms:[...gpu].sort((a,b)=>a-b)[Math.floor(gpu.length*.95)]}:null,
      cpu:cpu.length?{sampleCount:cpu.length,meanMs:cpu.reduce((a,b)=>a+b,0)/cpu.length,p95Ms:[...cpu].sort((a,b)=>a-b)[Math.floor(cpu.length*.95)]}:null,
      frameIntervalsMs:this.measurement.intervals,gpuSamplesMs:gpu,cpuSamplesMs:cpu};
    this.rawReport.textContent=JSON.stringify(this.report);
    this.result.textContent=`${stats.fps.toFixed(1)} fps · ${(stats.durationMs/1000).toFixed(1)} s · ${stats.frames} frame\nMediana ${stats.medianMs.toFixed(2)} ms · p95 ${stats.p95Ms.toFixed(2)} · p99 ${stats.p99Ms.toFixed(2)}\n${stats.over33Ms} frame oltre 33,34 ms · massimo ${stats.maxMs.toFixed(2)} ms`;
    this.setButtonEnabled('benchmark',true); this.setButtonEnabled('sustained',true); this.setButtonEnabled('export',true);
  }
  private invalidate(reason: string) {
    if(this.measurement && !this.measurement.result && !this.measurement.cancelReason) {
      this.measurement.cancel(reason); this.result.textContent=`Misura annullata: ${reason}.`;
      this.setButtonEnabled('benchmark',this.ready); this.setButtonEnabled('sustained',this.ready);
    }
  }
  private setButtonEnabled(action: string,enabled: boolean) { this.controls.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled=!enabled; }
  private onClick = (event: MouseEvent) => {
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if(!button || button.disabled) return;
    const action=button.dataset.action;
    if(action==='benchmark' || action==='sustained') { this.startBenchmark(action==='benchmark'?30000:90000); return; }
    if(action==='new-cloud') {void this.newCloud();return;}
    if(action==='export' && this.report) {
      const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'}));
      const output=this.report.output as number[];
      const a=document.createElement('a'); a.href=url; a.download=`cloudia-${this.report.quality}-${output.join('x')}-seed-${this.report.seed}-${Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); return;
    }
    this.invalidate('Controlli modificati');
    if(action==='pause') { this.paused=!this.paused; button.textContent=this.paused?'Riprendi':'Pausa'; }
    if(action==='orbit') { this.orbit=!this.orbit; button.setAttribute('aria-pressed',String(this.orbit)); }
    if(action==='light') { this.side=1-this.side; this.lightSide.value=this.side; this.sun.value.fromArray(this.side===0?SUN_LEFT:SUN_RIGHT).normalize(); button.textContent=this.side===0?'Luce da destra':'Luce da sinistra'; }
    if(action==='reset') { this.simulationTime=0; this.orbit=false; this.paused=false; this.side=0; this.lightSide.value=0; this.sun.value.set(...SUN_LEFT).normalize(); this.controls.querySelector('[data-action="pause"]')!.textContent='Pausa'; this.controls.querySelector('[data-action="orbit"]')!.setAttribute('aria-pressed','false'); this.controls.querySelector('[data-action="light"]')!.textContent='Luce da destra'; }
  };
  private onChange = (event: Event) => {
    const input=event.target as HTMLSelectElement;
    this.invalidate('Qualità o risoluzione modificata');
    if(input.name==='quality' && input.value in QUALITY) this.quality=input.value as Quality;
    if(input.name==='output') this.outputMode=input.value;
    this.dirtySize=true;
  };
  private onResize = () => { this.invalidate('Finestra ridimensionata'); this.dirtySize=true; };
  private releaseGPU(): Promise<void> {
    this.cleanup ??= (async()=>{
      // Init can allocate Three's internal animation manager after teardown was requested.
      await this.initialization?.catch(()=>{});
      await this.timestampPromise;
      this.releasingGPU=true;
      this.material?.dispose(); this.volume?.dispose();this.detailVolume?.dispose(); this.renderer?.dispose(); this.device?.destroy(); this.renderer?.domElement.remove();
    })();
    return this.cleanup;
  }
  private onVisibility = () => {
    if(document.hidden) { cancelAnimationFrame(this.raf); this.invalidate('Scheda nascosta'); }
    else if(this.ready && !this.destroyed) { cancelAnimationFrame(this.raf); this.previous=0; this.intervals=[]; this.raf=requestAnimationFrame(this.frame); }
  };
  destroy() {
    this.destroyed=true; this.ready=false; this.events.abort(); cancelAnimationFrame(this.raf); this.worker?.terminate(); this.worker=null;
    this.rejectVolume?.(new Error('Scena chiusa')); this.rejectVolume=null;
    this.invalidate('Scena chiusa'); void this.releaseGPU();
  }
}
