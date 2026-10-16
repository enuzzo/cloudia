# Trial clipping R1 — review statica della divergenza GPU/CPU

16 ottobre 2026. **Nessun difetto API/proiezione confermato dalla sola lettura. Il FAIL visivo del root resta aperto: nuovi puntini diffusi e nessuna correzione visibile ai punti selezionati.** Non inferire dal solo RGB identico che il nuovo minimum non sia stato calcolato. Nessun runtime, shader o test modificato; nessuna esecuzione GPU/browser/test/build in questa review.

Fonti effettivamente lette: `candidate-source/src/cumulonimbus/{TerrainShadowCaster.ts,TerrainShadow.ts,terrainShadowClip.ts,terrainMesh.ts,terrainSurface.ts}`, `browser/native-comparison.json`, `positive-witness/result.json` e sorgenti pinned Three186 sotto `candidate-source/node_modules/three/src`. L’immagine nativa è `browser/trial-main-sun-terrain-native.png`; il giudizio sui nuovi puntini è quello riportato dal root, non una nuova qualifica visiva di questo reviewer. Il confronto salvato riporta 76544 pixel cambiati, delta RGB da −57 a +17, tutti i dodici pixel fissi identici. Questi sono dati RGB, non readback di shadow visibility.

## Prima distinzione: RGB identico può essere corretto

Il materiale (`terrainSurface.ts:190–203`) usa una normale interpolata/normalizzata e perturbata; `diffuse=max(0,dot(n,sun))`. La shadow visibility moltiplica soltanto `solar*.90*diffuse` del ground. Ambient, inlandWater e sea non vengono oscurati da quel fattore. Inoltre la radiance finale attraversa aerial/cloud/film e quantizzazione PNG.

Nei record CPU i tre controlli che il clipping dovrebbe trasformare da lit a shadow hanno **normalDotSun geometrico negativo**: L1-control −0.1102466053, L2-control −0.0532354287, L3-control −0.0882563883. È quindi plausibile che una diversa visibility sia mascherata da un diretto nullo/debole. Non è dimostrato che il dot della normale SHADER sia identicamente negativo: quella geometrica del witness non è l’attributo interpolato con roughness. C1-ocean, invece, attraversa il ramo sea che non usa il cast visibility.

Gli altri tre punti artifact erano già CPU-shadow sia prima sia dopo; i sei positivi restano CPU-lit in entrambi. **Non è dunque valido pretendere un cambiamento RGB in tutti12 come gate dell’esecuzione del nuovo caster.** Il readback R32F dei texel indirizzati è la prima discriminazione corretta; il FAIL artistico globale non viene annullato da questa osservazione.

## Catena API letta: nessun errore macroscopico trovato

- `TerrainShadowCaster.ts:61–87`: indici copiati Uint32, posizioni copiate Float32 vec4 con xyz invariati/w1, wrapper storage separati dal colore; nessun alias del BufferAttribute colore o padding vec3 implicito. La geometria non è indicizzata, position dummy reale count3, drawRange0/3 e instanceCount=T.
- `:88–101`: per ogni istanza legge gli stessi tre index `3*instanceIndex+k`, tre corner; vertexIndex0/1/2 sceglie la posizione. Tutti e tre i vec3 UVQ flat dipendono dagli stessi tre corner, non dal corner corrente. Ordine indici e FrontSide restano quelli di input. Le due costanti interpolation sono realmente `flat` ed `either` in Three186.
- `RenderObject.js:614–631,653–674` e `WebGPUBackend.js:2194`: questo caso usa instanceCount della InstancedBufferGeometry e draw non indicizzato `(3,T,0,0)`. `IndexNode.js:58–100` e `WGSLNodeBuilder.js:1489–1555` mappano ai builtin vertex_index/instance_index. Non è il caso vietato di dividere vertexIndex della vecchia mesh indicizzata per tre.
- `TerrainShadow.ts:151–154`: baseline toVar prima della funzione clipping; mapSize aggiornato alle dimensioni target al miss (`:190`). Il clip module riceve screenCoordinate, non UV della camera principale. `ScreenNode.js:149–165` usa frag coordinate e `WGSLNodeBuilder.js:1670–1673` ritorna isFlipY=false: nessuna seconda inversione Y appare qui. La conversione UV è top-origin `.5−.5*clipY/clipW`, coerente col texel.
- `terrainMesh.ts:212` crea una scena shadow separata; il nuovo mesh resta identity, non InstancedMesh. La posizione custom non riceve un instanceMatrix aggiuntivo (`NodeMaterial.js:793–806`). Nessun depthNode/frag_depth deriva dal minimum. Raw-depth e R32F restano canali semanticamente separati.

