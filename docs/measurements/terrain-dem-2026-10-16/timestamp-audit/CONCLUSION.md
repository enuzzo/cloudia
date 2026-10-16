# R2: gli intervalli timestamp si sovrappongono

La raccolta reale del root contiene12draw completi,48coppie render e12compute. Il verifier offline ricontrolla interi start/end, durate, indici distinti, ledger,24clear, stato iniziale/finale, griglia e qualità. Esito PASS; nessuna nuova GPU o modifica del prodotto.

I quattro ruoli sono ora osservati nel callback di rendering, con materiali, target e programmi reali distinti: ombre R32F2048², terreno RGBA32F, nube RGBA16F intermedia, output canvas. Gli ultimi tre target sono2474×1844. I quattro shader compilati hanno SHA diversi; quello di output contiene una lettura texture e sRGBTransferOETF, senza integrateCloud. Non sono due integrazioni della nube. La sostituzione del materiale shadow è registrata correttamente.

**Gli intervalli cloud/output restituiti si sovrappongono in12/12draw:** media67,190784ms, minimo52,101120ms, massimo77,660160ms; totale806,289408ms. In8/12hanno lo stesso inizio, mai la stessa fine. Anche shadow/terrain e terreno/cloud-output presentano sovrapposizioni più brevi in11/12draw.

La somma dei48intervalli render è1629,945856ms; la loro unione, calcolata con uno sweep che gestisce anche intersezioni triple, è816,709632ms. La somma conta quindi813,236224ms più volte. L'unione descrive soltanto gli intervalli restituiti: non include clear e lacune senza query, non è occupazione GPU esclusiva e non permette di ricavare FPS.

Questa è prova di **non additività degli intervalli timestamp osservati**, non di parallelismo hardware, timestamp domain per command buffer, bug Metal o una specifica causa del driver. Le48coppie hanno indici e UID distinti e48range start/end diversi; non si tratta di duplicati introdotti dal ledger. La sola differenza fra le fini cloud/output non misura il costo esclusivo dell'output. [WebGPU lascia all'implementazione la determinazione dei timestamp](https://gpuweb.github.io/gpuweb/#timestamp-query); [Apple documenta distinti confini vertex/fragment](https://developer.apple.com/documentation/metal/mtlcountersamplingpoint/atstageboundary), ma il raw non identifica il meccanismo sottostante.

## Significato pratico per v53

Il valore circa120ms della somma non indica un frame GPU esclusivo da120ms e non attribuisce60ms al terreno. Non dividerlo per due, non sommare cloud e output per decidere la prossima ottimizzazione e non trasformare l'unione in una nuova misura FPS.

Il benchmark R5 recente e questo diagnostico hanno entrambi griglia2474×1844 e la stessa posa registrata. Il precedente dato R5 di16,21398464499032invii/s conserva il proprio significato di cadenza completa; la sovrapposizione dei timestamp non lo invalida. Questo diagnostico usa però12draw, un draw in volo, hook e bundling Three da source: non misura la cadenza normale e non prova alcuna prestazione del nuovo v53.

Per il checkpoint v53 usare report del prodotto intero a qualità piena/griglia nativa effettiva: cadenza degli invii, mediana/p95 degli intervalli e prefisso di coda completato, con versione/posa/stato registrati. I timestamp restano intervalli non additivi. La presentazione del compositore e i60FPSstabili restano non provati da questa raccolta.

`provenance.json` collega raw lossless e manifesto del harness R2 congelato. Il raw non contiene hash del bundle o URL servito: la provenienza della pagina dipende anche dai record separati CUA/server del root. R1 fallita rimane conservata, senza sostituzione.

Verifica ripetibile, soltanto CPU/lettura:

```sh
python3 verify.py
```
