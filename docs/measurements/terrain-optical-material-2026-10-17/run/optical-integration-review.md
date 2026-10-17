# Revisione statica indipendente — integrazione ottica R2

Esito: **PASS statico, nessun blocco concreto rilevato**. Revisione della snapshot esterna `optical-source`, non adozione del materiale. Nessun test, build, modello, GPU o browser eseguito dal revisore. I dati in `optical-data` restano congelati.

Manifest R2 verificato per SHA-256: `9dc5ff28c7a809f1a09167ac5ca9893ec10f76f07ee21cd7ca9a469ac84599e3`. Il precedente errore TypeScript R1 sullo spread dei binding è risolto nella R2 con `Record<string,Node>`; la modifica è soltanto tipologica. Il coordinatore riferisce 553 test in 52 file, typecheck e build APP→hero PASS; non sono esecuzioni di questa revisione.

## Contratto ordinario e isolamento

- `GPUSceneEngine.ts:217,333–342`: attivazione immutabile solo con `profile=1&optical=1`. Con flag falso non viene caricato l'asset, non nasce il nodo texture ottico e lo spread aggiunge zero binding.
- `terrainOpticalRaster.ts:4–22`: il wrapper falso coincide byte per byte con il wrapper canonico v60: 1068 byte, SHA-256 `ab6615fdad7ba034bd1f081806d8ee9716de2dff7073586c1887508a93211318`. La factory materiale falsa restituisce direttamente `TERRAIN_SURFACE_WGSL`.
- `terrainSurface.ts`, `cloudShader.ts`, `volume.ts`, `terrainMesh.ts` e `TerrainShadow.ts` coincidono con i rispettivi hash della base129: geometria GLO90/125 m, nuvole, qualità e shadow shader invariati. La parità testuale non certifica il codegen GPU. Separatamente il coordinatore riferisce per la A ordinaria R2 il digest full-target `e443…` e alpha `29a4…` canonici; la cattura nativa è ancora in corso al momento della nota.

## Formula, coordinate e risorse

La variante aggiunge **un solo `textureSample`** nel wrapper, alle stesse UV geografiche WorldCover `(point.xz+64)/128`, prima delle deformazioni procedurali del materiale. Nessun lookup aggiunto nella libreria materiale. Il blend core 48–64 km è già incorporato nei pesi cover; non viene applicato una seconda volta.

La formula è `U + (1-v)*P + K*Q.rgb`, dove `Q=(RGB*v,v)` è premoltiplicato, `P` è la palette delle sole classi terrestri note e `K` la loro somma. `K` compare una volta; `Q.rgb` non viene rimoltiplicato per validità. Unknown conserva authored, acqua interna e mare seguono i rami canonici. Illuminazione, normali e shadow restano identici. Nessun gain, gamma, divisione per alpha o de-lighting introdotto.

`terrainOptical.ts:66–132` verifica dimensione fissa, SHA e half finiti compatibili con `0≤RGB≤A≤1` prima della texture. RGBA16F little-endian, NoColorSpace, clamp, `flipY=false`, niente ulteriore premoltiplicazione, filtri lineari e mip automatiche. Asset: 33.554.432 byte, SHA `217325bcdb50dd58076b2f5068ee0b5ba524f6f076a70d4345f279f233f5dd62`. Payload mip nominale aggiuntivo 11.184.808 byte, totale nominale 44.739.240 byte: non è una misura di memoria driver o tempo GPU.

Start usa lo stesso AbortSignal e controlla teardown dopo await; un risultato arrivato tardi viene disposto. Errore di caricamento/autenticazione non ripiega sulla palette. Release dispone l'owner ottico e azzera il riferimento; dispose è idempotente. Il descriptor della cache include la texture ottica quando presente, oltre a cover e colori di luce. Nessun aggiornamento ottico per frame è introdotto.

## Limiti e provenienza

L'annual median L2A contiene illuminazione e ombre osservate: non è albedo fisico e può produrre doppia illuminazione. Credibilità, bordi/mip, orientazione visiva, meteo e costo in navigazione richiedono la qualifica nativa/FPS separata. Questa nota non assegna PASS artistico né prestazionale. Il valore RSS dello script geometrico Bun moltiplicato per 1024 non è utilizzabile come RSS qualificato su questo Mac: resta raw con unità non stabilita, senza RSS PASS.

Hash delle sorgenti lette:

| File | SHA-256 |
| --- | --- |
| GPUSceneEngine.ts | `4cb0dab62b209dc8412033ec7d321370d890c0dfbf21731eebb2426166a6326a` |
| terrainOpticalRaster.ts | `339ceec6a03d273f2e24538d42456f608fc18d8bcfc89ecaf972965e25f75e99` |
| terrainOpticalMaterial.ts | `78f80bc90be7be9fcc4fbcccb7908fa680b9de1ed67e2348117431c240d083e8` |
| terrainOptical.ts | `e3bfc4994d8ab80a8de1bc9b61b63ca6580ce103a705b531b395de6661848370` |
