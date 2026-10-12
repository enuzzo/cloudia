import {GPUSceneEngine,QUALITY,type Quality} from './GPUSceneEngine';
import type {RenderEvent,RenderCommand,Viewport} from './renderProtocol';
import './scene.css';
import {ThunderAudio} from './ThunderAudio';
export class CumulonimbusApp {
  private readonly profiling=new URLSearchParams(location.search).get('profile')==='1';
  private readonly timingMode=new URLSearchParams(location.search).get('timing')??'stages';
  private readonly frozenFlow=new URLSearchParams(location.search).get('flow')==='frozen';
  private readonly workerMode=new URLSearchParams(location.search).get('worker')==='1';
  private frameLimit=Number(new URLSearchParams(location.search).get('inflight'))||0;
  private quality:Quality='ultra';
  private outputMode=this.profiling?'1080':'window';
  private readonly controls:HTMLElement;
  private readonly status:HTMLElement;
  private readonly metrics:HTMLElement;
  private readonly result:HTMLElement;
  private readonly rawReport:HTMLElement;
  private readonly canvas:HTMLCanvasElement;
  private readonly events=new AbortController();
  private engine:GPUSceneEngine|null=null;
  private renderWorker:Worker|null=null;
  private workerStopTimer:ReturnType<typeof setTimeout>|null=null;
  private resolveReady:(()=>void)|null=null;
  private starting:Promise<void>|null=null;
  private report:Record<string,unknown>|null=null;
  private destroyed=false;
  private failed=false;
  private audio=new ThunderAudio();
  private audioEnabled=false;
  constructor(private readonly root:HTMLElement){
    root.innerHTML = `<div class="cloud-stage" data-testid="cloudia-stage"></div>
      <header class="scene-heading"><span>CLOUDIA</span><h1>Cumulonembo</h1><p>Un piccolo cielo, tutto da muovere.</p></header>
      <p class="scene-loading" role="status" data-testid="scene-status">Preparazione del cielo…</p>
      <div class="scene-controls" aria-label="Controlli del cielo">
        <button data-action="pause">Pausa</button><button data-action="orbit" aria-pressed="false">Orbita</button>
        <button data-action="light">Luce da destra</button><button data-action="reset">Ricomincia</button><button data-action="new-cloud" disabled>Nuova nube</button>
        <details class="weather-controls"><summary>Atmosfera e temporale</summary><div class="diagnostics weather-panel">
          <label>Cielo<select name="sky"><option value="clear">Limpido</option><option value="haze">Velato · più foschia</option><option value="storm">Temporale · luce attenuata</option></select></label>
          <label>Velocità della nube<select name="speed"><option value="0.5">0,5× · osservazione lenta</option><option value="1" selected>1× · convezione</option><option value="2">2×</option><option value="4">4× · evidenzia il movimento</option></select></label>
          <label>Distanza del tuono<select name="distance"><option value="1">1 km · tuono dopo 2,9 s</option><option value="3" selected>3 km · tuono dopo 8,7 s</option><option value="8">8 km · tuono dopo 23,3 s</option></select></label>
          <div class="benchmark-controls"><button data-action="mature">Nube matura</button><button data-action="lightning">Lampo</button><button data-action="storm-auto" aria-pressed="false">Lampi automatici</button><button data-action="audio" aria-pressed="false">Attiva audio</button><button data-action="flash-preview">Isola luce del lampo</button></div>
          <p data-testid="storm-status" role="status">Lampi interni alla nube. Audio attivabile qui.</p>
          <small>La formazione è accelerata; il ritardo del tuono segue la distanza reale. Isola luce del lampo trattiene la luce per osservarla: premi Lampo o Ricomincia per tornare alla scena. Pausa o scheda nascosta interrompono i tuoni in attesa.</small>
        </div></details>
        <details><summary>Qualità e misure</summary><div class="diagnostics">
          <label>Qualità<select name="quality">${Object.entries(QUALITY).map(([key,v])=>`<option value="${key}" ${key===this.quality?'selected':''}>${v.label}</option>`).join('')}</select></label>
          <label>Risoluzione output<select name="output"><option value="window">Finestra · 1 pixel per pixel CSS</option><option value="screen">Schermo · nitidezza nativa</option><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option></select></label>
          ${this.profiling?`<label>Diagnostica GPU<select name="timing">${[['render','Readback rendering · compute automatico'],['stages','Rendering e flusso'],['queue','Rendering, flusso e coda'],['off','Disattivata · sola cadenza']].map(([value,label])=>`<option value="${value}" ${value===this.timingMode?'selected':''}>${label}</option>`).join('')}</select></label><label>Flusso di confronto<select name="flow"><option value="full" ${!this.frozenFlow?'selected':''}>Animato · completo</option><option value="frozen" ${this.frozenFlow?'selected':''}>Congelato · confronto diagnostico</option></select></label>`:''}
          ${this.profiling?`<label>Coda dei frame<select name="inflight"><option value="0" ${!this.frameLimit?'selected':''}>Invio continuo</option><option value="1" ${this.frameLimit===1?'selected':''}>Massimo 1 in attesa</option><option value="2" ${this.frameLimit===2?'selected':''}>Massimo 2 in attesa</option></select></label>`:''}
          <p data-testid="performance-live">In attesa della GPU…</p>
          <div class="benchmark-controls"><button data-action="benchmark" disabled>Misura 30 secondi</button><button data-action="sustained" disabled>Misura 90 secondi</button><button data-action="export" disabled>Esporta JSON</button></div>
          <p data-testid="benchmark-result">Il test include 2 secondi di riscaldamento e si interrompe se cambi scena o nascondi la scheda.</p>
          <small>FPS = frame inviati per secondo di tempo reale tra callback rAF. Non certifica la presentazione del compositore. Tempi GPU separati quando disponibili. Nessuna risoluzione adattiva nascosta.</small>
          <a href="?legacy">Apri il vecchio laboratorio</a>
        </div></details>
      </div><script type="application/json" data-testid="benchmark-json"></script>`;

    this.controls=root.querySelector('.scene-controls')!;this.status=root.querySelector('[data-testid="scene-status"]')!;
    this.metrics=root.querySelector('[data-testid="performance-live"]')!;this.result=root.querySelector('[data-testid="benchmark-result"]')!;this.rawReport=root.querySelector('[data-testid="benchmark-json"]')!;
    root.querySelector<HTMLSelectElement>('select[name="output"]')!.value=this.outputMode;
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Cumulonembo volumetrico in un cielo diurno');root.querySelector('.cloud-stage')!.append(this.canvas);
    this.controls.addEventListener('click',this.onClick,{signal:this.events.signal});this.controls.addEventListener('change',this.onChange,{signal:this.events.signal});
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
  private fail(text:string){this.audio.destroy();this.failed=true;this.status.textContent=text;this.status.classList.remove('loaded');this.status.classList.add('failed');this.resolveReady?.();this.resolveReady=null;for(const input of this.controls.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select'))input.disabled=true;this.stopWorker();}
  private onEvent=(event:RenderEvent)=>{
    if(this.destroyed||this.failed)return;
    if(event.type==='text'){({status:this.status,metrics:this.metrics,result:this.result})[event.field].textContent=event.text;}
    if(event.type==='statusState'){if(event.state==='failed'){this.fail(this.status.textContent||'Rendering fallito.');return;}this.status.classList.remove('loaded','failed');if(event.state!=='loading')this.status.classList.add(event.state);}
    if(event.type==='enabled')this.controls.querySelector<HTMLButtonElement>(`[data-action="${event.action}"]`)!.disabled=!event.enabled;
    if(event.type==='layout')this.root.classList.toggle('fixed-output',event.fixed);
    if(event.type==='state'){
      this.controls.querySelector('[data-action="pause"]')!.textContent=event.paused?'Riprendi':'Pausa';
      this.controls.querySelector('[data-action="orbit"]')!.setAttribute('aria-pressed',String(event.orbit));
      this.controls.querySelector('[data-action="light"]')!.textContent=event.side===0?'Luce da destra':'Luce da sinistra';
    }
    if(event.type==='report'){this.report=event.report;this.rawReport.textContent=event.report?JSON.stringify(event.report):'';}
    if(event.type==='flash'){
      this.audio.play(event.seed,event.distance,event.emittedAt);
      this.root.querySelector('[data-testid="storm-status"]')!.textContent=`Lampo · ${event.distance} km · tuono dopo ${event.delay.toFixed(1)} s${this.audioEnabled?'':' · audio disattivato'}`;
    }
    if(event.type==='silence')this.audio.cancel();
    if(event.type==='stormState')this.controls.querySelector('[data-action="storm-auto"]')!.setAttribute('aria-pressed',String(event.auto));
    if(event.type==='ready'){this.resolveReady?.();this.resolveReady=null;}
  };
  private send(command:Exclude<RenderCommand,{type:'init'}>){
    if(this.destroyed||this.failed)return;
    if(this.renderWorker){this.renderWorker.postMessage(command);return;}
    if(command.type==='action')this.engine?.action(command.action);
    if(command.type==='change')this.engine?.change(command.name,command.value);
    if(command.type==='resize')this.engine?.resize(command.viewport);
    if(command.type==='visibility')this.engine?.visibility(command.visible);
  }
  private onClick=(event:MouseEvent)=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
    const action=button.dataset.action!;
    if(action==='audio'){
      if(this.audioEnabled){this.audio.mute();this.audioEnabled=false;button.textContent='Attiva audio';button.setAttribute('aria-pressed','false');return;}
      button.disabled=true;button.textContent='Preparazione audio…';
      void this.audio.enable().then(()=>{if(this.destroyed||this.failed)return;this.audioEnabled=true;button.textContent='Disattiva audio';button.setAttribute('aria-pressed','true');this.root.querySelector('[data-testid="storm-status"]')!.textContent='Audio attivo · premi Lampo per ascoltare il tuono.';}).catch(error=>{if(!this.destroyed&&!this.failed){button.textContent='Attiva audio';this.root.querySelector('[data-testid="storm-status"]')!.textContent=error instanceof Error?error.message:String(error);}}).finally(()=>{if(!this.destroyed&&!this.failed)button.disabled=false;});return;
    }
    if(['pause','reset','new-cloud','mature','flash-preview'].includes(action))this.audio.cancel();
    if(action==='export'&&this.report){const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'}));const output=this.report.output as number[];const a=document.createElement('a');a.href=url;a.download=`cloudia-${this.report.quality}-${output.join('x')}-seed-${this.report.seed}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    this.send({type:'action',action});
  };
  private onChange=(event:Event)=>{
    const input=event.target as HTMLSelectElement;
    if(this.profiling&&(input.name==='timing'||input.name==='flow')){const next=new URL(location.href);next.searchParams.set(input.name,input.value);location.assign(next.toString());return;}
    if(this.profiling&&input.name==='inflight'){this.frameLimit=Number(input.value);const next=new URL(location.href);next.searchParams.set('inflight',input.value);history.replaceState(null,'',next.toString());}
    this.send({type:'change',name:input.name,value:input.value});
  };
  private onResize=()=>this.send({type:'resize',viewport:this.viewport()});
  private onVisibility=()=>{if(document.hidden)this.audio.cancel();this.send({type:'visibility',visible:!document.hidden});};
  destroy(){
    if(this.destroyed)return;this.destroyed=true;this.audio.destroy();this.events.abort();this.resolveReady?.();this.resolveReady=null;
    for(const action of ['new-cloud','benchmark','sustained'])this.controls.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled=true;
    this.stopWorker();
    void this.engine?.destroy();this.canvas.remove();
  }
}
