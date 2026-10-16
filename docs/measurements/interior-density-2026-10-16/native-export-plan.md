# PNG nativo intenzionale — piano minimo, non implementato

16 ottobre 2026. Sola lettura del checkout v56 `a8653c53ba617e7dd8ba56c868d28b7c3d4c5234`. Nessun browser, GPU, build, test o modifica prodotto. È una capability per verificare le immagini, non una correzione di nube/pioggia né una misura del compositore.

## Scelta consigliata

🌟 Aggiungere soltanto in `?profile=1` il pulsante **“Acquisisci PNG del canvas”** nel pannello Misure. Il click invia una richiesta tipizzata all’engine; il proprietario del canvas acquisisce bitmap e metadati **nello stesso frame appena renderizzato**. Il PNG resta in memoria e viene esposto intenzionalmente insieme ai metadati. Nessun download automatico, upload, URL HTTP nuovo o lettura dell’engine attraverso CUA.

Preferisco `HTMLCanvasElement.toBlob(...,'image/png')` al `toDataURL()` diretto: il risultato Blob permette di controllare i byte prima di creare una grande stringa base64. Nel worker usare `OffscreenCanvas.convertToBlob({type:'image/png'})`. La serializzazione PNG è lossless del bitmap esportato; non esporta i coefficienti Float32/HDR originali. Non usare un canvas2D intermedio, resize o JPEG.

## Punti di integrazione reali

| File attuale | Integrazione proposta |
|---|---|
| `sceneMarkup.ts`, sezione Misure e blocchi `profiling` | Pulsante, stato `role=status`, due textarea readonly etichettate e pulsante “Svuota esportazione”. Tutto assente fuori profile. |
| `CumulonimbusApp.ts` | Gestisce il click tramite il normale `send`; pubblica solo l’evento della richiesta corrente. Espone JSON metadati in `data-testid=frame-export-json` e il PNG data URL in `data-testid=frame-export-png`. Non legge proprietà private dell’engine per costruire il report. |
| `renderProtocol.ts` e `render.worker.ts` | Comando dedicato `{type:'frameExport',requestId}` e cancellazione/clear della richiesta; eventi pending/ready/error con lo stesso ID. Un Blob PNG può essere structured-cloned dal worker; nessun ImageBitmap o texture da trasferire. |
| `GPUSceneEngine.ts:423–491` | Una richiesta pendente viene consumata sul prossimo frame accettato, dopo `dirtySize/applySize`, camera/clamp, compute, terrain e `quad.render`. Snapshot dei valori realmente applicati, quindi chiamata immediata all’API PNG **prima di qualsiasi await**. |
| Nuovo `nativeFrameExport.ts` + test mirati | Helper piccolo per dimensioni/limiti, snapshot PNG main/Offscreen, controlli Blob/PNG e token delle callback. Nessun import Three o renderer interno necessario. |

Il pattern esiste già: App→RenderCommand→engine/worker e RenderEvent→DOM. L’attuale export JSON a `CumulonimbusApp.ts:155` clicca un link download: non riutilizzarlo per questa capability. Il report benchmark è una misura precedente e **non deve essere riciclato come metadati della foto**.

API proposta, senza dipendere da uno shader o da Three interno:

```ts
type NativeFrameCapture = {
  requestId: number;
  metadata: NativeFrameMetadata; // plain DTO costruito dall’engine dopo il draw
  png: Blob;
};

// La chiamata avvia lo snapshot prima di restituire la Promise.
function snapshotCanvasPNG(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  limits: {maxPixels:number; maxPngBytes:number}
): Promise<Blob>;
```

L’engine verifica `profiling && ready && !regenerating && visible && !deviceLost`, assenza di altra esportazione e assenza di benchmark attivo/in chiusura. Non annulla di nascosto una misura per esportare: restituisce “Termina la misura prima di acquisire il PNG”. Durante l’esportazione il benchmark è disabilitato anche lato engine. Il normale rendering può continuare: il bitmap viene copiato all’invocazione, mentre encoding/hash base64 terminano dopo. Non serve fermare/riprendere automaticamente animazione o orbitare: il DTO registra il frame effettivo. Per confronti riproducibili la UI può raccomandare Pausa, senza imporla o cambiare lo stato.

Pseudocodice dell’unico punto di acquisizione:

