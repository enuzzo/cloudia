# Audit della semantica FPS · cycle8

Audit indipendente in sola lettura; sorgenti locali Three 0.186.0. Nessun benchmark, browser, build o modifica al prodotto. Generato: 2026-10-15T22:02:10.644770+00:00.

**Conclusione:** i report attuali misurano bene la cadenza delle submission accettate dal ciclo rAF, ma non misurano la frequenza reale delle nuove immagini del canvas presentate sul display. Il valore GPU è la media di somme di intervalli dei pass, campionate sparsamente: non è il reciproco degli FPS né una misura del backlog. I casi GPU~280 ms/rAF~7 e GPU~29 ms/rAF~60 non sono quindi contraddizioni matematiche.

## Cosa misura ogni campo

| Campo | Semantica verificata | Limite |
|---|---|---|
| `stats.fps` | Numero di intervalli accettati ×1000 / somma degli intervalli rAF; non media di FPS istantanei. | Render inviato, non GPU finita o presentazione. Il primo callback è solo l'estremo iniziale. |
| `stats.p95Ms/p99Ms`, `over18Ms` | Pacing delle submission accettate. | Proxy della fluidità; non osserva immagini ripetute dal compositor. |
| `gpu.meanMs` | Media degli ultimi frame restituiti dalle risoluzioni Three; ciascuno è la somma di end−start di tutti i render pass con lo stesso ID Three. | Campioni sparsi, non una media di tutti i frame; non envelope temporale e non critical path. |
| `gpuCompute` | Analogo aggregato compute di un pool distinto. | ID non esportati: non è verificabile l'abbinamento con render/rAF. Non sommare medie o p95 per ricavare il frame totale. |
| `cpu`, `cpuCompute`, `cpuRender` | Tempo JS di aggiornamento/preparazione e chiamate di submission. | `cpu` termina prima di UI metrics, risoluzione timestamp e registrazione fence: non è l'intero callback né attesa GPU. |
| `rafDispatch` | `max(0, performance.now() al callback − timestamp rAF)`. | Ritardo rispetto al timestamp rAF, non latenza input→presentazione. |
| `queueCompletion` | Tempo JS fra richiesta `onSubmittedWorkDone` e relativa callback. | Include il prefisso di lavoro già in coda e consegna JS; non isola un frame né la presentazione. |

Riferimenti locali: `performance.ts:6–43`; `GPUSceneEngine.ts:336–435`, `549–578`.

## Perché il numero GPU può superare il periodo rAF

- In `WebGPUTimestampQueryPool.js:174–219`, Three raggruppa gli UID per `:f<ID>`, somma le durate e restituisce **solo l'ultimo frame del batch**. Non somma tutti i frame del batch e non calcola una media batch. La conversione ns→ms divide correttamente per 1e6.
- Con i default attuali (output sRGB, working color space lineare), `Renderer._getFrameBufferTarget()` e `_renderOutput()` producono un pass nube e un pass finale di conversione colore. Entrambi entrano nella somma render. È un fatto del percorso sorgente, non un conteggio live raccolto in questo audit.
- L'overlap/pipelining e le semantiche hardware dei timestamp possono rendere la somma degli intervalli superiore al tempo utile fra due immagini. Questo rende plausibile un rapporto vicino a 2, **senza dimostrare che sia la causa specifica dei report**. Il costo del pass di conversione non va assunto nullo né il rapporto diviso automaticamente per due.
- Un'altra spiegazione possibile è che il thread invii lavoro prima del completamento GPU, accumulando coda. Il rAF non attende il risultato e i report in modalità `stages` senza limite non dimostrano l'assenza di backlog. Le due spiegazioni possono coesistere.
- I timestamp WebGPU hanno determinazione/precisione dipendente dall'implementazione. Neppure un envelope costruito sottraendo timestamp appartenenti a submit diversi va assunto portabile: la discussione primaria [GPUWeb: garanzie dei timestamp](https://github.com/gpuweb/gpuweb/issues/4361) segnala i limiti di comparabilità. Riferimento normativo: [WebGPU, Timestamp Query](https://www.w3.org/TR/webgpu/#timestamp).

## Campionamento, finestra e coda

- La risoluzione è richiesta dopo il render, non prima di 200 ms dalla precedente richiesta, e soltanto senza una risoluzione pendente. I 200 ms sono un minimo, non una frequenza garantita di 5 Hz: il readback lento riduce la frequenza campionata.
- Il pool restituisce `lastValue` se vuoto o se la risoluzione fallisce internamente; l'engine non esporta ID/freschezza. Un valore ripetuto non dimostra di per sé un nuovo campione GPU. Non è dimostrato che questo sia avvenuto nei run osservati.
- Il filtro warmup usa l'istante JS della richiesta asincrona. Non identifica il preciso intervallo di esecuzione GPU. I risultati che arrivano dopo la chiusura della misura vengono scartati: possibile censura dei campioni lenti finali.
- Three usa un rAF interno anche quando l'app usa un proprio rAF; quello interno aggiorna `info.frame` e resetta i contatori. Il raggruppamento GPU segue quell'ID, non un ID esplicito dell'app. Esportare gli ID permetterebbe di controllare l'abbinamento.
- Con `inflight=1/2`, il callback pianifica il successivo rAF e poi può uscire prima di aggiornare `previous`/registrare il frame. Perciò gli intervalli misurano le submission ammesse, incorporando i callback saltati. `skippedFrames` include il warmup, come già dichiarato nel report.
- `framesInFlight` conta promesse fence non ancora consegnate al JS, non immagini in attesa del compositor. Il fence in questa posizione può includere anche i comandi diagnostici di risoluzione timestamp appena inviati.
- Senza limite (`maxFramesInFlight=null`) non viene tracciata la profondità della coda. `timing=queue` osserva un prefisso ogni almeno 500 ms, con una sola richiesta pendente; `stages` non raccoglie questi dati.
- `timing=render` evita il resolve compute esplicito, ma con `trackTimestamp` attivo Three continua ad allocare query compute: a pool pieno (1024 pass) avvia un resolve automatico. Non equivale a disattivare completamente i timestamp compute. `timing=off` li disattiva.
- `startBenchmark` non svuota la coda; due secondi di warmup non sono una prova di stabilizzazione. La fine misura non attende un fence finale. Il report conserva snapshot iniziale di camera/stato, non uno storico.

