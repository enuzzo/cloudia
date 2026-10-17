# R2 annulusDEM — review statica integrata

17 ottobre2026. **PASS statico limitato, nessun blocker concreto individuato.** Nessun test, source-eval, mesh/modello, build oGPU eseguito da questa review. Il typecheckPASS è evidenza comunicata da root, non esecuzione indipendente.

Overlayfreeze `1d9418061285dd7ded2fd116816fe6de52763af80b59ac0b5ddc723a895f577e`: verificati3/3byte+SHA. Source143freeze `90c9ef5b1220e6caee248d54479c1d6c13d4884c2fef38fe60f6454bdd49a7a5`; pre-run159pin `4f24b742ef6663cfd16d5fd3ab9978b3922da29017d5b5a7cbf08ab5ed454a85` autenticati come file. Non dichiaro un ricontrollo indipendente di tutti159pin.

- `terrainSourcePatch.ts:23–44`: parametriEngineH48/I=fround(128*.256)/C=fround(94*.512) coerenti; J32.875 è strettamente fuoriI. Rowprefix distingue vertici strettamente interni omessi e celle della hole: indici121..647, source315736V/626296T. La stessa compressione è usata dalla query(:163–168); nessun collegamento attraverso la hole.
- `:58–98`: mantiene le facce actualinner/outer, rifiuta attraversamenti dei tagli, copiaXYZ/surfaceF32 e conserva ordine/winding nel prefisso percell originale. Catene sui soli segmenti±I/±C limitati anche nell’altra coordinata; ogni edge consecutivo e cornerID deve essere condiviso, inclusi midpointgreen.
- `:119–149`: entrambe le cuciture avanzano su catene monotone normalizzate, senza nuovi vertici. Orientazione positiva/count verificati; CSRperstrip da range proiettivi dei tre corner. Enumerazione locale con bin adiacenti e halo coerente con acceptance−1e−7, poi il chiamante applica la stessa bary/maxheight del lookup canonico. Il legacycelltable resta attivo perinner+outer: il camera clamp può interrogare la geometria composta senza un fallback silenzioso previsto dal progetto.
- `terrainMesh.ts:163–174,185–219`: patch dopo il refinement e prima dell’unico accumulo normali finali. OpzioneOFF lascia espressioni/ordine del vecchio builder e lookup invariati; niente shader/materiale/precisione/nuovo draw. Engine344–346 passa esattamente i3campi approvati. Le normali incidenti alle cuciture possono cambiare: nessuna identità shading promessa.
- Statistiche separano inner/source/outer/dueannuli e `prePatchRefinement`; sampleCalls include lavoro prepatch scartato più315736nuovi sample. `lookupBytes` comprende celltable/count, cellRows e CSR trattenuti. Cap geometry esplicito prima dei nuovi array finali, senza truncation; NON limita Map/Set/array preesistenti o peakRSS. Bound teorico indipendente889436V/1778870T/49808392B entrocap, non costo misurato.

Letti gli8test: OFF/undefined, compatibilità uniformeomittedI, triangoliinner/outer F32 esatti, quote/coast del sourceannulus e contatori, edgeincidence/corner/Euler/winding/normali, oracleindipendente su entrambe le cuciture e query senza sampler, input invalidi e3overflowbudget. TestOFF confronta due invocazioni del builder modificato: la parità indipendente colv61 resta affidata ai6hashA e stream storico del witness, come previsto. Il witness aggiunge tutti i vertici usati e manifold completo reali; fixturePASS non sostituisce questi gate.

Riletto witness dopo la correzione root: broadphase perasse2e−7*span+1e−10km;32probe unici prefissati sulle due midstrip, inclusi corner condivisi. Nearfit/holdout byteexactA; soltanto farholdout oltreJ entro1e−9metri dallo scalare. FingerprintXYZsurface inner/outer e query A/B confrontati nel launcher; no equivalenza al farfit o ai seam. Budget20CPU/30wall/1,5GiBterminali perchild/no retry e savedF64 completi rimangono da eseguire. R2 distinta da R1uniforme superseded: nessuna reinterpretazione del precedentePASS necessario o artPASS dedotto.

SHA dei sorgenti letti:
- `terrainSourcePatch.ts` `d27e8ed82b8e8ffab762b20d752c54e3ee5337138ad0c806b5bbc28372bb71e2`
- `terrainMesh.ts` `fe04355e93aa331092e545bc4e8d4012c9e6373a66b9a9c35bc3690505d81f8e`
- `terrainSourcePatch.test.ts` `612d71ddbbe1184eea1c50a476227d53feb5afd6926520b6d51652c451c8c18a`
- `GPUSceneEngine.ts` `e549f76942f312ddb95f133704168664eb33e7db36a8fae9b381e39fb73f3787` (ambito letto: createTerrain/config3campi).
