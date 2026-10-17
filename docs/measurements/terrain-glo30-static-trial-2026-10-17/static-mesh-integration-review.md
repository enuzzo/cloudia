# Review statica dell'integrazione mesh GLO30

17 ottobre2026. Sola lettura del candidato effettivo e confronto con i129 hash
v60 di `base-manifest.json`; nessun test, build, modello o GPU eseguito.
**Nessun difetto concreto bloccante rilevato nella revisione esaminata.**

- **Start e annullamento.** `GPUSceneEngine.ts:254–265` carica bundle e WorldCover
  con lo stesso AbortSignal. Il controllo destroyed/deviceLost precede
  l'assegnazione dei dati e l'allocazione delle texture; volume/nube iniziano
  soltanto dopo entrambi i dati. HTTP, SHA o decode falliti entrano nel catch e
  in releaseGPU, senza percorso alternativo di generazione del terreno.
  `releaseGPU:948–964` abortisce la richiesta, attende i lavori GPU già previsti,
  dispone raster/cover e azzera sia owner sia riferimento ai dati statici.
  Il risultato tardivo non viene installato dopo teardown.
- **Risorsa effettiva.** `measuredTerrainMesh.ts` usa URL Vite statico con
  `.href` e SHA256 fissato `59fc118c9676fffd2b96ac1d52ed04cc5fe4a34bf06e1e1c3069562b3690a831`.
  Il risultato dell'encode salvato riferisce37639536B, sei array e stats
  identici al preflight. Questa review legge quel risultato, senza ripetere
  roundtrip o costruzione. Il loader autentica SHA prima del decode, limita
  stream/layout/payload, cancella il reader in errore o abort, controlla abort
  anche dopo digest e rilascia il lock. Il backing buffer passa per contratto
  in proprietà esclusiva ai sei view, senza copie per array o alias al vecchio DEM.
- **Nessun rebuild.** `terrainMesh.ts:410–412` sceglie `configuration.data`
  prima del builder e rifiuta combinazioni con sample/refinement/celle/livelli/
  spacing/normalMode. Engine passa soltanto data, shade e descriptor cache.
  BufferAttribute, indice, stats e lookup CPU ricevono direttamente gli array
  caricati; `surfaceY` continua a interrogare la mesh effettiva. I dati sono
  prevalidati dal codec, non ricampionati dal costruttore.
- **Cache e risorse per frame.** Il diff di terrainMesh aggiunge soltanto
  l'ingresso data e il controllo di ambiguità. Chiave cache, invalidazioni,
  resize, shadow, material WGSL, target, draw e dispose restano byte identici.
  Il descriptor Engine rimane solarColor+ambientColor e le due texture cover;
  il sole continua a essere argomento render. Nessun sampler DEM è inserito
  nel frame. Non ne consegue un risparmio GPU o un valore FPS misurato.
- **Copertura e provenienza.** Metadata dichiarano GLO30 AWS2021, passo fonte
  62,5m, origine44N/10E, X Ovest/Z Nord, core±48km, raccordo48–64 e quota1×.
  Descrivono costruzione offline e SHA del bundle; coast rimane quella canonica
  GLO90/125m campionata ai vertici, con limite esplicito sulla nuova
  interpolazione raster. WorldCover continua con extent128km verificato e
  shader/mips/frazioni identici. Il notice aggiunge credito/disclaimer GLO30 e
  `public/COP-DEM-GLO30-F-license.pdf` effettivamente presente113786B, preservando
  GLO90 e WorldCover; non presenta DSM come terreno nudo o mesh uniforme62,5m.
- **Contratti dei test letti.** Lifecycle sposta il mock al nuovo loader con
  fixture piccola, conserva404/abort/late-resolution/no-cloud-allocation e
  verifica identità della risorsa passata e assenza degli input builder.
  I due integration test verificano view/lookup diretti e conflitti di config.
  I test codec includono SHA/HTTP/cap/cancellazione e layout, senza fallback.
  Questo è esame delle asserzioni, non dichiarazione del loro esito.

Confronto dei pin: cambiano soltanto quattro file esistenti:
`GPUSceneEngine.ts`, `terrainMesh.ts`, `lifecycle.test.ts`, `public/terrain-data-notice.txt`.
I nuovi moduli/fixture sono `terrainMeshAsset.ts`, `measuredTerrainMesh.ts`,
`terrainMeshAsset.test.ts`, `terrainMeshAssetIntegration.test.ts`, oltre a bundle
e licenza. **volume.ts, cloudShader.ts, terrainSurface.ts, TerrainShadow.ts,
terrainCover.ts, terrainCoverTextures.ts e CumulonimbusApp.ts coincidono con v60.**
Il diff Engine non cambia costanti qualità256³/128³/384, integratore o shader
terreno: modifica caricamento, identità/versione/metadata e rilascio dei dati.

Revisione letta, SHA256:

| File | SHA256 |
|---|---|
|GPUSceneEngine.ts|`11a1977fdddf79bfb2c23dd3ef218eddbe2eeda33a32e5424ca9adeabf232ea6`|
|terrainMesh.ts|`e00cc382d8056f158c00a43431af40b856adf18816e957edca727177f89a082a`|
|terrainMeshAsset.ts|`fc7cd6045db25589ccc0db7860838f2684ec8cd52e6dda17481cac6190d96f67`|
|measuredTerrainMesh.ts|`13aabbe6f2e8d7fb2a1332424fdac35211355c452a1c2ed6afabfd4cbe61e97b`|
|lifecycle.test.ts|`54b08130efebcd15582e60a8d130f79ab39dd11a03a7d00fe14bb959f356e763`|
|terrainMeshAssetIntegration.test.ts|`638d92c50cf9cd4423986e70fbca42816990974d24eaa697301298038b55844f`|
|terrainMeshAsset.test.ts|`adac0af99dddcfe6c3bdbdb40ff08848651f60db290e3d9caa02fd552bb28559`|
|terrain-data-notice.txt|`c176b9cffafbc5a462e2f977bdea9c0e4367792f38b464b8ae2883a1540e81ba`|

Percorso: `cycle35/candidate-source/`. Qualifica eseguibile, risoluzione degli
asset APP/hero/worker e giudizio nativo restano evidenze root separate.
