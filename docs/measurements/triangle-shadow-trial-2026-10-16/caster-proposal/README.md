# TerrainShadowCaster — proposta R2 congelata

Base v58 `908078042bda26471d57cb6a27d69dbec8655c3f`, snapshot 124 file verificata contro manifest SHA256 `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Il sottocompito ha scritto soltanto due nuovi file nella candidate-source: `TerrainShadowCaster.ts` e il suo test. Le altre modifiche concorrenti all'integrazione sono di root/Solar, non incluse in questa ownership. Nessuna installazione, modifica al prodotto, build, suite completa, GPU o browser.

## API e contratto

`new TerrainShadowCaster(sourceGeometry,{center,sun,scene?})` prepara `scene`, clone dei `bounds` originali, `geometry`, `mesh`, `material`, `cornersUVQ` readonly flat, `stats()` e `dispose()` idempotente. La scena fornita è riutilizzata; la dispose rimuove solo il mesh dell'owner. Input: posizioni world Float32 xyz, indici Uint32 di triangoli completi, mesh identity statica. Groups devono essere vuoti; drawRange parte da zero e comprende tutti gli indici. Casi parziali vengono rifiutati esplicitamente.

Il caster ha tre vertici position veri, non indicizzati, e instanceCount pari ai triangoli. Ogni istanza legge i tre indici mantenendone ordine e winding; vertexIndex sceglie il corner effettivamente rasterizzato. FrontSide, depthTest/depthWrite e normale depth raster restano attivi; depthNode e vertexNode rimangono null. Il fragment iniziale emette soltanto q grezzo: root lo sostituisce con la propria politica di clipping. Nessun bias/clipping/texture lookup receiver è implementato qui.

I tre UVQ flat dipendono da instanceIndex, non da vertexIndex. XY usa cameraProjectionMatrix e cameraViewMatrix della camera light attiva, con conversione top-origin; q conserva dot(P−center,sun). I nodi center/sun sono quelli forniti dal caller, senza copia dei valori uniformi.

Ownership: copia CPU Uint32 degli indici e pack CPU Float32 vec4 delle posizioni, w=1. Nuovi oggetti StorageBufferAttribute, entrambi registrati sotto `terrainShadowCasterIndices` e `terrainShadowCasterPositions` nella geometria propria, fino alla dispose. Nessun BufferAttribute o array della radiance viene modificato né distrutto. Il percorso di distruzione GPU è quello di Geometries r186, non una chiamata privata del renderer; questa qualifica non ha osservato buffer GPU reali.

## Dati e costo dichiarato

`stats()` riporta conteggi e payload nominali, senza chiamarli residenza/peak/costo GPU. Con V=465409 e T=929792 del witness precedente: indici 11157504 B, posizioni vec4 7446544 B, dummy 36 B, totale extra CPU e GPU **18604084 B per ciascun dominio**. Sono dati distinti dai vecchi buffer colore. 3T=2789376 invocazioni vertex potenziali; tre corner letti per ognuna, nessuna esecuzione implicita una-volta-per-istanza. Il modulo non è stato istanziato su tutta la mesh da questo agente.

## Qualifica eseguita

Comandi, cwd `../candidate-source`:

```
/Users/enuzzo/.bun/bin/bun run test src/cumulonimbus/TerrainShadowCaster.test.ts
/Users/enuzzo/.bun/bin/bun run typecheck
```

R2: **8/8 test, un file, exit 0**; **typecheck exit 0**. Log e record terminali in `targeted-r2.*` e `typecheck-r2.*`; sessione typecheck 34493. Verificate le dipendenze esistenti: node_modules ignorato, non tracciato e xattr `com.apple.fileprovider.ignore#P=1` prima e dopo. Nessuna cartella nuova sotto Dropbox o installazione.

I test usano solo geometrie minuscole reali Three. Coprono sequenza/winding/pack/copie indipendenti, tre vertici veri e istanze, source/bounds invariati, scena e dispose idempotente, materiale raw-depth, dipendenze e interpolation del grafo UVQ, payload, input malformati, drawRange/groups. Non interpretano il grafo come un esecutore GPU e non compilano shader. La validazione del WGSL effettivo resta a root.

R1 è conservata in `r1-source/` con PRE-RUN-R1 e log originali: 7 test passati; primo typecheck exit 2 per cast d'introspezione nel test e tipizzazione root-owned di toVar in TerrainShadow. R2 corregge il cast con unknown e aggiunge la guardia richiesta da root; il cast root-owned è stato corretto da root. Nessun fallimento viene rinominato PASS.

## Provenienza tecnica e riproduzione

Studio precedente: [caster-triangle-api-study.md](../../Cloudia-QA-2026-10-16-cycle26/caster-triangle-api-study.md). API lette localmente in Three e @types/three **0.186.0**: InstancedBufferGeometry, StorageBufferAttribute, StorageBufferNode, VaryingNode, IndexNode, NodeMaterial; draw/cleanup nei renderer common/WebGPU. `API-SOURCES.json` fissa le versioni e gli hash delle fonti locali. Lo studio documenta anche costi, layout e limiti dello storage-only non registrato nella geometria.

`r2-source/` contiene copie lossless dei soli due file finali. PRE-RUN-R2 e RESULT ne fissano byte e SHA256. Per riprodurre i test, usare la snapshot candidate-source con le dipendenze esistenti oppure una copia della base conservata e dei due file; non ricopiare node_modules fra Mac. Il typecheck salvato include l'integrazione root presente in quel momento; il manifest globale finale dovrà essere curato da root.

Restano aperti: compilazione WGSL reale, corner UVQ numerici nel raster, winding/edge tie/depth winner su GPU, lifetime dopo draw/compile-only, benchmark e accettazione visiva. Nessun risultato prestazionale o artistico è attribuito a questi otto test.
