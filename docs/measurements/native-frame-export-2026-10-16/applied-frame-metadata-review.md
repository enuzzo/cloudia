# PNG: DTO del frame applicato — review read-only v56

16 ottobre 2026. Riferimenti di riga relativi a `src/cumulonimbus/GPUSceneEngine.ts` letto prima del wiring PNG. Nessun prodotto modificato; nessun test, bake, GPU, browser o build. Il root è l’unico writer dell’engine/protocollo.

## Tre accoppiamenti da descrivere, senza correggerli dentro la feature PNG

1. **PrecipitationTime è un frame di forcing indietro in moto.** `frame:435` chiama `advanceAtmosphere(dt)`; questa copia `forcingTime` in `precipitationTime.value` a578. Solo dopo, `frame:436` incrementa il forcing CPU e437–438 applicano la nuova dispersione. Nel draw successivo la pioggia usa dunque `forcingTime_before`, mentre dispersione e raffica usano `forcingTime_after`. Differenza uguale a weatherDelta del frame, nulla in pausa. È un disallineamento temporale reale del codice, non un bug di pausa; il PNG deve **registrare entrambi**. Spostare l’assegnazione ora cambierebbe il renderer oltre lo scope diagnostico.
2. **FlowTime uniforme non identifica la texture frozen.** `updateEvolution:621` imposta flowTime al simulationTime corrente, anche in frozen; `frame:488` però non esegue il compute. Il campo frozen deriva dal compute iniziale a298, dopo `frozenMotionState` salvato a293. DTO: tempo uniforme corrente separato dal tempo/dispersione del campo memorizzato; usare `frozenMotionState.time/dispersion` per il secondo, non simulationTime né flowTime corrente. Se il dato salvato manca, dichiarare null/unknown, non inventare un tempo.
3. **Intenzione cielo/lato non significa illuminazione corrente.** `atmosphere:583` modifica subito skyMode/side e avvia una richiesta; `updateAtmosphere:542–545` installa il risultato soltanto quando arriva. `applySky:551–568` conserva uno snapshot dello stato visibile e prepara le texture/target. `advanceAtmosphere:572–577` applica blend, direzione, colori e weather interpolati. Esportare skyMode/side soltanto come intent; i valori applicati sono le uniformi sun, solarColor, ambientColor, lightSide, sunsetAmount, atmosphereBlend e weather, più identità/versioni delle due LUT e skyPending.

## Ordine effettivo del frame accettato

| Righe | Operazioni / valore che arriva al draw |
|---|---|
|421–427|Rifiuto destroyed/loss/invisible/renderer o quad assenti; scheduling rAF; eventuale frame saltato per inflight; applicazione dirtySize. **Non catturare un frame saltato.**|
|428–433|Calcolo interval; simulationTime avanza con `min(dt,.05)*speed` solo se non paused. weatherTime avanza col dt reale non negativo anche in pausa.|
|435–438|Atmosfera e rain amount avanzano col dt reale; precipitation uniform copia il forcing precedente; forcing CPU avanza col dt reale solo fuori pausa; dispersal e forcing uniform usano il nuovo forcing.|
|440–445|Wind effettivo include raffica e tempo simulation; updateStorm applica flash su weatherTime; updateEvolution imposta inverse growth/emptyStep/flowTime; drift applicato.|
|446–484|Eventuale target fisso, orbita e probe; origin calcolata e clamp terreno; basis forward/right/up ricostruita dopo il clamp. Queste uniformi, non la sola coppia yaw/pitch, definiscono la vista.|
|488|Compute del campo16³ soltanto se non frozen. Input reali a186–190: flowTime, seedPhase, flowFamily, forcing.x e iceRange.|
|490–491|renderTerrain usa camera/sole applicati, poi quad.render disegna il canvas. **Punto proposto per DTO sincrono + invocazione snapshot PNG**, senza await intermedio.|
|492–537|Ledger/misura, completamento benchmark, UI e richieste async timestamp/queue. Non ricavare da questi la foto o un ID di presentazione.|

I clock non hanno lo stesso significato: simulation è accelerato/scalato/cappato, forcing è tempo reale non scalato ma fermo in pausa, weather avanza anche in pausa. `WeatherState.step` limita il proprio dt a1s, mentre atmosphereProgress usa dt/2.4: un solo campo “tempo” non descrive queste trasformazioni.