```text
renderTerrain(); quad.render(renderer);
if (frameExportPending) {
  consume request; metadata = cloneAppliedFrameState();
  pngPromise = snapshotCanvasPNG(host.canvas, limits); // nessun await prima
  pngPromise.then(validateBlobAndHash).then(publishIfRequestStillCurrent)
            .catch(publishErrorIfCurrent).finally(releasePhysicalSlot);
}
```

Non chiamare `queue.onSubmittedWorkDone()` prima dello snapshot né acquisire un altro `getCurrentTexture()`: non sono necessari per il contratto di serializzazione e introdurrebbero una finestra in cui stato e immagine possono divergere. Non lanciare un secondo render con clock/flow aggiornati soltanto per l’export. La richiesta attende il prossimo draw ordinario realmente completato dal lato CPU, anche se il frame limit ne salta alcuni.

## Metadati separati, riferiti al draw

`frame-export-json` contiene uno schema piccolo con stato, requestId/captureId, PNG MIME/byteLength/SHA256/dimensioni e il DTO. Il data URL sta nella seconda textarea; non duplicarlo nel JSON. Per l’archivio si salvano un `.png` e un `.json` separati con lo stesso captureId. Nessuna immagine è codificata nei messaggi testuali delle metriche.

DTO minimo utile:

- Versione renderer, Three186, thread main/worker, seed/famiglia, flag ready, ablation, qualità e nominalSteps, macro/detail, flow mode, specializzazione rain/dry e percorso R8 effettivi.
- Canvas width/height reali, output/internal, outputMode, viewport CSS e DPR applicati. Un PNG1920×1080 di output fisso è nativo **di quel bitmap**, non dello schermo2474×1844. Non usare il solo nome “Schermo” come prova.
- Camera post-clamp: origin, target, forward/right/up, yaw/pitch/approach, aspect/tanFov, comparisonSurface/Target e stima/probe eventuale; ground e dati geografici identificativi.
- simulationTime, paused/orbit, weatherTime, forcingTime **e precipitationTime uniform effettivo**, flowTime effettivo, growth/drift/wind/forcing, quantità rain, cielo, atmosferaBlend/skyPending, direzione e colori luce/sunset/side, flash effettivo. Copie numeriche, non riferimenti Vector mutabili.
- Timestamp del callback rAF che ha disegnato e tempo locale di snapshot con timeOrigin. Eventuale Three info.frame è solo un contatore diagnostico: non un ID di presentazione o frame-time.

È essenziale leggere i valori uniform effettivi: nel frame attuale `advanceAtmosphere()` precede l’incremento di forcingTime; in moto il solo valore CPU “corrente” non descrive necessariamente lo stesso tempo dell’uniforme precipitazione. Il DTO deve distinguere i due, come già fanno i metadati del benchmark. `dirtySize` è applicato dal frame prima del draw: copre anche il cambio qualità128→384 con la stessa scala1 che una verifica delle sole dimensioni non rileverebbe.

## Stato, limiti e cleanup

Una sola esportazione fisica in corso e un solo risultato conservato. Limiti iniziali espliciti proposti: **8.388.608 pixel**, **32MiB PNG**, timeout logico20s. Coprono la posa2474×1844 e il4K standard; sopra il limite si rifiuta con dimensioni/errore leggibili, **senza ridurre l’immagine**. Dopo Blob.size si genera base64 una volta; limite coerente della stringa≈44,74milioni di caratteri. La memoria di bitmap, Blob, base64, DOM e preview può superare largamente la dimensione PNG: non chiamarla gratuita o adatta automaticamente al mobile.

Il timeout non può interrompere un readback sincrono che blocca il main, né cancellare realmente l’encoder nativo. Dopo timeout/clear il token rende impossibile pubblicare una callback tardiva; la singola slot fisica resta occupata fino alla conclusione dell’encoder. Nessun retry automatico o possibilità di accumulare encoder “zombie”. Se non termina, errore esplicito e nuova acquisizione indisponibile fino alla ricreazione della scena.

“Svuota” cancella textarea/Blob/dataURL e revoca l’eventuale preview URL; incrementa il token. Nuova richiesta sostituisce il risultato precedente soltanto quando consentita. Destroy/device loss/hidden durante attesa/nuovo volume invalidano le richieste non ancora acquisite; gli eventi tardivi non pubblicano nulla. Per una foto già acquisita il DTO resta quello originario anche se la UI viene poi ruotata: lo stato corrente non lo sovrascrive.

