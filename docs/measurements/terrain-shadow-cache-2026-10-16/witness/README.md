# Sei witness nativi del terreno — riferimento CPU congelato

**Nessun fix dedotto, nessuna nuova variante di bias.** Un solo kernel eseguito: mesh Float32 congelata v57, sei receiver, sei raggi al centro texel della shadow map e sei raggi fisici verso il Sole. Non sono state eseguite GPU, browser, build, test del prodotto o altre scansioni della griglia.

## Risultato che cambia la diagnosi

Il riferimento CPU dà visibility=0 sui tre pixel selezionati come artefatti e visibility=1 sui tre controlli, coerentemente con il pattern selezionato dal confronto PNG baseline/unshadowed. Tuttavia il raycast geometrico DoubleSide trova un blocker distinto dal receiver **in tutti e sei i casi**. Non ci sono mismatch forti artifact-lit; non è una dimostrazione bit per bit della GPU.

| Punto | Faccia receiver | Faccia caster texel | Visibilità CPU | Blocker fisico, distanza lungo raggio | Margine lookup−stored |
|---|---:|---:|---:|---:|---:|
| L1 artefatto | 389949 | 389947 | 0 | 272,215 m | −190,107 m |
| L1 controllo | 389949 | 389948 | 1 | 275,336 m | +234,081 m |
| L2 artefatto | 386020 | 386018 | 0 | 79,065 m | −46,844 m |
| L2 controllo | 386019 | 386018 | 1 | 142,857 m | +19,816 m |
| L3 artefatto | 379930 | 379929 | 0 | 194,980 m | −97,160 m |
| L3 controllo | 379930 | 379929 | 1 | 97,889 m | +15,615 m |

L1 e L3 artefatto/controllo appartengono ciascuno alla **stessa faccia effettiva**. Il prodotto normale geometrica·Sole vale rispettivamente −0,11025 e −0,08826: sono facce rivolte altrove rispetto al Sole e il raggio trova davvero un rilievo davanti. In L2 l'artefatto è su una faccia con n·sun=+0,12835, ma un'altra faccia della dorsale blocca il Sole. Quindi il criterio «la scaglia si schiarisce senza shadow, perciò è acne» non è sufficiente. Nel modello triangolare di riferimento i punti scuri possono essere parti corrette di un'ombra frammentata da zone erroneamente illuminate.

I controlli RGB invariati non provavano da soli visibility=1: diffuse o arrotondamento possono nascondere una variazione. Qui però il riferimento geometrico della shadow map li classifica effettivamente lit, pur trovando blocker fisici. Questa è la discrepanza utile, entro il perimetro CPU.

## Meccanismo concreto del baseline

Il depth sceglie il frontmost RAW q al centro del texel, **poi** si sottrae dal q di quella faccia metà della somma dei gradienti assoluti più1m. Non viene scelto il massimo dei minimum fra facce.

L1 controllo è un esempio forte: caster n·sun=0,07705; dq/dpixelY≈806,73m e dq/dpixelX≈−56,83m. La riduzione affine è432,78m, che rende il lookup lit con un margine di234,08m nonostante il blocker fisico. L2 controllo riduce125,03m; L3 controllo69,78m. Sono scale ettometriche, non un errore di arrotondamento millimetrico. La pendenza del caster rispetto al Sole conta anche quando l'elevazione globale del Sole è alta.

L'estensione del piano su tutto il texel può attraversare una cresta o proseguire fuori dal triangolo vincente. Il precedente normal-clearance dimostrava soltanto il distacco da un piano locale: non limitava questa riduzione né garantiva di campionare lo stesso caster. **Non viene qui proposto un cap, un nuovo bias o un altro coefficiente.** La descrizione storica delle sole ombre di contatto decametriche perse è troppo stretta per comprendere tutti i pendii osservati.

Le facce locali dei witness hanno lati X/Z di256m: il DEM125m non implica che il raster corrente abbia triangoli125m in questi punti, che sono a circa19–27km dall'origine. Normali lisce e ombra della geometria effettiva possono quindi far emergere le facce più grossolane. È una constatazione dai vertici salvati, non un nuovo esperimento o un'autorizzazione a modificare la mesh.

## Ricostruzione e precisione

- Tutti i124 sorgenti sono verificati contro manifest SHA `8dce2ed7a5843104c3b606c4223435d69408d43739712b1f722c7a1fa8a348f2` prima e dopo. Nessuna modifica alla snapshot o al checkout.
- `buildTerrainMeshData(createDemTerrainSampler(decodeTerrainDem(binary),terrainSurfaceSample), {cellsPerSide:256,levels:9,normalMode:'geometry'})`:465409 vertici,929792 triangoli,4096 celle di raccordo. Output JSON solo di sei casi, nessun array voluminoso.
- Camera da `configureTerrainCamera`: origin/basis/aspect/tan/inspection arrotondati f32, shift verticale0,16*(1−approach), centri pixel top-origin già fissati nel protocollo. Errore massimo fra direzione Raycaster e formula manuale9,74e−15. Receiver a34–44km di profondità, nettamente entro i piani near/far; il fatto che Raycaster usi distanze euclidee non cambia questi hit.
- Receiver e caster FrontSide come i materiali raster. Caster al centro del texel2048; q e gradienti derivati dalla **sua** normale di faccia. Nessuna normale interpolata viene usata per la shadow.
- Raggio fisico dal receiver+1cm lungo sun, DoubleSide e far20km; own-face e adiacenze condivise entro1cm escluse. In questi sei casi non è stato escluso alcun hit. Per tutti, l'estremo a20km supera il massimo worldY dell'intera mesh e sun.y>0: non possono comparire blocker successivi della stessa mesh. Non è una prova su oggetti o geografia fuori dalla scena.

Le coordinate sono ottenute da triangoli Float32 tramite calcoli CPU Float64; proiezione/raster GPU, interpolazione, edge rules, matrix upload, f32 e tie non sono riprodotti bit per bit. Le distanze dal bordo nearest dei sei lookup sono0,048–0,264texel, non esattamente sul bordo, ma non se ne deduce equivalenza universale. Se una futura lettura GPU di caster o q diverge, conservare il mismatch e non inferire un fix da questi soli risultati.

## Esecuzione, file e limiti

Unico run Bun1.3.11 arm64: exit0; CPU2,299123s, wall1,993940s, RSS di picco834404352byte. Hard CPU20s, wall40s, gate terminale RSS2GiB rispettati. Nessun RLIMIT_RSS/AS o ps; getrusage a posteriori. Nessun fallimento pre-exec in questo ciclo. `run.py` conserva un errore del launcher se accade e non fa retry.

- `PRE-RUN-FREEZE.json`: protocollo, metadati,124-source manifest, script, runtime e dipendenze selezionate hashati prima del run.
- `witness.ts`, `run.py`: kernel e wrapper eseguiti una sola volta.
- `result.json`: dettagli completi receiver/caster/blocker, raggi, UV, margini, tempi e facce.
- `summary.json`: tabella compatta; `run.json` e `stderr.log`: esito terminale e budget.
- `POST-RUN-INPUT-VERIFICATION.json`: sorgenti e input congelati invariati.

I sei pixel erano scelti per discriminare artefatti persistenti, non per stimare la frequenza del difetto. Non si estende il risultato ad altre camere, Sole basso, tutta la mesh, fotorealismo o prestazioni GPU. Il prossimo passo resta una decisione separata di root; questo witness impedisce soprattutto di scambiare l'eliminazione cosmetica delle ombre per una correzione fisica.