## DTO minimo proposto

Niente copia del report benchmark precedente. L’engine costruisce un plain object appena dopo491, nello stesso task prima della chiamata PNG e di qualsiasi await. Copiare array/scalari, senza Vector o riferimenti mutabili. Il risultato deve restare quello del draw anche se lo stato UI cambia durante l’encoding.

```ts
type AppliedFrameMetadataV1 = {
  schema: 'cloudia-applied-frame-v1';
  captureId: number;
  rendererVersion: string;
  thread: 'main'|'worker';
  capturedAt: { isoUTC:string; rafTimestampMs:number;
    localSnapshotMs:number; timeOriginMs:number };
  seed: number;
  quality: { name:string; nominalSteps:number; macroSize:number; detailSize:number;
    outputMode:string; output:[number,number]; internal:[number,number];
    canvas:[number,number]; viewportCSS:[number,number]; dpr:number };
  camera: { origin:number[]; target:number[]; forward:number[]; right:number[]; up:number[];
    aspect:number; tanFov:number; inspection:number; ground:number;
    yaw:number; pitch:number; approach:number; orbit:boolean;
    comparisonSurfaceKm:number|null; comparisonTargetKm:number[]|null };
  cpuClocks: { simulationTime:number; forcingTime:number; weatherTime:number;
    paused:boolean; speed:number };
  applied: { precipitationTime:number; flowTimeUniform:number;
    growth:number[]; drift:number[]; wind:number[]; forcing:number[];
    iceRange:number[]; stepSize:number; emptyStep:number; resolution:number[];
    weather:number[]; atmosphereBlend:number; sun:number[];
    solarColor:number[]; ambientColor:number[]; lightSide:number; sunsetAmount:number;
    flash:number[]; flashTop:number[]; flashBend:number[]; flashEnd:number[]; flashBranch:number[] };
  flowTexture: { mode:'full'|'frozen'; sampled:boolean; computeThisDraw:boolean;
    writtenTime:number|null; writtenDispersion:number|null;
    family:number; seedPhase:number; iceRange:number[] };
  sky: { intent:string; requestedSide:number; pending:boolean; requestSerial:number;
    progressCPU:number; fromTextureId:string; fromTextureVersion:number;
    toTextureId:string; toTextureVersion:number };
  path: { diagnosticName:string; diagnosticCode:number; narrow:boolean; densityR8:boolean };
};
```

### Origine precisa dei campi applicati

- **Dimensioni/pass:** output/internal e quality115–121; canvas.width/height dell’owner; viewport100; applySize623–640 aggiorna resolution/aspect/stepSize. Leggere `stepSize.value`, non ricostruirlo dal nome della qualità. dirtySize viene risolto prima del draw anche se qualità128→384 conserva dimensioni uguali.
- **Camera:** origin/forward/right/up481–484; target=viewFocus; aspect/resolution/inspection sono gli stessi nodi passati al materiale a333–335; tanFov è la costante.2867 usata anche nel raster terreno323. yaw/pitch/orbit sono contesto autoriale, non sostituiscono basis/origin effettivi; autoYaw può muovere la camera.
- **Clocks e deformazione:** cpuClocks contiene i valori CPU con semantica esplicita; applied contiene `precipitationTime.value`, `flowTime.value`, `growth/drift/wind/forcing/iceRange.value`. Forcing.y vale0 nel codice corrente ma va copiato se presente. Non dedurre wind dalla sola percentuale: raffica e oscillazioni modificano il vettore442.
- **Flow:** full → writtenTime=flowTime.value e writtenDispersion=forcing.value.x del compute488; frozen → tempo/dispersione del `frozenMotionState`293, dato il contratto install/update attuale. family/seedPhase/iceRange vengono impostati per il volume installato e non cambiano fino al successivo seed. `sampled = diagnostic.value !== 3`; in no-flow la texture può essere aggiornata ma non contribuisce al frammento. `currentFlow.version` non è un contatore delle scritture compute e non deve essere presentato come hash del campo.
- **Weather/sky/sun:** copiare i nodi realmente passati a333–335. weather.value è `[haze,overcast,rain]`, distinto da scene/targetRain. Uniforme atmosphereBlend è b smussato572, progressCPU è t lineare: non confonderli. requestedSide è side; lato applicato è lightSide.value. sun è il vettore interpolato575. Texture UUID/version identificano gli oggetti/upload dichiarati, **non** sono hash dei loro pixel. Se si volesse un digest LUT per ripetibilità più forte, occorre copiare `skyPacked/skyFromPacked` (half effettivi) nello stesso task e hashare quelle copie; non è necessario al DTO minimo, che non promette replay completo.
- **Flash:** posizione/intensità e canale sono uniformi aggiornate a597–612; il solo flashSerial o autoLightning non descrive il draw. Copiare i valori numerici anche se intensity0; il flag non basta per il preview.
- **Specializzazioni:** integratorUsesNarrow e integratorUsesDensityR8 sono le scelte installate342. Non dedurle da skyMode: il targetRain può attivare la firma rain prima che weather.z superi.001; viceversa un residuo mantiene la firma rain. Nome diagnostico richiesto e codice numerico applicato possono differire per input non riconosciuto: registrare entrambi.

