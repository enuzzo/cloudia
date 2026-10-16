# Review indipendente readback ombre — ciclo 27

**Esito: interpretazione circoscritta coerente; nessun nuovo motivo di adozione.** Review dei soli quattro JSON indicati dal root e del contratto `GPUSceneEngine.ts` nella snapshot diagnostica. Nessun Bun, test, raggio, mesh, build, GPU o browser eseguito. Soltanto lettura/hash e consistenza leggera dei JSON, più questa nota esterna.

## Provenienza

| File sotto `gpu-readback` | Byte | SHA-256 |
|---|---:|---|
| `report.json` | 12006 | `9f3dcf1c340c6b07e0b692460f1e0c7eeec02141a6420a1cd8e799810174deb8` |
| `analysis.json` | 6168 | `44663f46d8b97143c76e263871a49fee861be388d66f37ea9eb6b8ff16f324b0` |
| `native-metadata.json` | 11258 | `c6ee938a1264c09a63dcc3dc20030b18c56be204086d7b5b801903822c37c0cb` |
| `source-manifest.json` | 13500 | `4a5bea3762a06d9f3b1c9418d5995a879c11079aec57784c9b28a76e2dcef887` |

Il manifest contiene 128 dichiarazioni. È stato confrontato soltanto l'engine diagnostico letto: SHA `a209de22efd6a60dcd91270f4283b25e9e73ec9f8b93787547ccc699c9ab3fbf`, coincidente con la sua voce nel manifest. Non viene dichiarata una nuova verifica di tutte le 128 sorgenti. Il report fissa il witness CPU SHA `f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc`, uguale all'unico run da 12 pixel del ciclo27 già congelato.

## Dati osservati e contratto della sonda

`GPUSceneEngine.ts:597–623` richiede profile+shadowProbe espliciti, owner pronto, nessun export o benchmark attivo, scena in pausa e cielo assestato. Copia gli indirizzi fissati tramite `readRenderTargetPixelsAsync(target,x,y,1,1)`. La Map deduplica i due record L2 riferiti a `[1011,1235]`: sono **12 record ma 11 texel distinti**, non 12 misure spaziali indipendenti. Ogni texel restituisce un Float32 finito, un elemento, con bit u32 coerenti; il valore L2 condiviso è identico nei due record. Coordinate e riferimenti CPU restano quelli letterali del witness, senza raycast in questa diagnostica.

Il flag `stableShadowDuringRead=true` è coerente con il contratto a `:618`: stesso owner/target, cache valida prima e dopo, submissions 1→1, epoch 0→0 e Sole esattamente invariato. Requests 9100→9104 e hits 9099→9103 mostrano che il normale rAF è proseguito, ma soltanto con hit della mappa ombre. Non è una sospensione globale né un hash dell'intera texture; vale entro il contratto statico/target esclusivo. I guard dopo await evitano pubblicazione dopo destroy/deviceLost/releaseGPU; il finally libera busy.

Il report legge il **colore R32F della shadow map**, non il depth32, q del receiver, visibility effettiva del fragment, indice faccia vincente, UVQ dei corner o validità/reason del clipping. `uniformScope` indica già valori JS inviati agli uniform, senza readback f32 dei receiver. La presenza di reportKind/scope specifici evita di chiamare questa operazione PNG o misura FPS.

## Confronto scalare riproducibile dai JSON

La regola verificata è esclusivamente `qLookupCPU >= heightGPU` sugli indirizzi CPU salvati.

| Gruppo dal raggio fisico CPU | Confronto illuminato | Confronto schermato |
|---|---:|---:|
| Sei punti con blocker CPU | 3 | 3 |
| Sei Ck non schermati nell'intera mesh CPU | 6 | 0 |

I tre confronti illuminati fra i punti CPU bloccati sono L1-control, L2-control e L3-control. Le classificazioni e tutte le differenze metri in `analysis.json` corrispondono ai valori del report. Questo **non** equivale a leggere tre false illuminazioni dal fragment GPU: il ricevitore e l'indirizzo effettivo GPU non sono stati catturati. Analogamente zero confronti schermati sui sei Ck non costituisce garanzia globale di assenza di false ombre GPU.

L'altezza GPU è spesso vicina al vecchio minimo affine e distante dal minimo clippato CPU; ciò descrive una differenza, non prova l'esecuzione del fallback. Un diverso winner raster, corner/matrici/edge f32 o altro percorso di produzione del valore non è distinto dai dati letti. C1 differisce di circa +35 m anche dal baseline CPU: il fatto che resti illuminato non risolve l'identità del suo caster. Nessuna causa dei puntini è inferibile da queste sole altezze.

## PNG e controesempio separato

`native-metadata.json` dichiara PNG 2474×1844, 2989801 B, SHA `576b35cc44d09b7fe271bbec942dc9f9cd4d0a5105a82dafd17b43ffb766bdc6`. Camera, material, weather, lighting, skyTextures, qualità a 384 passi, output/internal, pausa e ablation coincidono fra metadati PNG e readback; seriali/tempi di cattura e contatori possono differire. Il root riferisce lo stesso SHA della PNG trialR1. Nei quattro file non esiste un secondo payload R1 indipendente da ricomparare: questa review non ha riletto le PNG. L'identità comunicata non spiega perché l'immagine sia invariata e non certifica quale ramo abbia scritto la mappa.

Il controesempio software a un caso con falsa ombra di 5,75 m è evidenza separata comunicata dal root, non contenuta nei quattro payload autorizzati e non ricalcolata qui. Anche assumendolo verificato dal suo archivio, dimostra il limite intrinseco di un caster centrale/un valore per texel; non identifica quel caso nell'immagine reale né attribuisce i puntini. I sei controlli Ck del witness non annullano un controesempio diverso.

Conclusione operativa: conservare readback, controesempio e PNG come evidenze distinte. Nessuna attribuzione a fallback/winner, nessuna promessa che clipping risolva la scena e nessun PASS artistico o prestazionale derivano da questa review. Nessun cambiamento prodotto effettuato.