La [specifica WebGPU sulla coda](https://www.w3.org/TR/webgpu/#dom-gpuqueue-onsubmittedworkdone) distingue il completamento del lavoro inviato dalla presentazione. La documentazione [Three Renderer](https://threejs.org/docs/pages/Renderer.html) conferma il pass di conversione e raccomanda `setAnimationLoop`; qui non propongo una migrazione del loop come presunto fix del costo GPU.

## Criteri proposti per dichiarare 60 FPS

Sono criteri di accettazione proposti, non risultati già ottenuti. Devono riportare hardware/browser, frequenza display, viewport CSS, DPR, buffer reale, qualità/passaggi, seed, camera, meteo e clock/animazione.

1. **Media reale di presentazione:** almeno 59,5 nuove immagini renderizzate del canvas presentate/s per 90 s su display nominale 60 Hz. Occorre una fonte del browser/compositor che distingua nuove immagini del canvas da refresh ripetuti. Con i report correnti questo criterio è **NON MISURATO**, anche se `stats.fps≈60`. Un trace di presentazione richiede un percorso autorizzato e non viene sostituito da rAF o fence.
2. **Pacing:** sulla stessa sequenza presentata, p95≤18 ms e non più dell'1% di intervalli>18 ms; mostrare anche p99/max e stall>33,34 ms. Fino a disponibilità della presentazione, applicare tali numeri ai rAF soltanto con etichetta esplicita «pacing delle submission». `over33Ms` da solo è insufficiente: un intervallo da33,3 ms ha già perso un refresh a60Hz ma può rimanere sotto33,34.
3. **Sostenibilità/backlog:** almeno59,5 frame/s completati nel tempo sostenuto, senza crescita della coda/età dei frame. Conservare conteggi submission/completamento e latenza di drain finale; non dedurli dalla somma timestamp. L'eventuale budget di latenza massimo va dichiarato separatamente dagli FPS.
4. **Qualità e ripetibilità:** identica immagine/risoluzione/qualità, scena animata oltre alle pose congelate, prova prolungata e ripetizioni coerenti. Il passaggio di un criterio medio non annulla pacing o backlog falliti. I timestamp GPU restano diagnostici, senza obbligo automatico `gpu.meanMs<16,67` per questa specifica metrica Three.

## Strumentazione minima da valutare successivamente

- Aggiungere contatori separati `rafCallbacks`, `renderSubmissions`, `skippedCallbacks` e ID app monotono; delimitare anche questi al periodo misurato.
- Rendere noto il prefisso completato: fence iniziale dopo warmup per una coda iniziale nota, marker non bloccanti periodici associati all'ultimo ID inviato, fence finale associato all'ultimo ID misurato. Registrare istanti richiesta/consegna, ID coperti e `endDrainMs`. Non chiamare queste callback «presentazione».
- Esportare per campione GPU: ID Three render/compute, UID/pass count, ID app associato, istante richiesta/risoluzione e freshness/error status. Conservare i pass separati; se gli ID differiscono, non abbinarli implicitamente.
- Etichette trasparenti: `submissionFps`, `submissionPacing`, `gpuRenderPassSumMs`, `queuePrefixCompletionMs`, `presentedCanvasFps:null` finché non misurato. La vecchia serie resta confrontabile solo con la stessa semantica/versione.
- Il primo passo pratico è osservare ID/numero pass e backlog, senza cambiare shader, risoluzione, materiale o algoritmo. Un limite inflight2 è utile come diagnosi separata ma modifica il pacing e non deve essere spacciato per misura identica al percorso illimitato.

## Snapshot delle sorgenti lette

- `src/cumulonimbus/performance.ts`: `175e4be041d8bf2cf325e6ba4e09922b5a1be79c34d5bc4b4f704230ca01a7e8`
- `src/cumulonimbus/GPUSceneEngine.ts`: `fb9c8b418f9c9c3f20abc4eea9c2b58fec5bd4a1cd9827ba91187eb7648eab83`
- `node_modules/three/src/renderers/common/Backend.js`: `9b3e452debbfc9a4675434da00178e09cdc1270f7e5d06f920e8be559f36e628`
- `node_modules/three/src/renderers/common/Renderer.js`: `acf70db96a38c66cd113e20e2195a9c55ea7c51a5c8f114fea7f7a02e099cd6a`
- `node_modules/three/src/renderers/common/Animation.js`: `36bd55bd835bc6eac718cfdb781972e14d428436c8c95aa0a43b35c991ffcd18`
- `node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js`: `719c23dab1783a752b5c454f2564d39a28638e191aa4078cc82cfc1b968c0dfb`