Non eseguire base64/hash/preview nel percorso ordinario senza richiesta. Nessun file viene persistito automaticamente. Il clear deve eliminare anche i riferimenti JS, non soltanto nascondere il pannello. Sia MIME, dimensioni nonzero, firma/IHDR PNG e limiti devono essere controllati prima di dichiarare ready; non trattare callback Blob null, `data:,`, SecurityError o encoding failure come immagine valida.

## WebGPU: cosa è garantito e cosa va provato

La [specifica WebGPU attuale, snapshot del contesto](https://gpuweb.github.io/gpuweb/#abstract-opdef-get-a-copy-of-the-image-contents-of-a-context) richiede di completare le scritture inviate nell’immagine e copiarne il drawingBuffer, applicando alphaMode e tag colore/toneMapping. **La scadenza di currentTexture non distrugge il drawingBuffer**: le vecchie issue che descrivono sempre un canvas vuoto dopo present non sono una base attuale. Configurazione assente, resize e device loss restano casi distinti; dopo device loss può persino essere restituita una vecchia immagine. Per questo il flag engine è un gate necessario, non basta che la PNG sia decodificabile. Fonte consultata anche nel [sorgente ufficiale della specifica](https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs), algoritmi13689–13731 e13763–13824.

[WHATWG Canvas](https://html.spec.whatwg.org/dev/canvas.html) distingue dimensioni del bitmap e dimensioni CSS, definisce PNG/toBlob e convertToBlob. Nel worker l’owner è l’OffscreenCanvas: il canvas DOM è un placeholder aggiornato sul suo ciclo e leggerlo dal main non garantirebbe il match con i metadati del worker. `transferToImageBitmap()` sostituisce il contenuto con un’immagine vuota: non serve per questa feature. [MDN toDataURL](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL) segnala inoltre il costo della stringa in memoria; motiva Blob prima di base64.

La configurazione locale Three186 usa WebGPU canvas con RENDER_ATTACHMENT|COPY_SRC, alphaMode derivato da `parameters.alpha` e toneMapping standard salvo output HalfFloat (`WebGPUBackend.js:354–367`). Renderer ha outputColorSpace sRGB e NoToneMapping di default, mentre il film autoriale è nello shader. Registrare i valori effettivi disponibili/configurazione del contesto, senza cambiare colore o alpha per far riuscire l’export. La PNG è l’immagine canvas esportabile, senza UI/CSS/composizione di pagina e senza garanzia di equivalenza bit al buffer RGBA32F del witness o ai pixel fisici del monitor.

## Compatibilità con l’uso CUA e qualifica minima

È un comando UI esplicito, visibile e descritto, che esporta soltanto il canvas della scena autorizzata. La lettura automatizzata si limita ai due controlli readonly intenzionali e allo stato; nessun accesso a engine privato, variabili globali, storage nascosto o backend. Non è un’alternativa occulta al tool screenshot: è una nuova capability dell’app da qualificare. Il codice prodotto non dipende da CUA o da uno specifico ambiente di automazione.

Una PNG/base64 grande può essere troncata dal trasporto DOM del tool. Non presumere che il semplice `data-testid` risolva il limite: provare prima il round-trip di una piccola PNG e poi la posa nativa, confrontando byteLength/SHA/IHDR. Se il trasporto non consente di recuperare il valore completo, **non** salvare un’immagine parziale: fermare la qualifica; eventuale navigazione esplicita di chunk nel pannello va progettata come capability visibile separata, non lettura di stato nascosto.

Test mirati proposti: feature assente fuori profile; richiesta busy/benchmark rifiutata; snapshot metadati immutabile durante encoding; callback tardiva dopo clear/destroy ignorata; Blob null/error/limiti; ordine draw→snapshot; cambio qualità con dirtySize; worker ownership/event ID. Guardie reali, eseguite dal root: main e worker PNG con IHDR esatto, diverse pose producono contenuti diversi con metadati corretti, resize catturato al primo draw applicato, nessun errore console/GPU, PNG contro riferimento visuale nello stesso stato. Nessun benchmark durante il readback/encoding. Questi test non certificano il modello della pioggia.

## Esito del piano

Capacità piccola e implementabile con il protocollo esistente, senza nuovi pass GPU o risorse persistenti. Il requisito decisivo è **posizionare lo snapshot nell’owner del frame e congelare il DTO allo stesso draw**, non chiamare toDataURL dal click usando il report benchmark precedente. Prima di considerarla una nuova evidenza nativa occorre la qualifica GPU/trasporto effettiva; questa nota non la anticipa.
