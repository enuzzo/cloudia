# Interior05: review preventiva dello strumento CPU R1/R2

Review indipendente eseguita prima del bake, tramite sola lettura di piano, input, `probe.ts`, `run.py` e sorgenti v56 pertinenti. Nessun probe, preflight, test, build o GPU eseguito dal revisore; nessun sorgente modificato. Questo documento registra l'audit già concluso, senza nuove verifiche.

## Blocco R1 e risoluzione R2

**R1 non pronta al run:** `actualBounds` usava `volume.supportBounds + drift`, mentre `GPUSceneEngine.ts` righe287–288 espande i bounds installati sottraendo/aggiungendo `[1.3,0,.65]` su X/Y/Z prima del drift. Quel margine copre shear inverso e halo del flow. Il controllo `outsideRenderedBox` del probe poteva quindi azzerare materiale che il renderer ammette. Anche il contenitore comune, costruito da `BOUNDS_MIN/BOUNDS_SIZE`, mancava dello stesso margine.

Il blocco è stato comunicato ad Anatomy e Root prima dell'esecuzione. Anatomy ha confermato il difetto; Root ha autorizzato una R2 separata. Nessun bake R1 era partito secondo la comunicazione dell'autore.

**R2: blocco risolto.** Letti `interior05-diagnostic-r1-to-r2.patch` e le righe effettive della R2: `runtimeHalo=[1.3,0,.65]` viene sottratto ai minimi e aggiunto ai massimi di entrambi `actualBounds` e `commonBounds`, insieme al drift. La patch del probe cambia soltanto questa costruzione e i relativi commenti. Nessun altro blocco concreto emerso nei punti richiesti. Il via all'esecuzione resta quello di Root, non una nuova autorizzazione del revisore.

## Punti controllati

- Camera74near60: origine e target degli input, base forward/right/up, aspect1920/1080 e tanFov.2867;13UV continui top-left nell'ordine fissato. `screenY=1−2v−.16*(1−.6)` include l'offset−.064. Non sono centri pixel arrotondati.
- Stato t60/seed74, vento e drift dalle formule dell'engine; crescita tramite `motionState` e `referencePosition`, dispersione zero. Nessuna sostituzione del flow filtrato con il campo analitico continuo al punto del raggio.
- Flow16³ prodotto dal riferimento CPU reale, quantizzato half e ricampionato trilinearmente con clamp e half-texel tramite `writeFilteredSourcePosition`. Occupancy alpha letta alle coordinate reference, con inset del dettaglio.
- Fine warp, ghiaccio e materiale tramite i sampler condivisi. Microerosione pesata con inspection.6, distanza del campione e `(1−ice)`, applicata soltanto per peso>.001; erosione aggiuntiva include flow.a. Forcing zero implica massFactor/fragments1.
- Soglia finale density<.002→zero, primoρ≥.002 distinto da primoρ>.025; estinzione interpolata18/6.5 in funzione del ghiaccio. Il secondo fronte conserva distanza/intervallo ma non un checkpoint world/material dedicato: completezza minore, non blocco numerico, perché la posizione è ricostruibile dal raggio.
- Integrazione midpoint1m e solo centro ripetuto a.5m; τ1/τ3 interpolate nel segmento, arresto T<.006. Peso `w=T_before*(1−exp(−sigma*ds))`, somma/normalizzazione esplicite e residuo conservato. Footprint ricavato dalla profondità assiale, senza confondere il raggio del probe con la distanza del primo materiale.
- Terreno: bound superiore da DEM decodificato, massimo authored3.31km e slack Float32 di1cm, con curvatura che abbassa i vertici. Il minimo Y del segmento rettilineo è verificabile agli estremi. Se non supera il bound, il probe dichiara occlusione non provata invece di inventare una distanza raster. È un certificato sufficiente quando true, non una ricostruzione del terrainRaster.

## Limiti e giudizio

**Nessun blocco residuo rilevato nella R2 letta.** È una diagnosi CPU continua Float64 di frontiera e distribuzione d'opacità su13raggi, non un confronto bitexact con il renderer. Il flow half proviene dal riferimento CPU, non dal readback del compute GPU; aritmetica f32, filtri hardware, jitter, marcia adattiva e skipping effettivo non sono replicati. Il mezzo continuo e i checkpoint non certificano tutti i pixel, RGB, moto o prestazioni. I campioni di1m hanno la risoluzione dichiarata; il mezzo metro centrale non qualifica ogni raggio.

Il wrapper è stato letto, ma i suoi PASS di preflight/libproc/hash sono stati comunicati dall'autore, non rieseguiti dal revisore. Questa review non registra risultati di bake successivi e non cambia l'esito visivo negativo delle quattro immagini interior05. Nessuna promozione del candidato deriva dal completamento della diagnosi CPU.
