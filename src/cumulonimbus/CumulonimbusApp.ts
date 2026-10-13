import {GPUSceneEngine,QUALITY,type Quality} from './GPUSceneEngine';
import type {RenderEvent,RenderCommand,Viewport} from './renderProtocol';
import './scene.css';
import {OrbitPointerController} from './camera';
import type {WeatherImpulse} from './weatherInteraction';
import {WEATHER_SCENES,type AtmosphereIntent,type WeatherScene} from './weatherState';
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
  private destroyed=false;
  private failed=false;
  private audio=new ThunderAudio();
  private audioEnabled=false;
  constructor(private readonly root:HTMLElement){
    root.innerHTML = `<div class="cloud-stage" data-testid="cloudia-stage"></div>
      <header class="scene-heading"><span class="eyebrow">Un piccolo osservatorio personale</span><h1>Cloudia<span class="brand-dot">.</span></h1><p><span data-testid="morphology-label">Cumulonembo</span> <span class="live-dot" aria-hidden="true"></span> <span data-testid="scene-name">Cielo neutro</span></p></header>
      <p class="view-help" id="cloud-view-help">Trascina il cielo per esplorarlo <span>· Frecce per ruotare · Home per ricentrare</span></p>
      <p class="scene-loading" role="status" data-testid="scene-status">Preparazione del cielo…</p>
      <div class="scene-controls" aria-label="Controlli del cielo">
        <nav class="input-switch" aria-label="Modalità di controllo"><button data-action="manual" aria-pressed="true">Manuale</button><details class="hands-guide"><summary>Mani <span>in arrivo</span></summary><section class="diagnostics hand-panel" aria-label="Controllo con le mani in preparazione">
          <span class="eyebrow">La prossima forma di gioco</span><h2>Il cielo, tra le dita.</h2>
          <div class="camera-placeholder"><svg viewBox="0 0 120 100" aria-hidden="true"><path d="M34 81C26 69 20 57 24 54c5-4 13 11 15 8V28c0-7 9-7 9 0v24-33c0-7 9-7 9 0v32-30c0-7 9-7 9 0v33-24c0-7 9-7 9 0v31c0 12-4 23-10 29Z"/><path d="M8 28V9h19M91 9h19v19M110 75v17H91M27 92H8V75"/></svg><strong>Camera non collegata</strong><span>Il riconoscimento non è ancora attivo.</span></div>
          <p>Per ora esplora con mouse, touch o tastiera. Questa è l’anteprima dei gesti che stiamo preparando.</p>
          <dl class="gesture-list"><div><dt>Sole / tramonto</dt><dd>Pizzica il sole, alzalo o abbassalo.</dd></div><div><dt>Pioggia</dt><dd>Palmo verso il basso, poi abbassa la mano.</dd></div><div><dt>Temporale / lampo</dt><dd>Seleziona temporale, poi chiudi la mano una volta.</dd></div><div><dt>Vento</dt><dd>Accompagna l’aria di lato a mano aperta.</dd></div><div><dt>Disperdi / ricondensa</dt><dd>Allontana o avvicina due mani.</dd></div></dl>
          <small>Nessun accesso alla camera viene richiesto. La futura attivazione sarà esplicita, con anteprima, arresto immediato e controlli manuali sempre disponibili. Mappatura proposta, ancora da provare con persone reali.</small>
        </section></details></nav>
        <section class="weather-console" aria-label="Scenari atmosferici"><div class="console-caption"><span>Componi il tuo cielo</span><span data-testid="weather-feedback" role="status">Controllo manuale</span></div><div class="weather-presets">${(['clear','sunset','rain','storm'] as const).map((key,i)=>`<button data-scene="${key}" aria-pressed="false"><span class="weather-symbol" aria-hidden="true">${['☀','◒','╱╱','ϟ'][i]}</span>${WEATHER_SCENES[key].label}</button>`).join('')}</div></section>
        <div class="scene-tools">
        <button data-action="pause">Pausa</button><button data-action="orbit" aria-pressed="false">Orbita</button>
        <button data-action="light">Luce da destra</button><button data-action="reset">Ricomincia</button><button data-action="new-cloud" disabled>Nuova forma</button><button data-action="center">Ricentra</button>
        <details><summary>Nube e correnti <span aria-hidden="true">＋</span></summary><div class="diagnostics weather-panel">
          <label>Forma<select name="family" disabled><option value="congestus">Congesto largo</option><option value="multicell">Torri multiple</option><option value="sheared" selected>Cella inclinata</option></select></label>
          <label>Intensità del vento<input name="wind" type="range" min="0" max="100" value="55"></label>
          <label>Dispersione mantenuta<input name="dispersion" type="range" min="0" max="100" value="0"></label>
          <div class="benchmark-controls"><button data-action="gust">Raffica</button><button data-action="disperse">Disperdi</button><button data-action="condense">Ricondensa</button></div>
          <p data-testid="cloud-flow-status" role="status">Correnti in preparazione…</p>
          <small>Nuova forma alterna tre famiglie e varia ogni nube. Disperdi allarga e assottiglia localmente il vapore, poi lo ricondensa. Tastiera sulla scena: frecce per ruotare, Home per ricentrare.</small>
        </div></details>
        <details class="weather-controls"><summary>Atmosfera e temporale</summary><div class="diagnostics weather-panel">
          <label>Cielo<select name="sky"><option value="clear">Limpido</option><option value="haze">Velato · più foschia</option><option value="storm" selected>Temporale · cielo neutro</option><option value="sunset">Tramonto</option><option value="rain">Pioggia</option></select></label>
          <label>Intensità della pioggia<input name="rain" type="range" min="0" max="100" value="0"></label><label>Velocità della nube<select name="speed"><option value="0.5">0,5× · osservazione lenta</option><option value="1" selected>1× · convezione</option><option value="2">2×</option><option value="4">4× · evidenzia il movimento</option></select></label>
          <label>Distanza del tuono<select name="distance"><option value="1">1 km · tuono dopo 2,9 s</option><option value="3" selected>3 km · tuono dopo 8,7 s</option><option value="8">8 km · tuono dopo 23,3 s</option></select></label>
          <div class="benchmark-controls"><button data-action="mature">Nube matura</button><button data-action="lightning">Lampo</button><button data-action="storm-auto" aria-pressed="false">Lampi automatici</button><button data-action="audio" aria-pressed="false">Attiva audio</button><button data-action="flash-preview">Isola luce del lampo</button></div>
          <p data-testid="storm-status" role="status">Lampi interni alla nube. Audio attivabile qui.</p>
          <small>La formazione è accelerata; il ritardo del tuono segue la distanza reale. Isola luce del lampo trattiene la luce per osservarla: premi Lampo o Ricomincia per tornare alla scena. Pausa o scheda nascosta interrompono i tuoni in attesa.</small>
        </div></details>
        <details class="technical-controls"><summary>Qualità e misure</summary><div class="diagnostics">
          <label>Qualità<select name="quality">${Object.entries(QUALITY).map(([key,v])=>`<option value="${key}" ${key===this.quality?'selected':''}>${v.label}</option>`).join('')}</select></label>
          <label>Risoluzione output<select name="output"><option value="window">Finestra · 1 pixel per pixel CSS</option><option value="screen">Schermo · nitidezza nativa</option><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option></select></label>
          ${this.profiling?`<button data-action="probe-reference">Fissa stato di confronto</button><label>Lavoro interno · confronto diagnostico<select name="ablation">${[['full','Completo · qualità finale'],['density','Densità e integrazione'],['cache','Densità + lettura luce'],['no-flow','Senza lettura flusso'],['no-detail','Senza dettaglio fine'],['no-flash','Senza shading del lampo']].map(([value,label])=>`<option value="${value}" ${value===(new URLSearchParams(location.search).get('ablation')??'full')?'selected':''}>${label}</option>`).join('')}</select></label><label>Diagnostica GPU<select name="timing">${[['render','Readback rendering · compute automatico'],['stages','Rendering e flusso'],['queue','Rendering, flusso e coda'],['off','Disattivata · sola cadenza']].map(([value,label])=>`<option value="${value}" ${value===this.timingMode?'selected':''}>${label}</option>`).join('')}</select></label><label>Flusso di confronto<select name="flow"><option value="full" ${!this.frozenFlow?'selected':''}>Animato · completo</option><option value="frozen" ${this.frozenFlow?'selected':''}>Congelato · confronto diagnostico</option></select></label>`:''}
          ${this.profiling?`<label>Coda dei frame<select name="inflight"><option value="0" ${!this.frameLimit?'selected':''}>Invio continuo</option><option value="1" ${this.frameLimit===1?'selected':''}>Massimo 1 in attesa</option><option value="2" ${this.frameLimit===2?'selected':''}>Massimo 2 in attesa</option></select></label>`:''}
          <p data-testid="performance-live">In attesa della GPU…</p>
          <div class="benchmark-controls"><button data-action="benchmark" disabled>Misura 30 secondi</button><button data-action="sustained" disabled>Misura 90 secondi</button><button data-action="export" disabled>Esporta JSON</button></div>
          <p data-testid="benchmark-result">Il test include 2 secondi di riscaldamento e si interrompe se cambi scena o nascondi la scheda.</p>
          <small>FPS = frame inviati per secondo di tempo reale tra callback rAF. Non certifica la presentazione del compositore. Tempi GPU separati quando disponibili. Nessuna risoluzione adattiva nascosta.</small>
          <a href="?legacy">Apri il vecchio laboratorio</a>
        </div></details>
      </div></div><script type="application/json" data-testid="benchmark-json"></script>`;

    this.controls=root.querySelector('.scene-controls')!;this.status=root.querySelector('[data-testid="scene-status"]')!;
    this.metrics=root.querySelector('[data-testid="performance-live"]')!;this.result=root.querySelector('[data-testid="benchmark-result"]')!;this.dynamics=root.querySelector('[data-testid="cloud-flow-status"]')!;this.rawReport=root.querySelector('[data-testid="benchmark-json"]')!;
    root.querySelector<HTMLSelectElement>('select[name="output"]')!.value=this.outputMode;
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Nube volumetrica ruotabile');this.canvas.setAttribute('aria-describedby','cloud-view-help');this.canvas.tabIndex=0;root.querySelector('.cloud-stage')!.append(this.canvas);
    this.controls.addEventListener('click',this.onClick,{signal:this.events.signal});this.controls.addEventListener('change',this.onChange,{signal:this.events.signal});
    this.controls.addEventListener('input',this.onInput,{signal:this.events.signal});
    for(const panel of this.controls.querySelectorAll('details'))panel.addEventListener('toggle',()=>{if(panel.open)for(const other of this.controls.querySelectorAll('details'))if(other!==panel)other.open=false;},{signal:this.events.signal});
    this.pointer=new OrbitPointerController(this.canvas,(dx,dy,width,height)=>this.send({type:'rotate',dx,dy,width,height}),()=>this.send({type:'action',action:'center'}));
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
  private fail(text:string){this.pointer.destroy();this.audio.destroy();this.failed=true;this.status.textContent=text;this.status.classList.remove('loaded');this.status.classList.add('failed');this.resolveReady?.();this.resolveReady=null;for(const input of this.controls.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input'))input.disabled=true;this.stopWorker();}
  private onEvent=(event:RenderEvent)=>{
    if(this.destroyed||this.failed)return;
    if(event.type==='text'){({status:this.status,metrics:this.metrics,result:this.result,dynamics:this.dynamics})[event.field].textContent=event.text;}
    if(event.type==='statusState'){if(event.state==='failed'){this.fail(this.status.textContent||'Rendering fallito.');return;}this.status.classList.remove('loaded','failed');if(event.state!=='loading')this.status.classList.add(event.state);}
    if(event.type==='enabled'){const input=this.controls.querySelector<HTMLButtonElement|HTMLSelectElement>(`[data-action="${event.action}"],[name="${event.action}"]`);if(input)input.disabled=!event.enabled;}
    if(event.type==='layout')this.root.classList.toggle('fixed-output',event.fixed);
    if(event.type==='state'){
      this.controls.querySelector('[data-action="pause"]')!.textContent=event.paused?'Riprendi':'Pausa';
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
    const clearsHold=command.type==='action'&&['disperse','condense','reset'].includes(command.action)||command.type==='impulse'&&['disperse','condense'].includes(command.impulse.type);
    if(clearsHold)this.root.querySelector<HTMLInputElement>('input[name="dispersion"]')!.value='0';
    if(this.renderWorker){this.renderWorker.postMessage(command);return;}
    if(command.type==='action')this.engine?.action(command.action);
    if(command.type==='change')this.engine?.change(command.name,command.value);
    if(command.type==='rotate')this.engine?.rotate(command.dx,command.dy,command.width,command.height);
    if(command.type==='impulse')this.engine?.impulse(command.impulse);
    if(command.type==='atmosphere')this.engine?.atmosphere(command.intent);
    if(command.type==='resize')this.engine?.resize(command.viewport);
    if(command.type==='visibility')this.engine?.visibility(command.visible);
  }
  applyWeatherImpulse(impulse:WeatherImpulse){this.send({type:'impulse',impulse});}
  applyAtmosphereIntent(intent:AtmosphereIntent){
    this.send({type:'atmosphere',intent});
    if(intent.type==='scene'){
      this.root.querySelector<HTMLSelectElement>('[name="sky"]')!.value=intent.scene;
      this.root.querySelector<HTMLInputElement>('[name="rain"]')!.value=String(WEATHER_SCENES[intent.scene].rain*100);
      this.root.querySelector('[data-testid="scene-name"]')!.textContent=WEATHER_SCENES[intent.scene].label;
      this.root.querySelector('[data-testid="weather-feedback"]')!.textContent=`Scenario: ${WEATHER_SCENES[intent.scene].label}`;
      for(const button of this.root.querySelectorAll<HTMLElement>('[data-scene]'))button.setAttribute('aria-pressed',String(button.dataset.scene===intent.scene));
    }
  }
  private onClick=(event:MouseEvent)=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
    if(button.dataset.scene){this.applyAtmosphereIntent({type:'scene',scene:button.dataset.scene as WeatherScene});return;}
    const action=button.dataset.action!;
    if(action==='probe-reference'){
      this.root.querySelector<HTMLSelectElement>('[name="sky"]')!.value='storm';
      this.root.querySelector<HTMLInputElement>('[name="rain"]')!.value='0';
      this.root.querySelector('[data-testid="scene-name"]')!.textContent='Cielo neutro';
      this.root.querySelector('[data-testid="weather-feedback"]')!.textContent='Stato fisso · diagnostica';
      for(const preset of this.root.querySelectorAll('[data-scene]'))preset.setAttribute('aria-pressed','false');
    }
    if(action==='manual'){for(const panel of this.controls.querySelectorAll('details'))panel.open=false;return;}
    if(action==='audio'){
      if(this.audioEnabled){this.audio.mute();this.audioEnabled=false;button.textContent='Attiva audio';button.setAttribute('aria-pressed','false');return;}
      button.disabled=true;button.textContent='Preparazione audio…';
      void this.audio.enable().then(()=>{if(this.destroyed||this.failed)return;this.audioEnabled=true;button.textContent='Disattiva audio';button.setAttribute('aria-pressed','true');this.root.querySelector('[data-testid="storm-status"]')!.textContent='Audio attivo · premi Lampo per ascoltare il tuono.';}).catch(error=>{if(!this.destroyed&&!this.failed){button.textContent='Attiva audio';this.root.querySelector('[data-testid="storm-status"]')!.textContent=error instanceof Error?error.message:String(error);}}).finally(()=>{if(!this.destroyed&&!this.failed)button.disabled=false;});return;
    }
    if(['pause','reset','new-cloud','mature','flash-preview'].includes(action))this.audio.cancel();
    if(action==='export'&&this.report){const url=URL.createObjectURL(new Blob([JSON.stringify(this.report,null,2)],{type:'application/json'}));const output=this.report.output as number[];const a=document.createElement('a');a.href=url;a.download=`cloudia-${this.report.quality}-${output.join('x')}-seed-${this.report.seed}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    this.send({type:'action',action});
  };
  private onInput=(event:Event)=>{const input=event.target as HTMLInputElement;if(input.type==='range')this.send({type:'change',name:input.name,value:input.value});};
  private onChange=(event:Event)=>{
    const input=event.target as HTMLSelectElement;if((input as unknown as HTMLInputElement).type==='range')return;
    if(input.name==='sky'){this.applyAtmosphereIntent({type:'scene',scene:input.value as WeatherScene});return;}
    if(this.profiling&&['timing','flow'].includes(input.name)){const next=new URL(location.href);next.searchParams.set(input.name,input.value);location.assign(next.toString());return;}
    if(this.profiling&&input.name==='inflight'){this.frameLimit=Number(input.value);const next=new URL(location.href);next.searchParams.set('inflight',input.value);history.replaceState(null,'',next.toString());}
    this.send({type:'change',name:input.name,value:input.value});
  };
  private onResize=()=>this.send({type:'resize',viewport:this.viewport()});
  private onVisibility=()=>{if(document.hidden){this.audio.cancel();this.pointer.cancel();}this.send({type:'visibility',visible:!document.hidden});};
  destroy(){
    if(this.destroyed)return;this.destroyed=true;this.pointer.destroy();this.audio.destroy();this.events.abort();this.resolveReady?.();this.resolveReady=null;
    for(const action of ['new-cloud','benchmark','sustained'])this.controls.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled=true;
    this.stopWorker();
    void this.engine?.destroy();this.canvas.remove();
  }
}
