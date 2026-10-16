# Crease45 — review visiva indipendente nativa

17 ottobre2026. **FAIL / nessun beneficio utile; non adottare.** Ispezione delle due PNG native intere e dei quattro crop1:1 già salvati, più sole verifiche I/O Pillow/JSON. Nessun nuovo rendering, raggio, GPU, build, test del modello, cambio sorgente o soglia.

Il protocollo fissava un miglioramento visibile di creste/roccia senza faccette o diagonali. La candidata non lo raggiunge:

1. **ROI primaria `[0,560,1000,1000]`:** i grandi versanti e crinali mantengono una lettura liscia e cuscinosamente uniforme. Alcuni segmenti corti scuri e spigoli sulle creste diventano più netti; non si trasformano in una struttura rocciosa più credibile. È soprattutto evidenza di alcune facce, non un guadagno convincente di rilievo naturale.
2. **ROI secondaria `[700,540,1030,780]`:** non riconosco un miglioramento utile. Restano la cresta arrotondata e la macchia geometrica sottostante; il cambio di normali non ne risolve la lettura. Non attribuisco quella macchia al solo shadow o a una singola causa da questa immagine.
3. **Vista intera:** nella catena lontana superiore centrale/destra alcune facce angolari e diagonali diventano più esplicite. La geometria non è nuova: è lo shading che rende più visibili alcuni piani esistenti. Questa maggiore lettura poligonale va nella direzione opposta al gate fotografico.

Una seconda lettura indipendente del peer receiver_read_api, su entrambe le PNG e tutti quattro i crop, concorda sul FAIL. Il giudizio non deriva dal conteggio dei duplicati o dall'esito dei test.

## Evidenza e comparabilità

- Baseline canonica: `docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-sun-native.png`,2474×1844,2909134B, SHA256 `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`.
- Candidata: `cycle32/browser/crease-main-sun-native.png`,2474×1844,2908264B, SHA256 `cac9ee865df1a24728150f8d7d2106e379f17172782d1710a70f4dc6eb6c2898`. Entrambi gli hash sono stati riletti dai file locali.
- I quattro `crease-{baseline,candidate}-{primary,secondary}-roi.png` sono copie pixel-esatte dei rettangoli del protocollo, verificate contro le rispettive PNG. Nessun resize, enhancement o nuova esposizione.
- Metadata: qualità,256³/128³/384,output/internal/canvas,weather,pausa/orbit/ablation/flow coincidono. Camera/luci/material.wind differiscono in pochi ultimi bit JavaScript rispetto all'owner storico ma coincidono dopo conversione float32 per origin/forward/right/up/target/aspect/tan/approach, sun/solar/ambient e wind. Non dichiaro che i due owner siano lo stesso processo.
- Il protocollo riporta594082vertici/1182550triangoli,2294duplicati e73408B geometrici aggiunti, con posizione/surface per corner preservati. Sono prove tecniche distinte: non certificano utilità artistica o FPS.

**Stop rule attiva:** conservare la v59. Nessun fitting dell'angolo45°, altro sweep, worker, pioggia/Tramonto o benchmark FPS per questa variante. Preservare source, preflight, qualifica e PNG del tentativo come negativo riproducibile. Questo FAIL riguarda la candidata fissata e questa prima posa, senza trasformarlo in prova che ogni diversa politica delle normali sia inefficace o in un PASS fotografico della baseline.
