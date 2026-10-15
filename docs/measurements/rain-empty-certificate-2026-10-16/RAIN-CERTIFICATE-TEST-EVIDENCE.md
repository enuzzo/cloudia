# Certificato vuoto durante la pioggia: evidenze e ipotesi di costo

**Esperimento ritirato.** Il prodotto è tornato alla variante v40; nessun vantaggio prestazionale dimostrato. Questa nota conserva controlli e interpretazione, senza proporre di riattivare il candidato.

## Ripristino e controlli CPU

`src/cumulonimbus/emptyTraversal.test.ts` è stato ripristinato rimuovendo soltanto i miei quattro test e i relativi import. Il risultato è byte-identico al checkpoint esplicito `8757b97591d3285d4399466056ec3a0c1239b506`: SHA256 `209777209c81b4670d1f4593425cf02eac0e46d1db4770bffb2c703dcb1e3859`; diff del file vuoto. Il test archiviato e la patch sono elencati nel [manifest](rain-certificate-guarded-test-manifest.json).

- **Quattro test mirati superati**, tre preesistenti esclusi dal filtro, corpo 27 ms/totale 517 ms. Usano gli helper CPU reali di traversal, moto e integrazione. Verificano spostamento continuo del riferimento sotto la transizione del ghiaccio, crescita iniziale con H=0, limite esclusivo e ingresso in uno strato sottile analitico interpolato 256/128 con warp/flow massimi. Non generano un volume reale.
- Il [modello esterno con guardia](cloud-empty-until-guarded-sequence-check.py) conserva esattamente sequenza f32 `t/ds` e integrazione in **10 casi sintetici**, e conferma due controlli negativi: riuso oltre rainRegion e halo invalido possono cambiare il risultato. Il [risultato](cloud-empty-until-guarded-sequence-result.json) registra i conteggi delle query. Non è esecuzione di WGSL, prova di parità immagine o misura del volume corrente.
- La [review continua indipendente](MASK0-CONTINUOUS-REVIEW.md) riguarda il certificato geometrico. Arming solo da mask0 fresca, `H=max(0,E−S)`, guardia pre-flow `reference.y+growth.x*H+.001<iceRange.x`, riuso soltanto in rainRegion e con `t<until` sono indispensabili.

L'originaria `cloud-empty-until.patch` è una preparazione esterna precedente alla guardia del ghiaccio. Il candidato GPU realmente misurato è invece conservato in `cloudShader.ts.guarded` / `GPUSceneEngine.ts.guarded`; non confondere questi artefatti.

## Misura reale già raccolta dal root

| Variante | Somma timestamp render media | Campioni GPU | Submission rAF/s |
|---|---:|---:|---:|
| v40 controllo corrispondente |171.4445ms|85|11.38035|
| v41 certificato con guardia |188.6007ms|77|10.37051|

Fonti: [controllo](rain-control-matched-30s.json), [candidato](rain-candidate-30s.json). Stessa camera/target, seed 72, t60 in pausa, cielo Pioggia, sole a sinistra, pioggia impostata 80%, pitch −.92, main WebGPU,2560×1440 pieno,256³/128³/384, passo pioggia massimo 6 m e beta 18/6.5. `weather.rain` effettivo differisce di circa4.01e−5 (0.004 punti percentuali); evitare la dicitura «stato numerico interamente identico».

Il candidato registra +17.1562ms nella metrica GPU (+10.0%) e −1.00984 submission rAF/s (−8.9%). Singola coppia sequenziale: temperatura, timing e coda non sono controllati causalmente. Nessuna misura di FPS presentati dal compositor. La metrica GPU è una somma campionata dei pass, non il reciproco di rAF: vedi [audit dedicato](FPS-METRICS-AUDIT.md). `rain-control-30s.json` ha un buffer differente e non è il controllo di questa tabella.

## Spiegazioni plausibili, non dimostrate

1. **Stato e registri.** `cloudEmptyUntil` attraversa le iterazioni; reference/referenceCoord/support diventano variabili unite dopo un ramo. È plausibile una durata di vita maggiore dei registri o un diverso scheduling. Apple documenta che controllo complesso e pressione sui registri possono ridurre l'occupancy e la capacità di nascondere latenza; qui non abbiamo conteggi di registri, spill o occupancy per provarlo. [Apple, image processing on Apple silicon](https://developer.apple.com/videos/play/wwdc2021/10153/), [Apple, optimize Metal performance](https://developer.apple.com/videos/play/wwdc2020/10632/).
2. **Divergenza fra pixel.** Raggi vicini raggiungono mask0, pioggia e scadenza del certificato a iterazioni diverse. La riduzione di query per un singolo raggio non equivale alla stessa riduzione di istruzioni per il gruppo SIMD. Apple descrive il costo possibile dei rami divergenti; manca un profilo che lo attribuisca a questo candidato. [Apple, advanced Metal shader optimization](https://developer.apple.com/videos/play/wwdc2016/606/).
3. **Lavoro risparmiato limitato.** Il ramo denso positivo non risparmia lookup; paga i controlli aggiunti. Pioggia, erosione e luce restano campionate come prima. La cache della texture potrebbe già nascondere parte del costo eliminato: è un'ipotesi, senza contatori di cache/banda in questi report.

Per distinguere queste cause servono compilazione/statistiche del vero shader e profilo SIMD/registri, non altri conteggi sintetici. L'eventuale [shader cost graph Apple](https://developer.apple.com/documentation/xcode/analyzing-apple-gpu-performance-using-shader-cost-graph-a17-m3) può esporre istruzioni attive/divergenza su hardware supportato; il report attuale identifica solo `apple/metal-3` e non garantisce tale supporto. Nessuna ulteriore prova GPU è stata eseguita per questa nota.
