# Candidata successiva: preservare i crinali nelle normali

17 ottobre2026. **Proposta singola, non implementata né eseguita.** Root ha comunicato il controfattuale con12deltaRGB nulli; la sua verifica dati/PNG resta separata. Nessuna nuova quota, texture, rumore, luce o riduzione256³/128³/384/output pieno.

## Perché questa modifica

Ho visto il bitmap nativo90641c32… (`docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-sun-native.png`). Le grandi creste sono leggibili, ma molti versanti/crinali risultano cuscinosi; la trama minuta non restituisce una struttura rocciosa incisiva. È una critica visiva, non una prova della causa di ogni triangolo scuro.

`blendTerrainMeshNormals` attuale somma i cross non normalizzati di **tutte** le facce incidenti e assegna una sola normale condivisa al vertice. La media pesata per area è coerente per i pendii dolci, ma media anche attraverso una cresta netta: l'orientamento di un versante può essere tirato verso quello opposto. Il materiale aggiunge solo piccole rough-normal filtrate; queste non ricostruiscono un crinale soppresso e non devono fingere dettaglio geografico sotto i125m del DEM.

**Cambiare soltanto la policy delle normali: crease angle45° fissato ora.** Mediare le normali attraverso facce incidenti solo se l'angolo rispetto alla faccia del corner è<=45°. Dove il grafo delle facce incidenti ha una sola componente, mantenere esattamente la normale attuale. Ai vertici con componenti multiple, duplicare soltanto gli attributi necessari e rimappare gli indici; non fare deindex globale.

## Regola precisa, senza fitting

Contratto finale concordato col root: al vertice v, le facce incidenti sono nodi di un grafo. Esiste un arco fra f e g soltanto se condividono anche un secondo indice (edge reale) e il dihedrale è<=45°. Per il corner della faccia f:

```text
G(v,f) = componente connessa di f nel grafo degli edge smooth
n(v,f) = normalize(sum_{g in G(v,f), ordine facce originale} a_g)
```

Contributi pesati per area come oggi; soglia45° non è geologia misurata, ma una scelta di smoothing dichiarata prima della GPU. La somma usa l'ordine attuale per conservare i byte nei vertici senza crease. Raggruppare per componente sullo **stesso vertexID originale**; niente hash/arrotondamento delle posizioni e niente fusione di vertici estranei. La connettività è transitiva: una catena di edge smooth può unire facce con angolo complessivo>45° e un fan alternativo può ricongiungere gli estremi di un edge direttamente hard. Non promettere dunque che ogni hard adjacency imponga due normali distinte: contare separatamente hard edge-endpoint pairs e vertici realmente split. La preliminare face-relative è preservata in next-terrain-candidate.r1-face-relative.md; questa scelta finale non è un tuning successivo alla GPU.

Posizione/surface di ogni corner, ordine/winding dei triangoli, quote, costa, bounds, CPU hit lookup, camera e shadow rimangono identici nello spazio. Cambia soltanto quale normale accompagna quel corner. Duplicati e bytes sono contati separatamente da quelli aggiunti dal raffinamento geografico; nessuna falsa attribuzione al DEM.

Il materiale usa la normale anche per slope/aspect/sky proxy: questa è una candidata visiva di normal policy, non una pura ablazione del solo NdotL. Palette, coefficienti rough, sole/ambient, aerial e shadow devono restare invariati.

## Implementazione standalone e costo

API proposta per il helper esterno:

```ts
applyTerrainCreaseNormals(input: {
 positions: Float32Array; normals: Float32Array;
 surface: Float32Array; indices: Uint32Array;
}, angleDegrees=45, limits?: Partial<{maxVertices:number; maxTriangles:number; maxIncidentFaces:number}>): { positions: Float32Array; normals: Float32Array;
      surface: Float32Array; indices: Uint32Array; stats: ... }
```

La soglia produzione resta45°, non è un parametro di UI né uno sweep. Caps finali700000vertici/1300000triangoli/128facce incidenti; fallimento esplicito senza truncation. Un vertice con un unico gruppo conserva esattamente il suo normale originale. Input immutati; output ha prefissi positions/surface originali e duplicati in ordine deterministico, first-seen corner per vertexID. Root integra il risultato prima di costruire BufferGeometry e mantiene il data usato dalla lookup coerente. Nessuna geometria va ricampionata e nessun volume nube ricreato.

