# Candidata successiva: preservare i crinali nelle normali

17 ottobre2026. **Proposta singola, non implementata né eseguita.** Root ha comunicato il controfattuale con12deltaRGB nulli; la sua verifica dati/PNG resta separata. Nessuna nuova quota, texture, rumore, luce o riduzione256³/128³/384/output pieno.

## Perché questa modifica

Ho visto il bitmap nativo90641c32… (`docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-sun-native.png`). Le grandi creste sono leggibili, ma molti versanti/crinali risultano cuscinosi; la trama minuta non restituisce una struttura rocciosa incisiva. È una critica visiva, non una prova della causa di ogni triangolo scuro.

`blendTerrainMeshNormals` attuale somma i cross non normalizzati di **tutte** le facce incidenti e assegna una sola normale condivisa al vertice. La media pesata per area è coerente per i pendii dolci, ma media anche attraverso una cresta netta: l'orientamento di un versante può essere tirato verso quello opposto. Il materiale aggiunge solo piccole rough-normal filtrate; queste non ricostruiscono un crinale soppresso e non devono fingere dettaglio geografico sotto i125m del DEM.

**Cambiare soltanto la policy delle normali: crease angle45° fissato ora.** Mediare le normali attraverso facce incidenti solo se l'angolo rispetto alla faccia del corner è<=45°. Dove tutte le facce del vertice rientrano nella soglia, mantenere esattamente l'attuale media areaweighted. Ai vertici con normali corner diverse, duplicare soltanto gli attributi necessari e rimappare gli indici; non fare deindex globale.

## Regola precisa, senza fitting

Per la faccia f, con cross orientato `a_f` e normale unitaria `u_f`, il corner sul vertice v riceve:

```text
S(v,f) = {g incidente a v : dot(u_f,u_g) >= sqrt(1/2)}
n(v,f) = normalize(sum_{g in S(v,f), ordine facce originale} a_g)
```

Contributi pesati per area come oggi; soglia45° non è geologia misurata, ma una scelta di smoothing dichiarata prima della GPU. La somma usa l'ordine attuale per conservare i byte nei vertici senza crease. Raggruppare solo normali corner finali bitidentiche dello **stesso vertexID originale**; niente hash/arrotondamento delle posizioni e niente fusione di vertici estranei. Il confronto angolare è per faccia di riferimento, non transitivo: una catena di piccoli angoli non deve riunire automaticamente due versanti distanti oltre45°.

Posizione/surface di ogni corner, ordine/winding dei triangoli, quote, costa, bounds, CPU hit lookup, camera e shadow rimangono identici nello spazio. Cambia soltanto quale normale accompagna quel corner. Duplicati e bytes sono contati separatamente da quelli aggiunti dal raffinamento geografico; nessuna falsa attribuzione al DEM.

Il materiale usa la normale anche per slope/aspect/sky proxy: questa è una candidata visiva di normal policy, non una pura ablazione del solo NdotL. Palette, coefficienti rough, sole/ambient, aerial e shadow devono restare invariati.

## Implementazione standalone e costo

API proposta per il helper esterno:

```ts
splitTerrainCreaseNormals(input: {
 positions: Float32Array; normals: Float32Array;
 surface: Float32Array; indices: Uint32Array;
}): { positions: Float32Array; normals: Float32Array;
      surface: Float32Array; indices: Uint32Array; stats: ... }
```

La soglia non è un parametro di UI né uno sweep. Input immutati; output ha prefissi positions/surface originali e duplicati in ordine deterministico, first-seen corner per vertexID. Root integra il risultato prima di costruire BufferGeometry e mantiene il data usato dalla lookup coerente. Nessuna geometria va ricampionata e nessun volume nube ricreato.

Usare CSR vertice→corner: offset Uint32(V+1), corner Uint32(indexCount), cross/normalizzazione per faccia in typed array. **Non una Map con stringhe per1,8milioni di edge.** Lavoro locale per valenza, fast path quando tutti gli incidenti sono compatibili; gruppi temporanei riusati per un vertice alla volta. Non usare il helper Three `toCreasedNormals` direttamente: in r186 parte da toNonIndexed e cambierebbe anche pesatura, memoria e cache dei vertici. Il sorgente locale `node_modules/three/examples/jsm/utils/BufferGeometryUtils.js:1315–1477` documenta la tecnica per-corner, ma non è la specifica da copiare per questo trial.

Costo strutturale previsto:0lookup/pass/texture nuovi; triangoli invariati;32byte per vertice duplicato nei tre attributi esistenti e indici sempre Uint32. La vertex cache può perdere riuso sui crease: **nessun FPS uguale garantito**. Rilevare count/typed-array bytes e RSS/CPU reali nel solo run autorizzato; non dedurre il picco dalla somma dei payload. Gate root20CPU/40wall/<2GiB, tenendo visibile il picco precedente1,135GB. Se il budget fallisce, preservare il FAIL: niente truncation, angolo diverso o riduzione della qualità.

## Prove minime e decisione visiva

- Piano e ventaglio dolce con aree disuguali: stessa media areaweighted e arrays/corner invariati, non solo normali plausibili.
- Cresta sintetica oltre45°: i lati non si mediano tra loro; sotto/equale soglia e winding sono espliciti. Verificare per ogni corner stessi bit posizione/surface, stessa faccia/ordine e output finito/unitario, input non mutati.
- Mesh A v59 già installata/cache: un solo preprocess senza volume nuovo. Count duplicati e confronto corner/bounds/CPU lookup; poi **una prima PNG nativa stessa posa90641**. Il gate è crinali più credibili, senza triangoli/diagonali di griglia o spigoli da low-poly. Nessun parametro si cambia dopo il primo risultato; FAIL termina questa variante.
- Solo dopo un PASS visivo verificare altro orientamento/Tramonto/pioggia e costo A/B/A. Non promuovere da test o normale unitaria.

Non ripropongo analytic-blend: il gradiente DEM è derivata del bilineare, discontinuo ai bordi; la v53 aveva già ridotto quei bordi passando alla policy geometrica. Inoltre i midpoint raffinati oggi partono da[0,1,0] prima della media geometrica: saltare la funzione corrente non sarebbe un ripristino corretto. Non propongo Gouraud, che ammorbidirebbe ancora le creste, né nuove cromie/contrasto autoriale per mascherare il problema.

Limite netto: la candidata può rivelare soltanto crease già presenti nei triangoli125–128m. Non aggiunge silhouette o canali sotto risoluzione, non crea foreste3D, non ripara haze e non garantisce di eliminare tutte le patch scure. Proprio per questo deve essere giudicata come modifica visiva concreta e circoscritta, non come soluzione fotografica completa.
