import {QUALITY,type Quality} from './GPUSceneEngine';
import {WEATHER_SCENES} from './weatherState';
import {icon} from './uiIcons';

export function sceneMarkup({profiling,quality,timingMode,frozenFlow,frameLimit}:{profiling:boolean;quality:Quality;timingMode:string;frozenFlow:boolean;frameLimit:number}) {
  return `<div class="cloud-stage" data-testid="cloudia-stage"></div>
      <header class="scene-heading"><h1>Cloudia<span class="brand-dot">.</span></h1><p><span data-testid="morphology-label">Cumulonembo</span> <span class="live-dot" aria-hidden="true"></span> <span data-testid="scene-name">Cielo neutro</span></p></header>
      <p class="probe-warning" data-testid="probe-warning" hidden>Diagnostic probe</p><p class="view-help" id="cloud-view-help">Trascina per esplorare <span>· Scorri per avvicinarti</span></p>
      <p class="scene-loading" role="status" data-testid="scene-status">Preparazione del cielo…</p>
      <div class="scene-controls" aria-label="Controlli del cielo">
        <nav class="input-switch" aria-label="Modalità di controllo"><details class="hands-guide"><summary>Mani <span>in arrivo</span></summary><section class="diagnostics hand-panel" aria-label="Controllo con le mani in preparazione">
          <div class="panel-heading"><h2>Il cielo, tra le dita.</h2><button data-close-panel aria-label="Chiudi guida mani" class="icon-button">${icon("close")}</button></div>
          <div class="camera-placeholder"><svg viewBox="0 0 120 100" aria-hidden="true"><path d="M34 81C26 69 20 57 24 54c5-4 13 11 15 8V28c0-7 9-7 9 0v24-33c0-7 9-7 9 0v32-30c0-7 9-7 9 0v33-24c0-7 9-7 9 0v31c0 12-4 23-10 29Z"/><path d="M8 28V9h19M91 9h19v19M110 75v17H91M27 92H8V75"/></svg><strong>Camera non collegata</strong><span>Il riconoscimento non è ancora attivo.</span></div>
          <p>Per ora esplora con mouse, touch o tastiera. Questa è l’anteprima dei gesti che stiamo preparando.</p>
          <dl class="gesture-list"><div><dt>Sole / tramonto</dt><dd>Pizzica il sole, alzalo o abbassalo.</dd></div><div><dt>Pioggia</dt><dd>Palmo verso il basso, poi abbassa la mano.</dd></div><div><dt>Temporale / lampo</dt><dd>Seleziona temporale, poi chiudi la mano una volta.</dd></div><div><dt>Vento</dt><dd>Accompagna l’aria di lato a mano aperta.</dd></div><div><dt>Disperdi / ricondensa</dt><dd>Allontana o avvicina due mani.</dd></div></dl>
          <small>Nessun accesso alla camera viene richiesto. La futura attivazione sarà esplicita, con anteprima, arresto immediato e controlli manuali sempre disponibili. Mappatura proposta, ancora da provare con persone reali.</small>
        </section></details></nav>
        <span class="sr-only" data-testid="weather-feedback" role="status">Controllo manuale</span>
        <nav class="view-controls" aria-label="Distanza dalla nube"><button data-action="zoom-in" aria-label="Avvicinati alla nube" title="Avvicinati">${icon('plus')}</button><button data-action="zoom-out" aria-label="Allontanati dalla nube" title="Allontanati">${icon('minus')}</button><button data-action="center" aria-label="Torna al panorama" title="Panorama · Home">${icon('frame')}</button></nav>
        <nav class="scene-dock" aria-label="Comandi del cielo">
        <button data-action="pause" class="icon-button pause-button" aria-label="Pausa" title="Pausa">${icon('pause')}</button>
        <span class="dock-divider" aria-hidden="true"></span>
        <div class="weather-presets" aria-label="Scenari atmosferici">${(['clear','sunset','rain','storm'] as const).map(key=>`<button data-scene="${key}" aria-pressed="false">${icon(key)}<span>${WEATHER_SCENES[key].label}</span></button>`).join('')}</div>
        <span class="dock-divider" aria-hidden="true"></span>
        <details class="sky-inspector"><summary title="Regola il cielo" aria-label="Regola il cielo">${icon('sliders')}<span>Regola</span></summary>
        <section class="diagnostics inspector" aria-label="Regola il cielo">
          <div class="panel-heading"><h2>Regola il cielo</h2><button data-close-panel aria-label="Chiudi regolazioni" class="icon-button">${icon('close')}</button></div>
          <div class="inspector-tabs" role="tablist" aria-label="Regolazioni del cielo">${[['cloud','Nube'],['atmosphere','Atmosfera'],['measure','Misure']].map(([id,label],index)=>`<button role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${index===0}" tabindex="${index===0?0:-1}">${label}</button>`).join('')}</div>
          <div class="inspector-body">
          <section role="tabpanel" id="panel-cloud" aria-labelledby="tab-cloud">
          <label>Forma<select name="family" disabled><option value="congestus">Congesto largo</option><option value="multicell">Torri multiple</option><option value="sheared" selected>Cella inclinata</option></select></label>
          <label>Vento<input name="wind" type="range" min="0" max="100" value="55"></label>
          <label>Avvicinamento<input name="zoom" type="range" min="0" max="100" value="0"></label><small data-testid="view-distance">Panorama · rotella o +/− per avvicinarti</small>
          <label>Dispersione<input name="dispersion" type="range" min="0" max="100" value="0"></label>
          <div class="benchmark-controls"><button data-action="gust">Raffica</button><button data-action="disperse">Disperdi</button><button data-action="condense">Ricondensa</button></div>

          <button class="wide-action" data-action="new-cloud" disabled>${icon('plus')}Nuova forma</button>
          <div class="secondary-actions"><button data-action="orbit" aria-pressed="false">Orbita</button><button data-action="light">Luce da destra</button><button data-action="reset">Ricomincia</button></div>
          <p data-testid="cloud-flow-status" role="status">Correnti in preparazione…</p>
          <small>Nuova forma alterna tre famiglie e varia ogni nube. Disperdi allarga e assottiglia localmente il vapore, poi lo ricondensa. Tastiera sulla scena: frecce per ruotare, Home per ricentrare.</small>
          </section>
          <section role="tabpanel" id="panel-atmosphere" aria-labelledby="tab-atmosphere" hidden>
          <small>Rilievi: Copernicus DEM. Copertura: ESA WorldCover. <a href="terrain-data-notice.txt" target="_blank" rel="noopener">Crediti e licenze</a></small>
          <label>Paesaggio<select name="ground"><option value="1">Terra · foreste, monti e mare</option><option value="0">Solo cielo</option></select></label>
          <label>Cielo<select name="sky"><option value="clear">Limpido</option><option value="haze">Velato · più foschia</option><option value="storm" selected>Temporale · cielo neutro</option><option value="sunset">Tramonto</option><option value="rain">Pioggia</option></select></label>
          <label>Intensità della pioggia<input name="rain" type="range" min="0" max="100" value="0"></label><label>Velocità della nube<select name="speed"><option value="0.5">0,5× · osservazione lenta</option><option value="1" selected>1× · convezione</option><option value="2">2×</option><option value="4">4× · evidenzia il movimento</option></select></label>
          <label>Distanza del tuono<select name="distance"><option value="1">1 km · tuono dopo 2,9 s</option><option value="3" selected>3 km · tuono dopo 8,7 s</option><option value="8">8 km · tuono dopo 23,3 s</option></select></label>
          <div class="benchmark-controls"><button data-action="mature">Nube matura</button><button data-action="lightning">Lampo</button><button data-action="storm-auto" aria-pressed="false">Lampi automatici</button><button data-action="audio" aria-pressed="false">Attiva audio</button><button data-action="flash-preview">Isola luce del lampo</button></div>
          <p data-testid="storm-status" role="status">Lampi interni alla nube. Audio attivabile qui.</p>
          <small>La formazione è accelerata; il ritardo del tuono segue la distanza reale. Isola luce del lampo trattiene la luce per osservarla: premi Lampo o Ricomincia per tornare alla scena. Pausa o scheda nascosta interrompono i tuoni in attesa.</small>
          </section>
          <section role="tabpanel" id="panel-measure" aria-labelledby="tab-measure" hidden>
          <label>Qualità<select name="quality">${Object.entries(QUALITY).filter(([key])=>profiling||key==='ultra').map(([key,v])=>`<option value="${key}" ${key===quality?'selected':''}>${v.label}</option>`).join('')}</select></label>
          <label>Risoluzione output<select name="output"><option value="screen">Schermo · nitidezza nativa</option>${profiling?'<option value="window">Finestra · 1 pixel per pixel CSS</option><option value="720">1280 × 720</option><option value="1080">1920 × 1080</option>':''}</select></label>
          ${profiling?`<button data-action="probe-reference">Fissa stato di confronto</button><label>Lavoro interno · confronto diagnostico<select name="ablation">${[['full','Completo · qualità finale'],['density','Densità e integrazione'],['cache','Densità + lettura luce'],['no-flow','Senza lettura flusso'],['no-detail','Senza dettaglio fine'],['no-flash','Senza shading del lampo']].map(([value,label])=>`<option value="${value}" ${value===(new URLSearchParams(location.search).get('ablation')??'full')?'selected':''}>${label}</option>`).join('')}</select></label><label>Diagnostica GPU<select name="timing">${[['render','Readback rendering · compute automatico'],['stages','Rendering e flusso'],['queue','Rendering, flusso e coda'],['off','Disattivata · sola cadenza']].map(([value,label])=>`<option value="${value}" ${value===timingMode?'selected':''}>${label}</option>`).join('')}</select></label><label>Flusso di confronto<select name="flow"><option value="full" ${!frozenFlow?'selected':''}>Animato · completo</option><option value="frozen" ${frozenFlow?'selected':''}>Congelato · confronto diagnostico</option></select></label>`:''}
          ${profiling?`<label>Coda dei frame<select name="inflight"><option value="0" ${!frameLimit?'selected':''}>Invio continuo</option><option value="1" ${frameLimit===1?'selected':''}>Massimo 1 in attesa</option><option value="2" ${frameLimit===2?'selected':''}>Massimo 2 in attesa</option></select></label>`:''}
          ${profiling&&new URLSearchParams(location.search).get('terrainAudit')==='1'?'<button data-action="terrain-cache-audit" disabled>Verifica target terreno</button><label>Risultato GPU JSON<textarea data-testid="gpu-report-json" readonly rows="3" spellcheck="false" wrap="off"></textarea></label>':''}
          <p data-testid="performance-live">In attesa della GPU…</p>
          <div class="benchmark-controls"><button data-action="benchmark" disabled>Misura 30 secondi</button><button data-action="sustained" disabled>Misura 90 secondi</button><button data-action="export" disabled>Esporta JSON</button></div>
          <p data-testid="benchmark-result">Il test include 2 secondi di riscaldamento e si interrompe se cambi scena o nascondi la scheda.</p>
          <small>FPS = frame inviati per secondo di tempo reale tra callback rAF. Non certifica la presentazione del compositore. Tempi GPU separati quando disponibili. Nessuna risoluzione adattiva nascosta.</small>
          ${profiling?`<section class="frame-export" aria-label="Acquisizione PNG del canvas">
            <div class="benchmark-controls"><button data-action="frame-capture" disabled>Acquisisci PNG del canvas</button><button data-action="frame-clear">Svuota esportazione</button></div>
            <p role="status" data-testid="frame-export-status" data-state="idle">PNG e metadati dello stesso disegno. Nessun download automatico.</p>
            <small>Massimo 8.388.608 pixel e 32 MiB PNG. L'immagine mantiene le dimensioni del canvas e resta in memoria fino a Svuota. Durante l'acquisizione le misure sono indisponibili; la scena continua ad animarsi.</small>
            <div data-testid="frame-export-data" hidden>
              <a data-testid="frame-export-download" download>Scarica il PNG acquisito</a>
              <label>Metadati del PNG<textarea data-testid="frame-export-json" readonly rows="3" spellcheck="false" wrap="off"></textarea></label>
              <small>Per il trasferimento testuale, concatena le parti nell'ordine senza separatori. Il link scarica il PNG completo.</small>
              <p data-testid="frame-export-part" aria-live="polite"></p>
              <label>Parte testuale del PNG<textarea data-testid="frame-export-png" readonly rows="3" spellcheck="false" wrap="off"></textarea></label>
              <div class="benchmark-controls"><button data-action="frame-part-previous" disabled>Parte precedente</button><button data-action="frame-part-next" disabled>Parte successiva</button></div>
            </div>
          </section>`:''}
          <a href="?legacy">Apri il vecchio laboratorio</a>
          </section></div></section></details>
      </nav></div><script type="application/json" data-testid="benchmark-json"></script>`;
}