Usare CSR vertice→corner: offset Uint32(V+1), corner Uint32(indexCount), cross/normalizzazione per faccia in typed array. **Non una Map con stringhe per1,8milioni di edge.** Lavoro locale per valenza, fast path quando tutti gli incidenti sono compatibili; gruppi temporanei riusati per un vertice alla volta. Non usare il helper Three `toCreasedNormals` direttamente: in r186 parte da toNonIndexed e cambierebbe anche pesatura, memoria e cache dei vertici. Il sorgente locale `node_modules/three/examples/jsm/utils/BufferGeometryUtils.js:1315–1477` documenta la tecnica per-corner, ma non è la specifica da copiare per questo trial.

Costo strutturale previsto:0lookup/pass/texture nuovi; triangoli invariati;32byte per vertice duplicato nei tre attributi esistenti e indici sempre Uint32. La vertex cache può perdere riuso sui crease: **nessun FPS uguale garantito**. Rilevare count/typed-array bytes e RSS/CPU reali nel solo run autorizzato; non dedurre il picco dalla somma dei payload. Gate root20CPU/40wall/<2GiB, tenendo visibile il picco precedente1,135GB. Se il budget fallisce, preservare il FAIL: niente truncation, angolo diverso o riduzione della qualità.

## Prove minime e decisione visiva

- Piano e ventaglio dolce con aree disuguali: stessa media areaweighted e arrays/corner invariati, non solo normali plausibili.
- Cresta sintetica oltre45°: i lati non si mediano tra loro; sotto/equale soglia e winding sono espliciti. Verificare per ogni corner stessi bit posizione/surface, stessa faccia/ordine e output finito/unitario, input non mutati.
- Mesh A v59 già installata/cache: un solo preprocess senza volume nuovo. Count duplicati e confronto corner/bounds/CPU lookup; poi **una prima PNG nativa stessa posa90641**. Il gate è crinali più credibili, senza triangoli/diagonali di griglia o spigoli da low-poly. Nessun parametro si cambia dopo il primo risultato; FAIL termina questa variante.
- Solo dopo un PASS visivo verificare altro orientamento/Tramonto/pioggia e costo A/B/A. Non promuovere da test o normale unitaria.

Non ripropongo analytic-blend: il gradiente DEM è derivata del bilineare, discontinuo ai bordi; la v53 aveva già ridotto quei bordi passando alla policy geometrica. Inoltre i midpoint raffinati oggi partono da[0,1,0] prima della media geometrica: saltare la funzione corrente non sarebbe un ripristino corretto. Non propongo Gouraud, che ammorbidirebbe ancora le creste, né nuove cromie/contrasto autoriale per mascherare il problema.

Limite netto: la candidata può rivelare soltanto crease già presenti nei triangoli125–128m. Non aggiunge silhouette o canali sotto risoluzione, non crea foreste3D, non ripara haze e non garantisce di eliminare tutte le patch scure. Proprio per questo deve essere giudicata come modifica visiva concreta e circoscritta, non come soluzione fotografica completa.


## Implementazione esterna congelata, non eseguita

- `crease-source/src/cumulonimbus/terrainCreaseNormals.ts` —11259B, SHA256 `52e5b8e20e9db3d2f6187e47631aac5115755fbdf368acb03545756638b00297`.
- `crease-source/src/cumulonimbus/terrainCreaseNormals.test.ts` —7296B, SHA256 `e2be4755ad11eaa4e6103f3e1fa8df67e203e06d5c42b45651962d559daa68bc`.

Otto fixture piccole scritte e non eseguite. Il test del fan conserva il normale al centro anche con un'adiacenza hard riconnessa da altri edge; il test vertex-only impedisce la fusione fra facce senza edge comune. Il conto typed-array distingue scratch, capacità e slice finali, senza contare due volte l'index buffer; non è una misura RSS. Root possiede integrazione/test/build/preflight/GPU. Nessun altro sorgente è stato modificato da questo autore.
