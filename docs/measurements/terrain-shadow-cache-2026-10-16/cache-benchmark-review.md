# Lettura del benchmark v58: cache ombre e A/B/A

Revisione del solo sorgente congelato `cache-source`, 16 ottobre 2026. Nessun test, build, benchmark, browser o GPU eseguito per questa nota. Non contiene ancora un verdetto sui run A/B/A.

## Campi e momenti di acquisizione

Il report finale usa `metricsSchemaVersion: 3` e `measurementVersion: "submission-queue-prefix-v2-pass-ledger"`.

| Dato | Chiave esatta | Significato |
| --- | --- | --- |
| Cache iniziale | `terrainRaster.shadow.cache` | Snapshot all’avvio del benchmark, prima dei 2 s di warmup. Non esiste `terrainRasterStart`. |
| Cache finale | `terrainRasterEnd.shadow.cache` | Snapshot quando finisce la raccolta degli intervalli, prima dell’attesa del prefisso GPU finale. |
| Cadenza | `stats`, alias `submissionPacing`; `submissionFps === stats.fps` | Intervalli fra rAF accettate che hanno realmente inviato il draw applicativo. |
| Serie della cadenza | `frameIntervalsMs` | `stats.frames = length`; `durationMs = sum`; `fps = length * 1000 / sum`. Il primo draw dopo warmup è solo ancora temporale. |
| Completamento | `queuePrefix` | Conferma di prefissi logici immutabili tramite `onSubmittedWorkDone`, separata dalla cadenza rAF. |
| Timestamp scalari storici | `gpu`, alias `gpuRenderPassSumMs`; `gpuSamplesMs`, `gpuCompute` | Campioni sparsi dell’ultimo frame risolto; render e compute non necessariamente appaiati. |
| Timestamp con copertura | `timestampPasses` | Coppie fresche assegnate ai draw tramite frame Three e range di chiamate. Statistiche solo per draw completamente coperti. |
| Presentazione | `presentedCanvasFps: null` | Nessuna misura del compositor o dei frame effettivamente presentati. |

Riferimenti: `cache-source/src/cumulonimbus/GPUSceneEngine.ts:748–790`; `performance.ts:6–40`; `queuePrefixMeasurement.ts:23–34`.

## Interpretare la cache

I cinque campi sono `requests`, `submissions`, `hits`, `epoch`, `valid`. Sono cumulativi per questa istanza del proprietario e non vengono azzerati dal benchmark. `requests` conta le richieste dopo validazione di Sole/bounds; `submissions` conta i tentativi CPU di `renderer.render`, anche se lanciano un errore; `hits` salta clear e draw dell’ombra. `valid` indica che lo stamp CPU è stato installato dopo draw e ripristino dello stato riusciti: non certifica completamento GPU, correttezza visiva o contenuto del target.

Con Sole stabile, ground attivo e mappa già popolata, il segnale atteso è `Δsubmissions = 0`, `Δhits = Δrequests`, `valid = true`. Un `submissions: 1` assoluto può essere il draw iniziale di compilazione/popolamento, non lavoro svolto durante i 30 s. I delta comprendono warmup e ancora iniziale; non imporre `Δrequests === stats.frames`. Non comprendono gli ulteriori frame eventualmente disegnati durante l’attesa del fence finale. Il v57 A può non esporre questi contatori: non inventare un delta A pari a zero.

`epoch` cambia sulle invalidazioni esplicite/dispose/cambio riferimenti degli attachment; un cambio Sole o versione texture può produrre miss senza incremento di epoch. La chiave confronta renderer, reversed depth, Sole normalizzato, sei coordinate dei bounds, dimensioni, riferimenti/versioni dei due attachment ed epoch. La cache riguarda soltanto la shadowmap; il pass colore/distanza del terreno e il quad nube/pioggia restano eseguiti a ogni draw. Camera e colori meteorologici non sono chiavi della shadowmap.

Riferimenti: `TerrainShadow.ts:155–198,212–214`; `terrainMesh.ts:230–255`. Non attribuire il risparmio all’intera geometria/ombreggiatura del terreno e non chiamarlo correzione delle scaglie visive preesistenti.

## Controlli sui tre report

