# Candidato FPS: riuso esatto del target terreno già esistente

17 ottobre 2026 — audit statico del prodotto canonico **observatory-v59-terrain-source-refinement**. Nessun runtime, test, build, benchmark, GPU, browser, installazione, Git o modifica prodotto eseguiti. Proposta soltanto; 60 FPS stabili a 256³/128³/384 e output pieno restano aperti.

**Un candidato: evitare clear/draw del terreno colore+distanza quando tutti i suoi input sono identici, conservando il target corrente.** Non cambiare WGSL, mesh, texture, precisione, sampling o numero di passi della nube. La nube/pioggia continuano a integrare ogni frame e leggono lo stesso target.

## Causa verificata e perimetro

`GPUSceneEngine.renderTerrain()` (335–338), richiamata dal frame a507, passa camera effettiva e sole. `TerrainMesh.render()` (374–389) aggiorna la shadow cache, poi cancella e ridisegna sempre il target RGBA32F+depth32. `stats()` a399 dichiara esplicitamente assenza di cache per questo pass. La mesh v59 ha **591.788 vertici / 1.182.550 triangoli**: dati pubblicati in `docs/TERRAIN-SOURCE-REFINEMENT-2026-10-16.md:25–29`, senza nuova ricostruzione.

La shade closure concreta (`GPUSceneEngine.createTerrain`,315–333) dipende da posizione/normale/height/coast/distanza/derivate, sole, solarColor, ambientColor, shadowVisibility e due WorldCover. `terrainSurfaceMaterial` (terrainSurface.ts:160–203) non legge tempo nube, precipitazione, vento o flash. Aerial/sky/film restano nel cloud integrator (`cloudShader.ts:43–53`) e sono rivalutati live. Quindi una camera realmente ferma e una luce assestata possono consentire hit **anche con cloud/rain animation attiva**. Orbit, navigazione/approach che cambiano la camera, resize e transizioni luminose producono miss; non congelarli per ottenere un hit.

## Modifica minima implementabile e contratto

Estendere l'owner TerrainMesh con entry valida e invalidazione esplicita; Engine deve fornire le dipendenze della propria shade closure. **TerrainMesh non può dedurre uniform arbitrarie catturate dalla callback `configuration.shade`**: senza descrittore/revisione di shading esplicito il default deve restare il draw live.

Chiave conservativa, uguaglianza esatta senza epsilon: renderer/backend/reverse-depth; tutti i valori camera applicati (origine, forward/right/up, aspect, tanFov, inspection, near/far); dimensioni, identità/versioni dei target colore/depth; geometria/index/attributi/materiale e loro versioni/epoch; sun + solarColor + ambientColor; identità/versioni/configurazione delle due texture WorldCover. Includere trasformazioni/scene revision oppure dichiararne e custodirne l'immutabilità nell'owner.

Chiamare prima la shadow cache esistente: un suo nuovo draw/epoch, target sostituito o contenuto invalidato deve invalidare anche il colore. Il suo hit da solo non certifica il colore: camera e colori ambientali possono cambiare con la medesima direzione solare. Prima di un miss togliere la vecchia entry; confermare solo dopo clear/draw/restore riusciti e chiave finale ancora uguale, conservando versioni post-bind come fa TerrainShadow.render:170–198. Resize/dispose/reset/scritture esterne e diagnostiche sul target invalidano; un errore non deve lasciare un vecchio hit valido. Contatori richieste/hit/draw sono submission CPU, non completamenti GPU.

## Saldo statico, non previsione temporale

| Per hit valido | Lavoro eliminato / conservato |
|---|---|
| Raster terreno | Un clear colore+depth e un draw della mesh completa evitati; nessun LOD ridotto. Triangoli effettivamente rasterizzati/early-Z non misurati. |
| Texture terreno | Per fragment che sarebbe stato ombreggiato: **2 textureSample WorldCover** con mip + **al massimo 1 textureLoad shadow**, oltre al materiale procedurale. Su hit non si esegue il fragment terreno. Numero di accessi fisici/cache/banda non deducibile da queste tre istruzioni. |
| Cloud/rain | **Zero lookup eliminati** nel raymarch; resta il textureLoad del target terreno per pixel e l'intera integrazione corrente. Flow, R8 rain e passi restano pieni. |
| Memoria aggiuntiva GPU | **0 B di payload texture/geometry**: si conserva l'attachment già posseduto. A2474×1844 sono già presenti 72.992.896B RGBA32F +18.248.224B depth32 =91.241.120B nominali, identici in A/B; non sono nuove allocazioni né una stima di banda/driver RSS. Chiave/contatori aggiungono solo piccolo stato CPU. |

