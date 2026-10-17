# Review statica indipendente — cache raster del terreno

Esito: nessun blocker concreto residuo nei file sotto indicati, nel contratto di mesh/scena statiche e target esclusivo. Questa è una review di sorgenti e test scritti: non ho eseguito test, typecheck, build, modello, browser o GPU. Non dimostra identità della pipeline compilata, parità nativa, miglioramento visivo o FPS.

## Correzioni richieste e rilette

- L'audit ora rifiuta `dirtySize` oppure `lastOrdinaryTerrainGeneration !== terrainAuditGeneration`. Il seriale viene applicato solo dopo il quad ordinario riuscito: niente confronto di un target precedente con metadati di controlli/qualità non ancora disegnati. Un semplice resize dentro l'audit non sarebbe stato sufficiente.
- Il report dell'audit sostituisce correttamente il report UI e abilita Esporta JSON con nome dedicato. Il download non presume più `report.output` top-level, assente nello schema dell'audit; resta invariato il nome dei report benchmark.

## Cache e ownership

`TerrainMesh.render` aggiorna prima la shadow cache, poi camera e uniform proprie, quindi costruisce la chiave colore. Il confronto usa identità e copie dei valori con `Object.is`, senza epsilon. Comprende i valori solar/ambient forniti dall'Engine, le due texture cover e relative revisioni/configurazioni, frame/camera, renderer/backend/reverse depth, viewport/scissor, risorse del target, attributi/indici, materiale, trasformazioni e stato shadow aggiornato. Una luce ambient diversa a Sole identico provoca quindi un nuovo disegno.

Prima di un miss il vecchio risultato viene invalidato. Throw durante clear, draw o restore e mutazioni dei descrittori durante il draw non lasciano una chiave riutilizzabile. Il commit tollera solo incrementi di versione al primo bind degli attachment propri; gli altri cambi restano conservativamente miss. Senza `cacheInputs` il colore rimane live.

Un cambio tracciato del caster invalida shadow prima di interrogarla. `invalidate()` invalida colore e shadow; `invalidateGeometry()` elimina anche il fingerprint caster. Resize, dispose e sostituzione delle risorse sono osservati; i listener delle texture sostituite vengono rimossi. Le texture cover sono prese in prestito e non vengono distrutte da TerrainMesh.

Limite esplicito: scritture raw negli array senza `needsUpdate`, cambi di closure non descritti e scritture esterne sul target richiedono invalidazione esplicita. La chiave non è un rilevatore universale di mutazioni. Restano necessarie ownership statica della scena/geometria, bounds correttamente aggiornati e uso esclusivo del target.

## Audit e lifecycle

Il pulsante/textarea sono intenzionali e limitati a `profile=1&terrainAudit=1`. Sono richiesti owner pronto e visibile, scena in pausa senza orbit, cielo assestato, terreno attivo, nessuna misura/export concorrente e un draw ordinario dopo l'ultima modifica. Il busy interrompe il frame prima di avanzamento atmosferico, compute e draw.

Le due letture dell'intero target RGBA32F sono sequenziali. La seconda segue `invalidate()` e un nuovo disegno ordinario del terreno; perciò `cacheStateQualified` richiede esattamente +1 richiesta/submission/epoch sia colore sia shadow, hit invariati e cache valide. Controlla inoltre owner, geometria, dimensioni, seriale e firma dei valori applicati. Input cambiati durante l'attesa non ottengono un PASS di stabilità.

`releaseGPU` attende `terrainAuditPromise` prima di disporre terreno/renderer/device. Dopo destroy/loss non parte la seconda lettura né viene pubblicato il report. Il test lifecycle pendente copre esplicitamente l'attesa di teardown, l'assenza del secondo readback e il blocco dei draw ordinari. Il secondo test copre il rifiuto della scena animata; la variante aggiornata include il rifiuto della dimensione ancora da applicare.

`packRGBA32FReadback` copia i soli byte delle righe: stride `ceil(width*16/256)*256`, ultima riga senza padding finale, shape esatta r186, `byteOffset` rispettato. Il risultato è un nuovo `Uint8Array<ArrayBuffer>`; non converte i float e conserva payload NaN, ±0 e bit dei miss. Policy: dimensioni intere 1–8192 e massimo 96 MiB packed per lettura. Questi sono limiti dell'audit, non capacità dichiarate del device.

## Prove scritte e limiti della misura

I test cache usano mesh piccola reale e renderer finto. Coprono fallback live, ambient a Sole fermo, camera/risorse/configurazioni, caster prima della shadow, primo bind, errori clear/draw/restore, mutazioni durante draw e disposal/listener. Non sostituiscono il primo bind reale Three/WebGPU né la parità nativa. I test del compattatore includono padding, offset view, bit speciali, non-aliasing, shape/tipi errati e caps.

La chiave alloca e confronta array CPU a ogni richiesta: costo limitato al numero di descrittori, non al numero di vertici, ma non nullo. L'audit mantiene solo digest nel report; buffer di staging, readback, copie packed e GC possono coesistere e il loro picco non è misurato. Le statistiche contano chiamate CPU/tentativi di draw, non completamento GPU o presentazione. Nube/pioggia/composizione finale continuano a essere renderizzate; nessuna stima FPS segue da questa review.

## Identità verificata con sole letture

Contro il v59 canonico, `TerrainShadow.ts`, `cloudShader.ts` e `terrainSurface.ts` sono byte-identici. Anche il wrapper WGSL `terrainRasterColour` dell'Engine è identico (1068 B, SHA256 `ab6615fdad7ba034bd1f081806d8ee9716de2dff7073586c1887508a93211318`). La costruzione della mesh, il fragmentNode originale e la factory del target non cambiano nel diff letto. Queste identità di sorgente non sono una prova del compilato GPU.

File esaminati in `cycle33/cache-source/src/cumulonimbus`:

| File | Byte | SHA256 |
|---|---:|---|
| terrainMesh.ts | 41724 | bf46bed8b35cc8dd3ba3f51f266e79550b44011410b8547cf829f7db30953793 |
| terrainRasterCache.test.ts | 12502 | fe73b9731d0e6b5bde89018bca6dc0b1a1b945ac1b71948c44c58a4805f9e84e |
| GPUSceneEngine.ts | 82262 | a3683a8fd112693fee0f382e0ca3cdf7a469bbbfebfc77dec6a4be191d768b12 |
| CumulonimbusApp.ts | 23298 | 8c5d96bf8a3df0392daaadeaa343411dfb1edd03f1990ace2156223f4bc3a966 |
| sceneMarkup.ts | 12929 | 14e35d52bacf8912d0c9c007ead7aad748755d72e26e359d52c813679aab8306 |
| lifecycle.test.ts | 72409 | e1f4f7d56251ffac848e3653a6728aaa32eea9c3c9f2a69f6b3e6ecb6441b9f2 |
| rgba32fReadback.ts | 1754 | b30f4d16c35ff2595c3fbef73ce6a8d3ea5699984f6b85a89f97e04f755f0855 |
| rgba32fReadback.test.ts | 2953 | 05157557e91561dd3de4d0991f3b8ba65bed879df633c44a1146c2a8e92cd10d |

Le eventuali successive correzioni di typecheck/test del root non sono implicitamente coperte da questi SHA. Nessuna modifica al prodotto è stata fatta da questa review.