**Precisione:** `.value` è un numero JS, poi i buffer uniform f32 lo quantizzano. Per chiamare il blocco “applied f32 inputs”, esportare `Math.fround` dei relativi scalari/componenti; conservare i clock CPU separati come binary64. È una ricostruzione dell’input uniform, non un readback delle operazioni GPU/FMA o della texture half. In alternativa conservare i JS originali ma chiamarli chiaramente “submitted CPU uniform values”, evitando una falsa promessa di bit GPU. Non arrotondare a poche cifre per leggibilità.

## Gate minimi dell’engine

Verificare alla richiesta e nuovamente al punto snapshot:

```text
profiling
&& ready && renderer && quad && device
&& !regenerating && visible
&& !destroyed && !deviceLost && !releasingGPU
&& !collecting && !benchmarkCompletion
&& noOtherPhysicalExportInFlight
```

`collecting = measurement && !measurement.result && !measurement.cancelReason` come721–723. **Non usare `measurement !== null`**: dopo una misura conclusa il vecchio oggetto può restare valorizzato e impedire per sempre l’export. `benchmarkCompletion`111/698–719 deve invece bloccare l’acquisizione anche quando la raccolta è già terminata ma il prefisso finale è ancora in chiusura. Il nuovo startBenchmark deve simmetricamente rifiutare un export fisico in corso, non affidarsi soltanto ai bottoni.

Il frame ordinario422 non controlla ready/regenerating: continua a poter disegnare il vecchio volume durante una generazione, mentre `seed` è già cambiato a352. Questo è un motivo concreto per il gate export separato; **non esportare quella combinazione come nuovo seed pronto**. `regenerating` diventa false a356 prima del drain/swap, quindi da solo non basta: ready resta false fino all’installazione e alla ripartenza362. In avvio ready diventa true solo dopo il controllo shader255–256.

Per visibility/loss/teardown: hidden cancella il rAF794; il device lost mette ready=false e annulla i frame225; destroy815 fa lo stesso. Cancellare la richiesta non ancora acquisita e invalidare il token dell’encoder; una callback tardiva non deve pubblicare un frame di un’istanza chiusa o usare un eventuale fallback last-presented dopo perdita del device. Non bloccare il rilascio GPU aspettando indefinitamente l’encoder.

**SkyPending non è un gate obbligatorio della capability:** si può voler catturare una transizione. In quel caso il DTO deve dichiararla correttamente. Per qualificare una posa “settled”, il consumer deve controllare pending/progress/blend e rain applicato contro l’intenzione, non leggere soltanto il titolo Pioggia/Sole. Non imporre nuovi epsilon o aspettare in silenzio per cambiare il fotogramma richiesto.

## Protocollo ed esito

`renderProtocol.ts` attuale ha solo eventi state/view/report e comandi action/change; nessuno trasporta il frame applicato. Usare il nuovo comando/evento PNG tipizzato con requestId/captureId e **DTO costruito nell’owner**, non ricostruito nel main dal DOM. Nel worker il timestamp rAF/timeOrigin appartiene al worker: registrarli con thread, senza etichettarli come istante del compositore.

Conclusione: gli accoppiamenti osservati non impediscono uno snapshot corretto, purché il DTO descriva le uniformi applicate e il campo frozen reale. Il lag forcing/precipitation è documentabile come tale e va lasciato fuori dal fix PNG. Un solo “time=60”, un solo “sun=left” o un report benchmark passato non bastano per dimostrare che una PNG appartenga al draw dichiarato.