Questa lettura dimostra intenzione/API supportata, non il WGSL effettivamente eseguito né i dati caricati dalla GPU.

## Ipotesi residue e falsificazione

| Ipotesi | Fonte/limite concreto | Osservazione che la distingue |
| --- | --- | --- |
| R32F corretto, RGB mascherato dal materiale | Direttivo ground moltiplicato per diffuse; tre normalDotSun CPU negativi | R32F ai tre texel coincide col minimum clipped previsto e supera la soglia qlookup, mentre RGB resta uguale. Non serve cambiare proiezione per quel dato. Per la causa esatta del masking occorrerebbe il diretto/n shader effettivo, non quello geometrico CPU. |
| Fallback o valore diverso nel fragment | Clip torna al baseline per empty/degenerate/numerical/overflow; f32 può differire ai bordi | R32F prossimo al baseline anziché al clipped richiede separare fallback da caster/winner diverso. R32F da solo non fornisce valid/reason o faceID; non chiamarlo automaticamente bug di matrice. |
| Due espressioni di proiezione/posizione divergono nel shader generato | UVQ usa `projection*(view*P)`; raster usa positionNode→positionLocal→modelViewMatrix→positionView→projection (`NodeMaterial.js:724–806`) | Con mesh identity, view/projection camera uguali e ordinario modelView=view*modelWorld, sono algebricamente coerenti. Captured WGSL deve mostrare corner/positionLocal, modelWorld identity, stesse uniform camera e tre flat UVQ. Se questi sono corretti, non assumere che normali scarti f32 spieghino margini di decine di metri senza misurarli. |
| SubBuild/variabile o payload flat non corrisponde al raster | positionNode viene subBuild POSITION; varying usa VERTEX. `.toVar` e nomi non sono una prova del valore assegnato in ciascun contesto | `VaryingNode.js:122–189`, `SubBuildNode.js:49–79`, `NodeBuilder.js:2128–2155,3087–3118` gestiscono contesti/nomi separati: nessun alias scorretto dimostrato. Nel WGSL reale verificare assegnazione dei tre corner e varying prima dell’uso, storage index per istanza e tutti e tre flat. Solo un payload/output osservato può confermare un errore concreto. |
| Minimum calcolato correttamente ma modello insufficiente per i nuovi puntini | Un unico caster vincente al centro rappresenta tutto il texel; il lookup può cadere fuori da quella faccia | Anche un perfetto R32F del caster scelto non dimostra la visibilità del receiver su un’altra porzione/faccia. Nuovi puntini possono essere un limite del modello, non un errore TSL. I dodici casi selezionati non qualificano la frequenza globale dei falsi shadow. |

Il modelView di default è `cameraViewMatrix*modelWorldMatrix` (`ModelNode.js:128–142`); highPrecision può sostituirlo tramite context (`Renderer.js:1261–1288`), ma il motore letto non imposta highPrecision. Camera view e projection sono uniform aggiornate sulla camera del render (`Camera.js:92,188`). Quindi non è giustificato dichiarare già errato l’uso di cameraProjection/cameraView. Restano scarti f32, FMA, quantizzazione di copertura, pareggi depth e possibile caster centrale diverso dal raycast Float64.

## Lettura minima del prossimo readback del root

Conservare coordinate intere dei texel dalla fixture, valori R32F RAW e bit, identificazione del target/owner, luce/mapSize e prova di un draw/cold cache valido. Per ciascun punto confrontare separatamente baseline affine CPU, minimum clipped CPU, qlookup CPU e classificazione fisica già salvata. Non confrontare il R32F con q del blocker fisico come se fossero lo stesso raggio UV: il witness documenta che possono essere facce/raggi diversi.

Se il R32F concorda col clipped, la diagnosi passa a receiver/materiale o limite multifaccia; se concorda col baseline, serve reason/winner prima di una riparazione; se non concorda con nessuno, i dati effettivi di corner, matrici e faceID sono il passo discriminante. Non serve cambiare adesso formula, epsilon, bias o luce. Il readback dei soli12 è diagnostico, non annulla i nuovi puntini né autorizza adozione o FPS claim.