Con camera continuamente mobile il saldo è nessun draw risparmiato più costo CPU della chiave. Questo candidato non risolve da solo il costo del raymarch pioggia e non certifica 60 FPS in tutte le viste.

## Idee escluse, provenienza delle decisioni

- **Dry R8 non riproposto.** `EXPERIMENT-DENSITY-R8-2026-10-16.md:34–65`: vecchio A/B/A nearSun −1,07%, rain +6,61%. Engine:351 associa R8 solo alla specializzazione rain; cloudShader:254–257 cambia solo il lookup warped, mentre la luce continua su macroRGBA:174. Il formato più piccolo non prova un risparmio di tempo. Il buffer R8 da16MiB resta già conservato anche in asciutto.
- Il **trial cache terreno v50 ritirato** (`EXPERIMENT-TERRAIN-GEOMETRY-CACHE-2026-10-16.md`) aggiungeva62.312.448B per distanza/pendenze/height al solver monolitico, con guadagno rain2,1975% e render non bit-identico. Qui il raster separato e il target colore+distanza esistono già nel prodotto: non si introduce prepass, packing, intermedio o diversa formula. È un nuovo contratto di riuso dell'output completo, da provare; il fallimento precedente resta valido nel suo ambito.
- Shadow cache già adottata v58: nessuna proposta duplicata. Narrow dry, shared-aerial e cache rain A/s restano esclusi dopo i rispettivi esiti documentati. Il compute flow16³ ripetuto a input identici è una pulizia più piccola, non il candidato selezionato: rimuoverebbe4096invocazioni/32KiB di store nominali solo a moto invariato; il frozen-flow storico non dimostra un vantaggio causale attuale.

## Falsificatori prima di un'adozione

1. Test dell'owner: hit con camera/luce identiche; ogni dipendenza sopra produce miss. Sole invariato ma ambientColor diverso deve ridisegnare. Errori dopo clear/restore, resize, dispose, shadow invalidate e diagnostica non devono rendere riusabile il vecchio target.
2. Su snapshot esterna, confronto actualGPU del target RGBA32F e PNG nativo a identico stato congelato; **una differenza non spiegata nei bit è FAIL del contratto**, non accettabile perché il PNG appare uguale. Verificare anche ritorno alla camera precedente, luce in transizione, resize e main/worker. Nessun nuovo campo/bake per questo audit.
3. Soltanto dopo parità: A/B/A fresco v59, stessa camera/qualità piena, una posa terreno rain e controllo con camera in moto (miss). Registrare hit/draw, intervalli e prefissi completati; niente percentuali da pass GPU sovrapposti o vecchie finestre. Se il beneficio non supera deriva/overhead non promuovere come soluzione FPS. Nessun PASS fotografico dedotto dalla cache.

## Sorgenti effettivamente lette — SHA256

- `src/cumulonimbus/GPUSceneEngine.ts`: `28fd54dc8decbaa6e491c1781d29d862050820092dcb2f392507942a0ce5a4c7`
- `src/cumulonimbus/terrainMesh.ts`: `c7bc36a93960a688102546f70fadffcf67005073e86889b0afd2ab659ba78e5a`
- `src/cumulonimbus/TerrainShadow.ts`: `ed628cb7e81a77d8fe1d57ecabd7f43b8072cfee0c8959a6d2b5746965640692`
- `src/cumulonimbus/terrainSurface.ts`: `0ff8de3514feb3714ba4e931c246d0bd339634661aa37a7d87e79f61c1ddff3f`
- `src/cumulonimbus/cloudShader.ts`: `f9d05d60526904297a4aab1cb013b84895f928c23a49cdf984b48447fbb9e568`
