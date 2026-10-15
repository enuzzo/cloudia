# Review del ledger reale main — 16 ottobre 2026

Esaminati [main-sun-30s.json](main-sun-30s.json) e il wiring attuale di `GPUSceneEngine.ts`, `three186TimestampBatch.ts` e `timestampBatchMeasurement.ts`, in sola lettura. Nessun nuovo test, bake, benchmark o accesso GPU. Non emerge un errore di associazione nel report; le esclusioni hanno una spiegazione verificabile.

La misura è **main, profiling, Sole, pausa a t=60**, camera di confronto fissa, output pieno 2560×1440 e 384 passi. Non rappresenta il precedente run ordinario di 90 s con movimento.

| Dato | Risultato e significato |
| --- | --- |
| Intervalli accettati | 1801; 59,9963 invii/s |
| Prefisso finale | Tutti i 1801 invii confermati; notifica finale dopo 10,3 ms |
| Batch validati freschi | 308 = 154 render + 154 compute; nessuno stale |
| Draw con tutti i pass presenti | 1790/1801 = **99,3892%**, per entrambi i tipi |
| Somma render per draw completo | Media 21,4687 ms, p95 25,4935 ms; 1790 campioni |
| Somma compute per draw completo | Media 0,01552 ms; 1790 campioni |
| Duplicati, ambiguità, ledger invalidi | Nessuno |

I **9 unmatched** sono esattamente i pass dei Three frame **4960–4962**: due render e un compute per frame. Il primo draw del ledger è invece il frame **4963**. `startBenchmark()` apre un nuovo collector senza cancellare le query già accumulate nel pool; la prima risoluzione accetta quindi anche questi tre frame antecedenti. Il motivo `no-ledger-range`, senza candidati, è corretto: sono conservati nel raw ed esclusi dalle somme. Non risultano replay o attribuzioni forzate al draw che ha richiesto la risoluzione.

I **363 pass fuori finestra** corrispondono ai **121 draw di warmup/anchor**, registrati con `measuredIntervalId:null`. Il primo intervallo misurato è il draw 122, Three frame 5084. La contabilità chiude esattamente:

`5742 pass freschi = 9 pre-ledger + 363 fuori finestra + 1790 × (2 render + 1 compute)`.

Gli **11 draw mancanti** sono soltanto la coda: intervalli **1791–1801**, draw **1912–1922**, Three frame **6874–6884**. L’ultimo batch fresco di ciascun tipo è richiesto al draw 1911 e termina al frame 6873. Le risoluzioni sono distanziate di almeno 200 ms; `finishBenchmark()` attende il prefisso della coda, poi chiude il collector senza imporre una nuova risoluzione né attenderne una finale. Il report dichiara questa scelta. Il completamento della coda e la disponibilità dei timestamp sono due proprietà distinte: questi undici draw sono privi di query esportate alla chiusura, **non invii GPU non completati**. La loro esclusione rende esplicita una piccola copertura incompleta, non una media su tutti i 1801 invii.

Tutti i 1922 range registrati mantengono invariato `info.frame`, con contatori render 0→2 e compute 0→1. Le UID sono associate soltanto al range unico `(before, after]`; `requestAppDrawId` identifica la richiesta e non è usato come attribuzione dei pass. I due render sono un risultato osservato di questo run, non una costante assunta dall’aggregatore. I callback conservano il collector del run originario e `close()` rifiuta quelli tardivi.

**Limite della conclusione:** 21,4687 ms è una somma di intervalli timestamp dei pass associati, non tempo trascorso tra due frame, throughput isolato o presentazione del canvas. Nel report `presentedCanvasFps` resta `null`. Non è giustificato invertirla per ricavare FPS, dividerla per due o dedurre un difetto hardware. Il valore resta vicino alla vecchia media sparsa di 21,5356 ms: in questo run l’esportazione di tutti i pass freschi non elimina la discrepanza con il ritmo di invio. Il report non conserva gli estremi assoluti GPU delle query, quindi non consente di ricostruire una timeline né di verificare l’eventuale sovrapposizione fisica degli intervalli.

🌟 Per riportare questa misura usare `timestampPasses.statistics` insieme alla copertura **1790/1801**. Il campo storico `gpuRenderPassSumMs` è ancora l’alias di `gpu`, con **145 campioni sparsi**, e non va presentato come il nuovo aggregato completo. Conservare separati invii, notifiche di completamento e presentazione; nessun fix al mapping è motivato da questi dati.
