# Review indipendente integrazione caster/clipping — ciclo 27

**Esito: nessun blocker statico concreto rilevato per il trial attuale con terreno immutabile e target esclusivo.** Non è adozione né validazione WGSL/GPU, nativa, artistica o FPS. Nessun test, build, bake, modello CPU, raycast, browser o GPU eseguito per questa review. Unica scrittura: questa nota.

## File letti e identità

I file appartengono alla snapshot esterna `candidate-source`, non al prodotto. SHA rilevati al momento della review; Solar ha confermato congelato il runtime `terrainShadowClip.ts` con lo SHA riportato, mentre il suo test era ancora in revisione parser. Gli esiti 8 test/typecheck del caster e 33 test/typecheck del clip sono comunicati dagli autori, non ripetuti da me.

| File sotto `candidate-source/src/cumulonimbus` | Byte | SHA-256 |
|---|---:|---|
| `TerrainShadow.ts` | 17172 | `082695c1f98b56b600624a63c992d3a1215ca8958af5caeae39d501e0fb6b0f8` |
| `terrainMesh.ts` | 18350 | `d2798a031c898ab4eac8454de04e95e2c15616ca939c69987b107c7825d0d010` |
| `TerrainShadowCaster.ts` | 8024 | `1c7463b35b4700e3ce805d48f4c6c29b2ded528083bc9adab99485e82bdb8ae8` |
| `TerrainShadowCaster.test.ts` | 10493 | `d4f10bffa7fbb865cd7d521f2aa070a60681fbf1f8c1639546be56e7eb7ab477` |
| `terrainShadowClip.ts` | 9758 | `360be4ca207e91a3e9286e879e4ce9bf6a3a033ebbbccc10426708a08f7cbdc7` |
| `TerrainShadow.test.ts` | 16399 | `f55158b8022edb6264815c5d70ceefee1304c77705006395d4f9c31575c84144` |
| `GPUSceneEngine.ts` | 74433 | `12a52a1d6f7426219cd9c1929f39de4c6e6f3bbf39acb0ff48cd55433b82ba93` |

## Integrazione verificata

- **Scene distinte:** `terrainMesh.ts:212` passa una nuova `Scene` al `TerrainShadow`; il mesh colore viene aggiunto soltanto alla scena privata del `TerrainMesh` a `:220`. Il `TerrainShadowCaster` aggiunge alla scena ombre soltanto il suo mesh. Non è presente il vecchio terreno insieme al nuovo carrier, quindi non vedo un doppio caster/depth sovrapposto nella costruzione attuale.
- **Geometria e vincitore:** `TerrainShadowCaster.ts:48–107` valida Float32 xyz e Uint32 completi, copia indice e posizioni senza alias e conserva winding e ordine. Una istanza corrisponde a una faccia, tre vertex invocation scelgono esattamente i tre corner tramite vertexIndex0/1/2; geometria non indicizzata con drawRange0/3. L'oggetto resta identità e FrontSide, senza vertexNode o depthNode. La selezione depth rimane quella del triangolo RAW rasterizzato; il minimum clippato viene assegnato soltanto al fragmentNode colore. Non si seleziona il massimo dei minimum.
- **Corner e coordinate:** i tre UVQ sono flat e dipendono dall'instanceIndex, non dal vertice carrier. XY usa cameraProjectionMatrix/cameraViewMatrix del draw; q mantiene dot(point−center,sun). Questo evita una seconda base XY arrotondata separatamente. `screenCoordinate.xy` è coordinata finestra secondo WebGPU nel Three186 locale (`ScreenNode.js:151–166`); il contratto resta target/viewport pieno origin0. `mapSize` viene aggiornato dalle dimensioni target prima del draw. L'equivalenza f32 effettiva fra percorso position e corner va ancora osservata nel compilato/GPU.
- **Derivate prima della divergenza:** `TerrainShadow.ts:151–154` costruisce il baseline con `toVar('terrainBaselineCasterMinimum')` e lo passa come argomento al clip. Il modulo clip non contiene dpdx/dpdy, texture sampling, discard o frag_depth. I branch/loop di clipping arrivano dopo la valutazione dell'argomento. La struttura è corretta staticamente; soltanto la compilazione del materiale effettivo potrà confermare il codice emesso e la validazione uniformity.
- **Fallback:** entry float prima dei helper per il parser Three; guard target/finitezza, determinant/area, incroci e capacità precedono accessi/scritture rischiosi. Il fallback restituisce il baseline già calcolato, non lit/clear. Le due array locali7vec3 e quattro passaggi bounded sono coerenti con l'intersezione convessa triangolo/quadrato. L'assenza di epsilon non rende ben condizionato ogni triangolo molto sottile; il percorso f32 resta da qualificare.
- **Cache e ripristino:** il miss invalida prima del clear, il finally ripristina override/target/MRT/clear/autoClear e il commit segue il finally. Epoch e identità input impediscono di cancellare invalidate/dispose durante draw/restore; versioni attachment finali sono memorizzate dopo il primo bind. Hit salta la mappa caster, mentre il colore terreno resta live. Non ho visto una nuova via stale introdotta dal collegamento del clip in un materiale immutabile per owner.
- **Ownership e cleanup:** l'owner shadow dispone target e caster; quest'ultimo rimuove solo il proprio mesh e dispone geometria packed/materiale, mai la sourceGeometry. I due StorageBufferAttribute sono anche attributi registrati della geometria: il Three186 locale `Geometries.js:187–239` elimina tutti gli attributi al dispose. `TerrainMesh.dispose()` chiude shadow prima della geometria originale. Listener target/attachment vengono rimossi prima del dispose e l'owner resta terminale.

## Un chiarimento utile prima di riusare l'API

Il caster è una **copia statica**, non una vista dei BufferAttribute sorgenti. Modificare in futuro i vertici, indici o trasformazioni del mesh colore e chiamare soltanto `shadow.invalidate()` ridisegnerebbe comunque i vecchi array packed. Occorrerebbe ricreare l'owner oppure implementare un aggiornamento esplicito dei buffer. Nell'integrazione attuale la mesh non muta, quindi non è un blocker del trial. Il commento generico “Call after any caster/world-bounds mutation” e la stringa ownership potrebbero però far credere che invalidate sincronizzi anche la sourceGeometry: sarebbe più preciso distinguere invalidazione contenuto target da ricostruzione della geometria statica.

## Costi e gate ancora aperti

Il nuovo caster aggiunge copie Uint32 e Float32vec4, tre vertici per ogni istanza e tre UVQ flat. Le statistiche dichiarano payload nominale, non residency/picco. Nei miss esistono ulteriori letture storage, varyings, clipping ALU e array locali con possibile pressione registri; la cache non li rende gratuiti durante cambi del Sole. Anche gli hit conservano calcolo frame/chiave e allocazioni CPU già presenti in v58. Nessuna previsione FPS ricavabile dalla sola lettura.

Prima di qualunque adozione rimangono: compilazione reale senza errori, corrispondenza dei corner e raw-depth winner, comportamento fallback/bordi/grazing sul dispositivo, immagini native nelle pose fissate inclusi i sei controlli fisicamente non schermati e gli oscuramenti veri, costo steady-state e miss/transizione. Il witness12 e la sua analisi offline non provano il raster GPU né l'assenza globale di false ombre. Un caster centrale per texel resta incapace di rappresentare coperture multifaccia complete.
