import {GPUSceneEngine,type Quality} from './GPUSceneEngine';
import type {RenderEvent,RenderCommand,Viewport} from './renderProtocol';
import './scene.css';
import {OrbitPointerController,comparisonSurfaceDistance,comparisonCameraTarget} from './camera';
import {installPanelDismissal,installInspectorTabs,refreshRangeOutputs} from './panels';
import {sceneMarkup} from './sceneMarkup';
import {icon} from './uiIcons';
import type {WeatherImpulse} from './weatherInteraction';
import {WEATHER_SCENES,type AtmosphereIntent,type WeatherScene} from './weatherState';
import {ThunderAudio} from './ThunderAudio';
import type {NativeFrameExportEvent} from './nativeFrameExport';
const FRAME_PNG_PART_CHARACTERS=65_536;
export class CumulonimbusApp {
  private readonly profiling=new URLSearchParams(location.search).get('profile')==='1';
  private readonly timingMode=new URLSearchParams(location.search).get('timing')??'stages';
  private readonly frozenFlow=new URLSearchParams(location.search).get('flow')==='frozen';
  private readonly workerMode=new URLSearchParams(location.search).get('worker')==='1';
  private frameLimit=Number(new URLSearchParams(location.search).get('inflight'))||0;
  private quality:Quality='ultra';
  private outputMode=this.profiling?'1080':'screen';
  private readonly controls:HTMLElement;
  private readonly status:HTMLElement;
  private readonly metrics:HTMLElement;
  private readonly result:HTMLElement;
  private readonly dynamics:HTMLElement;
  private readonly pointer:OrbitPointerController;
  private readonly rawReport:HTMLElement;
  private readonly canvas:HTMLCanvasElement;
  private readonly events=new AbortController();
  private engine:GPUSceneEngine|null=null;
  private renderWorker:Worker|null=null;
  private workerStopTimer:ReturnType<typeof setTimeout>|null=null;
  private resolveReady:(()=>void)|null=null;
  private starting:Promise<void>|null=null;
  private report:Record<string,unknown>|null=null;
  private frameExportRequest=0;
  private frameConversionBusy=false;
  private frameEngineAvailable=false;
  private frameExportURL:string|null=null;
  private framePNGDataURL='';
  private framePNGPart=0;
  private destroyed=false;
  private failed=false;
  private audio=new ThunderAudio();
  private audioEnabled=false;
  constructor(private readonly root:HTMLElement){
    root.innerHTML=sceneMarkup({profiling:this.profiling,quality:this.quality,timingMode:this.timingMode,frozenFlow:this.frozenFlow,frameLimit:this.frameLimit});

    this.controls=root.querySelector('.scene-controls')!;this.status=root.querySelector('[data-testid="scene-status"]')!;
    this.metrics=root.querySelector('[data-testid="performance-live"]')!;this.result=root.querySelector('[data-testid="benchmark-result"]')!;this.dynamics=root.querySelector('[data-testid="cloud-flow-status"]')!;this.rawReport=root.querySelector('[data-testid="benchmark-json"]')!;
    root.querySelector<HTMLSelectElement>('select[name="output"]')!.value=this.outputMode;
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Nube volumetrica ruotabile');this.canvas.setAttribute('aria-describedby','cloud-view-help');this.canvas.tabIndex=0;root.querySelector('.cloud-stage')!.append(this.canvas);
    this.controls.addEventListener('click',this.onClick,{signal:this.events.signal});this.controls.addEventListener('change',this.onChange,{signal:this.events.signal});
    this.controls.addEventListener('input',this.onInput,{signal:this.events.signal});
    installPanelDismissal(this.controls,this.events.signal);
    installInspectorTabs(this.controls,this.events.signal);
    refreshRangeOutputs(this.controls);
    const initialProbe=new URLSearchParams(location.search).get('ablation')??'full';
    if(this.profiling)this.showProbe(initialProbe);
    this.pointer=new OrbitPointerController(this.canvas,(dx,dy,width,height)=>this.send({type:'rotate',dx,dy,width,height}),()=>this.send({type:'action',action:'center'}),delta=>this.send({type:'zoom',delta}));
    window.addEventListener('resize',this.onResize,{signal:this.events.signal});document.addEventListener('visibilitychange',this.onVisibility,{signal:this.events.signal});
  }
  private viewport():Viewport{return {width:this.root.clientWidth,height:this.root.clientHeight,dpr:window.devicePixelRatio};}
  start():Promise<void>{return this.starting??=this.startImpl();}
  private async startImpl(){
    if(this.destroyed)return;
    if(!this.workerMode){this.engine=new GPUSceneEngine({canvas:this.canvas,search:location.search,viewport:this.viewport(),visible:!document.hidden,thread:'main',emit:this.onEvent});await this.engine.start();return;}
    if(!this.canvas.transferControlToOffscreen){this.fail('OffscreenCanvas non è disponibile. Usa la versione ordinaria senza ?worker=1.');return;}
    try {
    const surface=this.canvas.transferControlToOffscreen();
    const worker=new Worker(new URL('./render.worker.ts',import.meta.url),{type:'module'});this.renderWorker=worker;
    const ready=new Promise<void>(resolve=>{this.resolveReady=resolve;});
    worker.onmessage=(event:MessageEvent<RenderEvent>)=>{
      if(event.data.type==='closed'){this.closeWorker(worker);return;}
      if(!this.destroyed)this.onEvent(event.data);
    };
    worker.onerror=event=>{if(!this.destroyed)this.fail(event.message||'Il rendering nel worker è fallito.');};
    worker.postMessage({type:'init',canvas:surface,search:location.search,viewport:this.viewport(),visible:!document.hidden} satisfies RenderCommand,[surface]);
    await ready;
    } catch(error){this.fail(`${error instanceof Error?error.message:String(error)}. Prova la versione ordinaria con ?worker=0.`);if(this.renderWorker)this.closeWorker(this.renderWorker);}
  }
  private closeWorker(worker:Worker){if(this.renderWorker!==worker)return;if(this.workerStopTimer!==null)clearTimeout(this.workerStopTimer);this.workerStopTimer=null;worker.terminate();this.renderWorker=null;}
  private stopWorker(){const worker=this.renderWorker;if(!worker||this.workerStopTimer!==null)return;try{worker.postMessage({type:'stop'} satisfies RenderCommand);this.workerStopTimer=setTimeout(()=>this.closeWorker(worker),1000);}catch{this.closeWorker(worker);}}
  private fail(text:string){this.frameExportRequest++;this.clearFrameExportData();this.pointer.destroy();this.audio.destroy();this.failed=true;this.status.textContent=text;this.status.classList.remove('loaded');this.status.classList.add('failed');this.resolveReady?.();this.resolveReady=null;for(const input of this.controls.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input'))input.disabled=true;this.stopWorker();}
  private clearFrameExportData(){
    if(this.frameExportURL){URL.revokeObjectURL(this.frameExportURL);this.frameExportURL=null;}
    this.framePNGDataURL='';this.framePNGPart=0;
    for(const id of ['frame-export-json','frame-export-png']){const field=this.root.querySelector<HTMLTextAreaElement>(`[data-testid="${id}"]`);if(field)field.value='';}
    const data=this.root.querySelector<HTMLElement>('[data-testid="frame-export-data"]');if(data)data.hidden=true;
    const link=this.root.querySelector<HTMLAnchorElement>('[data-testid="frame-export-download"]');if(link){link.removeAttribute('href');link.hidden=true;}
    this.renderFramePNGPart();
  }
  private renderFramePNGPart(){
    const field=this.root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-png"]');if(!field)return;
    const count=Math.ceil(this.framePNGDataURL.length/FRAME_PNG_PART_CHARACTERS);
    this.framePNGPart=Math.max(0,Math.min(this.framePNGPart,count-1));
    const start=this.framePNGPart*FRAME_PNG_PART_CHARACTERS;
    field.value=this.framePNGDataURL.slice(start,start+FRAME_PNG_PART_CHARACTERS);
    this.root.querySelector<HTMLElement>('[data-testid="frame-export-part"]')!.textContent=count?`Parte ${this.framePNGPart+1} di ${count} · caratteri ${start+1}–${start+field.value.length} di ${this.framePNGDataURL.length}`:'';
    this.root.querySelector<HTMLButtonElement>('[data-action="frame-part-previous"]')!.disabled=this.framePNGPart===0;
    this.root.querySelector<HTMLButtonElement>('[data-action="frame-part-next"]')!.disabled=!count||this.framePNGPart===count-1;
  }
  private updateFrameCaptureButton(){
    const button=this.root.querySelector<HTMLButtonElement>('[data-action="frame-capture"]');
    if(button)button.disabled=this.destroyed||this.failed||!this.frameEngineAvailable||this.frameConversionBusy;
  }
  private async onFrameExport(event:NativeFrameExportEvent){
    if(!this.profiling)return;
    if(event.requestId!==this.frameExportRequest){if(event.state==='ready')this.send({type:'frameExportDone',requestId:event.requestId});return;}
    const status=this.root.querySelector<HTMLElement>('[data-testid="frame-export-status"]')!;
    if(event.state==='pending'){status.dataset.state='pending';status.textContent='Acquisizione del prossimo disegno della scena…';return;}
    if(event.state==='error'){status.dataset.state='error';status.textContent=event.message;return;}
    if(event.state==='cleared'){this.clearFrameExportData();status.dataset.state='cleared';status.textContent=event.busy?'Dati svuotati. Attendi la conclusione dell’acquisizione già avviata.':'Esportazione svuotata.';return;}
    if(event.state!=='ready')return;
    this.frameConversionBusy=true;this.updateFrameCaptureButton();status.dataset.state='encoding';status.textContent='Preparazione del PNG e dei metadati…';
    try{
      const bytes=new Uint8Array(await event.png.arrayBuffer());
      if(this.destroyed||this.failed||event.requestId!==this.frameExportRequest)return;
      const chunks:string[]=[];
      for(let offset=0;offset<bytes.length;offset+=32768)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));
      const dataURL=`data:image/png;base64,${btoa(chunks.join(''))}`;
      const thread=event.metadata.executionThread==='worker'?'worker':'main',captureId=`${thread}-${event.requestId}-${event.info.sha256.slice(0,12)}`;
      const metadata={schema:'cloudia-native-frame-v1',state:'ready',captureId,requestId:event.requestId,png:event.info,metadata:event.metadata,
        textExport:{format:'Consecutive text parts of the PNG data URL; concatenate in order without separators.',partCharacters:FRAME_PNG_PART_CHARACTERS,totalCharacters:dataURL.length,parts:Math.ceil(dataURL.length/FRAME_PNG_PART_CHARACTERS)}};
      this.framePNGDataURL=dataURL;this.framePNGPart=0;this.renderFramePNGPart();
      this.root.querySelector<HTMLTextAreaElement>('[data-testid="frame-export-json"]')!.value=JSON.stringify(metadata,null,2);
      if(typeof URL.createObjectURL==='function'){
        this.frameExportURL=URL.createObjectURL(event.png);
        const link=this.root.querySelector<HTMLAnchorElement>('[data-testid="frame-export-download"]')!;
        link.href=this.frameExportURL;link.download=`cloudia-seed-${event.metadata.seed}-${captureId}.png`;link.hidden=false;
      }
      this.root.querySelector<HTMLElement>('[data-testid="frame-export-data"]')!.hidden=false;
      status.dataset.state='ready';status.textContent=`PNG acquisito · ${event.info.width}×${event.info.height} · ${event.info.byteLength.toLocaleString('it-IT')} byte · ${thread}. Metadati e immagine pronti.`;
    }catch(error){
      if(!this.destroyed&&!this.failed&&event.requestId===this.frameExportRequest){this.clearFrameExportData();status.dataset.state='error';status.textContent=`Preparazione del PNG fallita: ${error instanceof Error?error.message:String(error)}`;}
    }finally{
      this.frameConversionBusy=false;
      this.send({type:'frameExportDone',requestId:event.requestId});this.updateFrameCaptureButton();
    }
  }
  private onEvent=(event:RenderEvent)=>{
    if(this.destroyed||this.failed)return;
    if(event.type==='text'){({status:this.status,metrics:this.metrics,result:this.result,dynamics:this.dynamics})[event.field].textContent=event.text;}
    if(event.type==='statusState'){if(event.state==='failed'){this.fail(this.status.textContent||'Rendering fallito.');return;}this.status.classList.remove('loaded','failed');if(event.state!=='loading')this.status.classList.add(event.state);}
    if(event.type==='enabled'){
      const input=this.controls.querySelector<HTMLButtonElement|HTMLSelectElement>(`[data-action="${event.action}"],[name="${event.action}"]`);if(input)input.disabled=!event.enabled;
      if(event.action==='frame-capture'){
        this.frameEngineAvailable=event.enabled;this.updateFrameCaptureButton();
        const status=this.root.querySelector<HTMLElement>('[data-testid="frame-export-status"]');
        if(event.enabled&&!this.frameConversionBusy&&status?.dataset.state==='cleared')status.textContent='Esportazione svuotata.';
      }
    }
    if(event.type==='frameExport')void this.onFrameExport(event);
    if(event.type==='layout')this.root.classList.toggle('fixed-output',event.fixed);
    if(event.type==='view'){this.root.querySelector<HTMLInputElement>('[name=zoom]')!.value=String(event.approach*100);this.root.querySelector('[data-testid=view-distance]')!.textContent=event.approach>.98?'Avvicinamento massimo · distanza stimata':`Avvicinamento ${Math.round(event.approach*100)}%`; }
    if(event.type==='state'){
      const pause=this.controls.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
      pause.innerHTML=icon(event.paused?'play':'pause');pause.setAttribute('aria-label',event.paused?'Riprendi':'Pausa');pause.title=event.paused?'Riprendi':'Pausa';
      this.controls.querySelector('[data-action="orbit"]')!.setAttribute('aria-pressed',String(event.orbit));
      this.controls.querySelector('[data-action="light"]')!.textContent=event.side===0?'Luce da destra':'Luce da sinistra';
    }
    if(event.type==='morphology'){
      const names={congestus:'Congesto largo',multicell:'Torri multiple',sheared:'Cella inclinata'};
      this.root.querySelector('[data-testid="morphology-label"]')!.textContent=names[event.family];
      this.root.querySelector<HTMLSelectElement>('select[name="family"]')!.value=event.family;
      this.root.dataset.seed=String(event.seed);this.root.dataset.morphology=event.family;
      this.root.querySelector<HTMLInputElement>('input[name="dispersion"]')!.value='0';
    }
    if(event.type==='report'){this.report=event.report;this.rawReport.textContent=event.report?JSON.stringify(event.report):'';
      const witness=this.root.querySelector<HTMLTextAreaElement>('[data-testid=terrain-shadow-witness-json]');
      if(witness)witness.value=event.report?.reportKind==='terrain-shadow-installed-witness-v59'?JSON.stringify(event.report):'';
    }
    if(event.type==='flash'){
      this.audio.play(event.seed,event.distance,event.emittedAt);
      this.root.querySelector('[data-testid="storm-status"]')!.textContent=`Lampo · ${event.distance} km · tuono dopo ${event.delay.toFixed(1)} s${this.audioEnabled?'':' · audio disattivato'}`;
    }
    if(event.type==='silence')this.audio.cancel();
    if(event.type==='stormState')this.controls.querySelector('[data-action="storm-auto"]')!.setAttribute('aria-pressed',String(event.auto));
    if(event.type==='view'||event.type==='morphology')refreshRangeOutputs(this.controls);
    if(event.type==='ready'){this.resolveReady?.();this.resolveReady=null;}
  };
  private send(command:Exclude<RenderCommand,{type:'init'}>){
    if(this.destroyed||this.failed)return;
    const clearsHold=command.type==='action'&&['disperse','condense','reset'].includes(command.action)||command.type==='impulse'&&['disperse','condense'].includes(command.impulse.type);
    if(clearsHold)this.root.querySelector<HTMLInputElement>('input[name="dispersion"]')!.value='0';
    if(clearsHold)refreshRangeOutputs(this.controls);
    if(this.renderWorker){this.renderWorker.postMessage(command);return;}
    if(command.type==='action')this.engine?.action(command.action);
    if(command.type==='change')this.engine?.change(command.name,command.value);
    if(command.type==='zoom')this.engine?.zoom(command.delta);
    if(command.type==='rotate')this.engine?.rotate(command.dx,command.dy,command.width,command.height);
    if(command.type==='impulse')this.engine?.impulse(command.impulse);
    if(command.type==='atmosphere')this.engine?.atmosphere(command.intent);
    if(command.type==='resize')this.engine?.resize(command.viewport);
    if(command.type==='visibility')this.engine?.visibility(command.visible);
    if(command.type==='frameExport')this.engine?.exportFrame(command.requestId);
    if(command.type==='frameExportClear')this.engine?.clearFrameExport(command.requestId);
    if(command.type==='frameExportDone')this.engine?.finishFrameExportDisplay(command.requestId);
  }
  applyWeatherImpulse(impulse:WeatherImpulse){this.send({type:'impulse',impulse});}
  applyAtmosphereIntent(intent:AtmosphereIntent){
    this.send({type:'atmosphere',intent});
    if(intent.type==='scene'){
      this.root.querySelector<HTMLSelectElement>('[name="sky"]')!.value=intent.scene;
      this.root.querySelector<HTMLInputElement>('[name="rain"]')!.value=String(WEATHER_SCENES[intent.scene].rain*100);
      this.root.querySelector('[data-testid="scene-name"]')!.textContent=WEATHER_SCENES[intent.scene].label;
      this.root.querySelector('[data-testid="weather-feedback"]')!.textContent=`Scenario: ${WEATHER_SCENES[intent.scene].label}`;
      refreshRangeOutputs(this.controls);
      for(const button of this.root.querySelectorAll<HTMLElement>('[data-scene]'))button.setAttribute('aria-pressed',String(button.dataset.scene===intent.scene));
    }
  }
  private onClick=(event:MouseEvent)=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
    if(button.dataset.scene){this.applyAtmosphereIntent({type:'scene',scene:button.dataset.scene as WeatherScene});return;}
    const action=button.dataset.action;if(!action)return;
    if(action==='frame-capture'&&this.profiling){
      this.clearFrameExportData();this.frameEngineAvailable=false;this.updateFrameCaptureButton();
      this.send({type:'frameExport',requestId:++this.frameExportRequest});return;
    }
    if(action==='frame-clear'&&this.profiling){this.clearFrameExportData();this.send({type:'frameExportClear',requestId:++this.frameExportRequest});return;}
    if((action==='frame-part-next'||action==='frame-part-previous')&&this.profiling){this.framePNGPart+=action==='frame-part-next'?1:-1;this.renderFramePNGPart();return;}
    if(action==='zoom-in'||action==='zoom-out'){this.send({type:'zoom',delta:action==='zoom-in'?.12:-.12});return;}
    if(action==='probe-reference'){
      this.root.querySelector<HTMLInputElement>('[name=wind]')!.value='55';
      this.root.querySelector<HTMLInputElement>('[name=dispersion]')!.value='0';
      this.root.querySelector<HTMLSelectElement>('[name="sky"]')!.value='storm';
      this.root.querySelector<HTMLInputElement>('[name="rain"]')!.value='0';
      this.root.querySelector('[data-testid="scene-name"]')!.textContent='Cielo neutro';
      this.root.querySelector('[data-testid="weather-feedback"]')!.textContent='Stato fisso · diagnostica';
      for(const preset of this.root.querySelectorAll('[data-scene]'))preset.setAttribute('aria-pressed','false');
      refreshRangeOutputs(this.controls);
    }
    if(action==='audio'){
      if(this.audioEnabled){this.audio.mute();this.audioEnabled=false;button.textContent='Attiva audio';button.setAttribute('aria-pressed','false');return;}
      button.disabled=true;button.textContent='Preparazione audio…';
      void this.audio.enable().then(()=>{if(this.destroyed||this.failed)return;this.audioEnabled=true;button.textContent='Disattiva audio';button.setAttribute('aria-pressed','true');this.root.querySelector('[data-testid="storm-status"]')!.textContent='Audio attivo · premi Lampo per ascoltare il tuono.';}).catch(error=>{if(!this.destroyed&&!this.failed){button.textContent='Attiva audio';this.root.querySelector('[data-testid="storm-status"]')!.textContent=error instanceof Error?error.message:String(error);}}).finally(()=>{if(!this.destroyed&&!this.failed)button.disabled=false;});return;
    }
    if(['pause','reset','new-cloud','mature','flash-preview'].includes(action))this.audio.cancel();
    if(action==='export'&&this.report){const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'}));const output=this.report.output as number[];const a=document.createElement('a');a.href=url;a.download=`cloudia-${this.report.quality}-${output.join('x')}-seed-${this.report.seed}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    this.send({type:'action',action});
  };
  private showProbe(mode:string){
    const warning=this.root.querySelector<HTMLElement>('[data-testid="probe-warning"]')!;
    const surface=comparisonSurfaceDistance(location.search);
    warning.hidden=mode==='full'&&surface===null;
    warning.textContent=[mode!=='full'?`Sonda: ${mode}`:'',surface!==null?`Camera di confronto · raggio vicino ${surface.toFixed(4)} km`:'',comparisonCameraTarget(location.search)?'mira fissa':'','immagine diagnostica'].filter(Boolean).join(' · ');
  }
  private onInput=(event:Event)=>{const input=event.target as HTMLInputElement;if(input.type==='range'){refreshRangeOutputs(this.controls);this.send({type:'change',name:input.name,value:input.value});}};
  private onChange=(event:Event)=>{
    const input=event.target as HTMLSelectElement;if((input as unknown as HTMLInputElement).type==='range')return;
    if(input.name==='ablation')this.showProbe(input.value);
    if(input.name==='sky'){this.applyAtmosphereIntent({type:'scene',scene:input.value as WeatherScene});return;}
    if(this.profiling&&['timing','flow'].includes(input.name)){const next=new URL(location.href);next.searchParams.set(input.name,input.value);location.assign(next.toString());return;}
    if(this.profiling&&input.name==='inflight'){this.frameLimit=Number(input.value);const next=new URL(location.href);next.searchParams.set('inflight',input.value);history.replaceState(null,'',next.toString());}
    this.send({type:'change',name:input.name,value:input.value});
  };
  private onResize=()=>this.send({type:'resize',viewport:this.viewport()});
  private onVisibility=()=>{if(document.hidden){this.audio.cancel();this.pointer.cancel();}this.send({type:'visibility',visible:!document.hidden});};
  destroy(){
    if(this.destroyed)return;this.frameExportRequest++;this.clearFrameExportData();this.destroyed=true;this.pointer.destroy();this.audio.destroy();this.events.abort();this.resolveReady?.();this.resolveReady=null;
    for(const action of ['new-cloud','benchmark','sustained','frame-capture','frame-clear','frame-part-next','frame-part-previous']){const button=this.controls.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);if(button)button.disabled=true;}
    this.stopWorker();
    void this.engine?.destroy();this.canvas.remove();
  }
}
