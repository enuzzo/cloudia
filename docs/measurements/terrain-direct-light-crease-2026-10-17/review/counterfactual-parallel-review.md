# Controfattuale ombre — review statica indipendente

17 ottobre2026. Sola lettura, nessuna esecuzione/test/build/raggio/browser/GPU. **Nessun blocker residuo trovato per il run fissato.** Questa nota riguarda il source congelato prima della GPU; non interpreta il successivo risultato comunicato dal root.

- `probeShadowReceivers(..., 'force-lit')` assegna mode2; soltanto l'argomento solarVisibility della shade diventa1. `select(cond,if,else)` è l'ordine reale di ConditionalNode Three186, quindi mode0/1 mantengono liveVisibility. Mode1 soltanto sostituisce l'output con grid/q/visibility. Materiale completo, noise, normal rough, texture e derivate restano fuori dall'If lookup.
- TerrainShadow.ts/WGSL lookup sono byte-identici al ciclo31. Geometria, camera/proiezione, viewport, depth/FrontSide e la distanza alpha non cambiano fra mode0 e mode2. Non ci sono gain/threshold adattati all'immagine né nuovo bake/cache. La pipeline è configurata una volta con uniform mode, senza needsUpdate per passaggio; questo non promette identità col frammento originale v59.
- Restano12copie live→un draw bbox→12copie forced-lit→mode0/fullordinary redraw e restore **prima del primo await**; allSettled e diagnosticBusy fino al drain. Target esistente, sentinella alpha1 e expectedRGBA corretti. Il wrapper esclude ora esplicitamente `row.debugIsClear` prima della validità RGB/alpha: non può classificare come completo un clear con A1 nemmeno se la distanza live fosse1km.
- Owner richiede profilo/witness, terreno attivo, pausa/cielo settled, ready/visibilità e nessun export/benchmark concorrente. Generazione/fingerprint/cache/target/geometry qualificano il risultato; release attende il job. Pulsante/textarea sono visibili e la proiezione App seleziona il reportKind corretto.
- Il wrapper conserva entrambe le RGBA, bit Float32, deltaRGB senza fattore e contrasti delle tre coppie nello stesso ordine fisso. Richiede tutte12finite, alpha>=0 e identica. `rgbIdentical` è uguaglianza numerica JS; i campi bit separati permettono anche di distinguere zero firmato. Un delta nullo non separa albedo, normale, ambient o acqua e non qualifica tutta la patch, il Sole fisico, FPS o fotorealismo.

Native mode0 prima/dopo e console restano gate separati del ripristino. I test mock nuovi esercitano sequenza/mode/drain, non la risposta di una pipeline GPU reale.

## Byte letti alla chiusura

- `TerrainShadow.ts` — SHA256 `24be5945543af58a4e8c0df797da9116d924f3dc995204fe5fcb21de4b97831e`.
- `terrainMesh.ts` — SHA256 `289a4f59aef7babc8adaf78cad1feaaa2217b14b49fe8604facbcdeb32bace05`.
- `TerrainShadow.test.ts` — SHA256 `735321ddfeca10e038de6f7c3e55d557e593d81a04f09454aeea94db2e009d5b`.
- `GPUSceneEngine.ts` — SHA256 `0442514e17daa2ac5aa9ef43ce1ab910f0444a14faedec5bb381d1f933cae383`.
- `CumulonimbusApp.ts` — SHA256 `85b25449ca3515ebbe8c4f884332d5a2d9096c521a5cbc2388c6924f555bc364`.
- `sceneMarkup.ts` — SHA256 `55f16fa18b79c2ddad16606aef0345b95fa3720c1b53af58722781b0ec709272`.
- `lifecycle.test.ts` — SHA256 `17d8557b5497b9b190307e1a4b63e09c91090fe49688d52cf79c4979b5377c86`.
