# Receiver fragment — review statica indipendente

17 ottobre2026. Sola lettura della snapshot esterna `cycle31/fragment-source`, nessun test, build, raycast, modello, browser o GPU. **Nessun ulteriore blocker trovato per il run fissato con terreno attivo**, dopo la correzione sentinel indicata sotto. Non è un PASS numerico o artistico.

## Core TerrainMesh / TerrainShadow

- Il diagnostic WGSL deriva dal testo live tramite quattro sostituzioni ciascuna con un solo anchor obbligatorio: nome/tipo/return. Mantiene coordinate, radial offset, floor, textureLoad, confronto e fade; usa gli stessi uniform posseduti da TerrainShadow. Non ricostruisce una seconda base Sole CPU. L'output RG è grid continuo prima del floor, B qLookup e A visibility; non contiene faceID caster.
- La camera resta quella ordinaria a dimensioni native. Una sola bbox-scissor draw, massimo1100000pixel: non12draw né target1×1/camera ritagliata. Il target RGBA32F/depth32 esistente viene riusato. Lo scissor limita frammenti, non l'unico attraversamento della geometria nei vertici; inoltre il ramo ordinary è valutato prima dell'override, quindi questa non è una modalità dal costo di12soli lookup.
- La sequenza sincrona è corretta:12copie originali, shadow cache/camera,1draw debug,12copie debug, mode0 e draw terreno ordinario completo, ripristino stato, **poi** primo await. Nel Three186 locale copyTextureToBuffer submit la copia prima di mapAsync (`WebGPUTextureUtils.js:803–860`); le successive riscritture del target non alterano le copie già accodate. Il clear è dell'intero attachment e il codice lo tratta così; il redraw normale ricopre l'intero target prima dell'attesa.
- `target.scissor` più `renderer.setScissorTest` corrispondono al percorso locale Renderer:1763–1790. Scissor del target e del CanvasTarget, MRT, target precedente, clear/depth e autoClear vengono ripristinati. L'errore del draw debug passa comunque nel tentativo di redraw ordinario. Tutte le copie già inviate vengono drenate con allSettled prima di togliere diagnosticBusy.
- Il frame owner salta il rendering mentre diagnosticActive. La geometry/attribute/index restano condivise e non sono clonate/disposte; versioni e identità sono verificate nel risultato. Il normale fragment mantiene dipendenze/varying e valuta materiale/derivate prima dell'If del mode. Uniform mode appartiene all'objectGroup predefinito: NodeManager.updateGroup aggiorna quel gruppo ad ogni oggetto/render, non soltanto una volta per frame. Resta una **variante diagnostica**, senza promessa automatica di pipeline originale byte-identica.

## Difetto trovato e risolto prima GPU

Il primo clear usava RGB=-1000000 e alpha=-1000000. Three Renderer default alpha=true e WebGPUBackend.getClearColor:1691–1703 premoltiplica RGB per alpha: il clear effettivo non coincideva con il test all−1000000. La versione finale letta usa alpha1 e expectedRGBA esplicito `[-1000000,-1000000,-1000000,1]`; il test piccolo ora contiene anche quel record clear. Il gate owner sugli address fuori range era già failclosed, ma l'etichetta sentinel precedente era errata. Non ho eseguito il test né verificato il clear su GPU.

## Wrapper / UI / lifecycle

- Root usa `point.uv[0/1]` e conserva le12selezioni storiche; gli address shadow derivano dal gridRGBA restituito, non dalla precedente reference CPU. Le letture R32F sono deduplicate e drenate con allSettled prima di report/errore. Formato e lunghezza richiedono rispettivamente4 e1 Float32 finiti.
- Owner busy esclude export/misure e il job è atteso dal release prima della distruzione GPU. Generation/fingerprint, cache valid/submissions/epoch, target e geometry qualificano la stabilità; fuori da quei contratti il report è non qualificato. Il materiale ordinario e il target sono già ripristinati mentre arrivano i readback.
- Pulsante e textarea sono visibili soltanto profile+witness; App proietta soltanto il reportKind receiver previsto. Il testo dichiara no original fragment identity, caster winner-ID, RGB causality, physical terrain o FPS. I piccoli lifecycle test letti coprono il gate prima delle letture, non sostituiscono una prova del nuovo percorso GPU.
- Cautela ground risolta nel wrapper finale: `renderTerrain()` salta il draw con ground<=.001, perciò le copie originalRGBA potevano essere vecchie. Il nuovo guard owner rifiuta ora ground<=.001 prima di impostare busy; non presenta un target preesistente come backdrop corrente. La correzione è stata letta, senza ripetere altri audit.

Il native PNG mode0 prima/dopo resta necessario per verificare il ripristino e l'eventuale effetto della variante sul frame ordinario. I nuovi q/grid/visibility possono spiegare o falsificare il solo mapping receiver dei12punti; non attribuiscono le macchie RGB e non identificano il caster che vinse il raster.

## Hash dei byte letti alla chiusura

| File sotto fragment-source/src/cumulonimbus | SHA256 |
| --- | --- |
| TerrainShadow.ts | 24be5945543af58a4e8c0df797da9116d924f3dc995204fe5fcb21de4b97831e |
| terrainMesh.ts | 696d89288a2fc8973884dfcef04b4ef4854ce5c49f29e660d2c047d13faa56f9 |
| TerrainShadow.test.ts | 94548c6c961ae03cbf2a3a3fbe9f97e321d9f039d44568a47b7b8301dad0c4c5 |
| GPUSceneEngine.ts | 15b192397706f5a463046c2b4eaf3a71b8d1988a1e0019aa15f316125c4fe210 |
| CumulonimbusApp.ts | 44c51aee1142284985315aefa062d0eb553a7a9890a7875d7c12722d0eccd00f |
| sceneMarkup.ts | 4fcd11af601ea49c12db3b2bf4eadf78206f022460cb1a36fef6cf97233e7e4c |
| lifecycle.test.ts | 989615d73d3d58378393972e41fc11aaabfff380b5ec843791e97a3dbec31a27 |
