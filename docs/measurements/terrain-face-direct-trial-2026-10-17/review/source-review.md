# Face-direct R1 — review statica indipendente

17 ottobre 2026. **PASS statico per il trial circoscritto; nessun blocker concreto nei byte congelati.** Nessuna prova GPU, test, modello o build eseguita da questo revisore. Freeze 143 file `run/SOURCE-FREEZE.json`, SHA256 `b3f253843ed7d57c8d45d37dce65775e0e1fe1f8f4a3b2400f380aaee9336a65`.

## Delta e identità del controllo

Rispetto al manifest finale v61 da 141 file, il freeze aggiunge soltanto `terrainFaceDirect.ts`/test e cambia Engine/lifecycle. Materiale ottico, wrapper raster, terrainSurface, TerrainMesh, array/dati, luce e ombre mantengono gli stessi hash manifestati. Ho verificato anche i quattro file cambiati/nuovi contro il freeze, senza ricalcolare modelli.

La factory `terrainFaceDirectSurfaceWGSL(false,optical)` restituisce direttamente `terrainOpticalSurfaceWGSL(optical)`: controllo ordinary byte-exact per entrambi i booleani. True richiede una sola occorrenza della riga diffuse originale, rifiuta identificatori già derivati e consente di recuperare la libreria completa invertendo il blocco. Il codice letto sostituisce unicamente quella riga con il calcolo Dface; non altera `normal`, rough, `n`, albedo, skylight, solarVisibility, costa/acqua o la formula ground. Non aggiunge argomenti, binding o lookup.

Engine seleziona la variante una volta per owner solo con `profile=1&faceDirect=1` (`:223`) e la passa alla libreria dello stesso wrapper (`:339`). Il percorso senza flag resta ordinary; `optical=0` conserva la sua esclusione diagnostica esplicita. Essendo una scelta immutabile, non richiede un nuovo campo dinamico nella cache owner-local. `terrainDirectMode` è dichiarato sia nella cattura sia nel benchmark (`:586/:840`); la versione sperimentale non viene scambiata con il v61 adottato.

## Derivate, verso e fallback

Entrambe le derivate sono eseguite prima di qualunque select e senza branch nel blocco. Il materiale è chiamato incondizionatamente dal wrapper corrente. Si rispetta quindi il requisito di controllo uniforme del WGSL nel call path letto; la compilazione del vero shader resta un gate del root. La specifica rende i risultati indeterminati in controllo non uniforme: [WGSL, derivate e uniformity](https://www.w3.org/TR/WGSL/#derivative-builtin-functions).

`cross(dpdy(point),dpdx(point))` deriva il piano dalla posizione mondo della stessa superficie rasterizzata. Il select impone Y non negativa, coerente con la mesh attuale rappresentabile come quota sopra XZ e priva di overhang; non è un orientamento riusabile senza modifica per grotte/pareti sovrapposte. Sulle 12 facce storiche il verso coincide con le normali geometriche Y-positive. Il precedente primario di implementazione è [Three r186 Normal.js](https://github.com/mrdoob/three.js/blob/r186/src/nodes/accessors/Normal.js#L40), dove normalFlat usa il cross delle derivate di positionView; qui spazio mondo, ordine e orientamento sono espliciti.

`inverseSqrt(max(length2,1e−20))` evita l’inverso della radice di zero e di valori positivi troppo piccoli. Con length2≤1e−20 il risultato selezionato è il macro `normal` già normalizzato, non il rough `n`. `select` valuta comunque gli operandi: il denominatore protetto è quindi necessario anche per il ramo scartato. L’epsilon è una soglia numerica fissa in unità delle derivate mondo, non un angolo di smoothing o un gain estetico.

**Limite:** questo protegge cross finito nullo/tiny, ma non dimostra finitezza per qualunque derivata arbitraria: overflow di cross/dot o NaN non sono gestiti da un controllo dedicato. Non vedo un caso concreto di tale overflow nella posa prefissata, né lo considero qualificato dai piccoli test. Degenerazione, bordi di primitive e precisione delle differenze restano aspetti della prova GPU. Non richiedo di aprire una variante o ritoccare la soglia prima dell’immagine congelata.

## Interpretazione e gate visivo

La differenza fra normale shading e geometrica può introdurre incoerenze al terminatore: è documentata da Chiang/Li/Burley, [Taming the Shadow Terminator, SIGGRAPH 2019](https://media.disneyanimation.com/technology/publications/2019/TamingtheShadowTerminator.pdf). Quel lavoro aggiunge un fattore di shadowing; il trial presente usa Dface e non implementa tale modello. La fonte non attribuisce ai nostri segni una causa: L2 ha entrambi i dot positivi, mentre L1/L3 erano già D0. Evitare il termine “fix shadow terminator” per questo esperimento.

Il trial è ben isolato per verificare la previsione L2 del ledger. Può però rendere visibili facce e diagonali; il crease 45° già ritirato rende tale rischio concreto, senza predire l’esito di questa variante distinta. Richiedere stesso assetto/qualità, fullalpha invariata e controllo ordinary autenticato prima di leggere la differenza nativa. Nessuna adozione, beneficio FPS o soluzione generale dei segni è dedotta dalla review.

## File finali verificati

| File in face-source/src/cumulonimbus | Byte | SHA256 |
|---|---:|---|
| `terrainFaceDirect.ts` | 1879 | `02d6cf0d7591edf7d25bd8d678044557cca33d0e5d1b254ec16ef1b9aa886020` |
| `terrainFaceDirect.test.ts` | 6428 | `d62b83490f638ae6eadc78f145a0ed02681cf75fea9cf9f24999e5064dd67623` |
| `GPUSceneEngine.ts` | 85347 | `c18d6bccea488ef841d6105a77616efce42e0ab896cf0047ce81893bd59a644a` |
| `lifecycle.test.ts` | 78361 | `a6ba574ba990b1b651598edec6653c3ef45aac97bb880022aa64e2421377499b` |