Confrontare stessa posa numerica e canvas reale, non soltanto la dimensione CSS: `camera.origin/target/yaw/pitch/approach/ground`, `output`, `internal`, `outputMode`, `devicePixelRatio`, `quality`, `nominalSteps`, `volume`, `detailVolume`. Conservare seed, terreno/cover, support bounds, `flowMode`, ablation, `emptyStepWorld`/`emptyStepWorldEnd`, modalità sampling iniziale/finale, meteo e Sole. Qualità attesa per il protocollo full: 384 passi, 256³/128³, output interno nativo, flow full, ground 1, nessuna ablazione. Verificare anche `executionThread`, backend/adapter, `profiling`, `timingMode`, `maxFramesInFlight` e `automaticComputeReadback`: cambiare questi valori cambia il carico/metodo.

Per una posa congelata: `paused`, `orbit`, `simulationTimeStart/End`, `clockStateStart/End`, pioggia assestata, `skyPending: false`, `weather.atmosphereTransition: 1`, flash start/end coerenti. Questi ultimi due controlli sky sono snapshot iniziali: non esistono `cameraEnd`, `sunDirectionEnd` o `skyPendingEnd`. L’assenza di quei campi non prova che la scena sia rimasta invariata; servono il protocollo senza interazioni e gli altri record acquisiti dal root. Cambi espliciti di stato e cielo pronto invalidano una misura ancora attiva. `skippedFrames` comprende il warmup e va letto con `maxFramesInFlight`.

A/B/A consente un confronto di cadenza nel contesto corrente. Riportare tutti e tre i risultati e la deriva A1→A2; valutare B contro entrambi i controlli secondo il gate già fissato. Non confrontare causalmente percentuali con cicli di canvas, camera, geografia o materiale diversi. Un Sole vicino al tetto rAF può non mostrare il beneficio in cadenza anche se il pass ombra è saltato. Nessuna conclusione su 60 FPS stabili da un singolo run.

## Coda: completamento non equivale a presentazione

Per la chiusura attesa: `queuePrefix.status === "completed"`, `confirmedPrefixId === measuredSubmissions === stats.frames`, `unconfirmedMeasuredFrames === 0`, campioni `start` e `end` completati; conservare eventuali campioni periodici falliti. I prefix ID escludono l’ancora iniziale come gli intervalli di `FrameMeasurement`. Un timeout/incomplete non diventa PASS perché `stats.fps` esiste.

`endDrainMs` è la latenza della notifica finale, non costo di un frame né costo ombra. `maxUnconfirmedMeasuredFrames` è un limite superiore dei draw non ancora confermati a JS, non profondità fisica della coda. `completionBoundedSubmissionFps` usa il clock locale dall’osservazione dell’ancora alla notifica finale: include backlog precedente e consegna JS. `queueCompletion` è invece la statistica storica di latenze campionate, non questo report dei prefissi.

Riferimento: `queuePrefixMeasurement.ts:3–12,25–85`; acquisizione finale in `GPUSceneEngine.ts:774–790`.

## Pass GPU: prova del meccanismo, non costi additivi

`timestampPasses.coverage.render` e `.compute` espongono `measuredDraws`, `expectedCalls`, `matchedFreshCalls`, `completeDraws`, `partialDraws`, `missingDraws`, `notRequestedDraws`, `invalidLedgerDraws`, `conflictDraws`. Controllare anche diagnostics di righe invalide/duplicate/ambigue e gli ID duplicati. Missing/partial non significano frame applicativi non inviati e non vanno riempiti con zeri; la cattura è sparsa e non attende un ultimo readback. Solo `completeSamples.*` entra in `statistics.*`.

`expectedCalls` deriva dai contatori prima/dopo ciascun draw: il candidato può avere meno chiamate perché non fa clear/draw ombra. Non imporre a B un numero di pass copiato da A. La riduzione di chiamate insieme ai delta cache dimostra il meccanismo osservato, non i millisecondi esclusivi risparmiati.

`passSumMs` è una somma di intervalli restituiti, senza garanzia che siano disgiunti. La copertura fresca non dimostra esclusività temporale o parallelismo hardware. Non sommare render+compute, non invertire `gpu` per ricavare FPS e non attribuire al terreno/ombra la differenza di queste somme. Per l’adozione prestazionale usare la cadenza A/B/A qualificata e la conferma dei prefissi; tenere i timestamp come osservazione con copertura e con questo limite.

Riferimenti: `GPUSceneEngine.ts:495–549`; `timestampBatchMeasurement.ts:7–29,128–166`.
