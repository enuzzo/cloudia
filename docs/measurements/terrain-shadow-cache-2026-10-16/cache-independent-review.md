# Review indipendente della cache ombre — ciclo 26

Stato: **nessun blocker concreto rilevato nel contratto dichiarato**, non promozione GPU, FPS o artistica. Review statica del 16 ottobre 2026; nessun test, build, bake, browser, GPU o raycast eseguito. È stata scritta soltanto questa nota esterna.

## Provenienza verificata

- Baseline: `source/src/cumulonimbus/TerrainShadow.ts`, SHA-256 `0fa68e56eed14e400d7fb18381aac2d3a6823a5a4f28f927fa267e3d9a6d095e`.
- Candidata letta: `cache-source/src/cumulonimbus/TerrainShadow.ts`, SHA-256 `ed628cb7e81a77d8fe1d57ecabd7f43b8072cfee0c8959a6d2b5746965640692`.
- Patch letta: `cache-evidence/candidate.patch`, SHA-256 `3c455135e6c22e75f04fbafca7ae28181c53b34e781ba46d29b774bac8fc6594`.
- Protocollo letto: `cache-evidence/PROTOCOL.json`, versione `observatory-v58-terrain-shadow-cache`, manifest sorgenti dichiarato `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`.
- Il risultato test archiviato dichiara 37/37 PASS. Non è stato rieseguito né usato come sostituto della lettura del codice.

## Cache, invalidazione e ciclo di vita

| Controllo | Evidenza e conclusione |
|---|---|
| Identità del risultato | `TerrainShadow.ts:103–112,165–176`: renderer, reverse depth, sole normalizzato, sei componenti bounds, dimensioni, identità/versioni colore e depth, epoch. Un hit evita clear/draw e mutazioni del renderer. Camera della vista e colori dinamici non appartengono alla chiave: la mappa contiene soltanto altezza solare della geometria statica. |
| Miss dopo contenuto precedente | `:178`: chiave azzerata prima di modificare uniform, camera o target. A→B con clear e draw fallito non può riutilizzare successivamente la vecchia A. |
| Commit | `:186–199`: avviene soltanto dopo il `finally` di ripristino. Un errore in clear, draw o restore salta il commit. `sameShadowInputs(requested,completed)` include epoch: invalidate/dispose o sostituzione attachment durante draw/restore non vengono cancellati dal commit. Il confronto legge nuovamente bounds/dimensioni. |
| Versioni finali | `:194–198`: accetta le versioni attachment risultanti dopo il draw. È coerente con Three locale `Textures.js:67–169`, che al primo aggiornamento del render target può incrementarle tramite `needsUpdate`. Non rende lecite scritture esterne non dichiarate. |
| Listener e destroy | `:146–164,215–220`: listener su target e due attachment; alla sostituzione vengono rimossi quelli vecchi. Destroy idempotente invalida, rimuove listener prima di dispose e impedisce nuovi render. Non possiede né distrugge la geometria condivisa. |
| Integrazione attuale | `TerrainMesh.ts:207–220,230–257`: mesh costruita una volta, shadow render prima del colore, destroy dell'owner chiude shadow. `GPUSceneEngine.ts:886–899`: release GPU distrugge l'owner, quindi non conserva la chiave attraverso un device perso. |

Il commit indica successo del percorso CPU sincrono, non completamento o successo asincrono GPU. Un errore GPU successivo richiede il normale percorso di errore/device loss del renderer; questa review non qualifica quel comportamento sul dispositivo.

Il contratto rimane essenziale: geometria, trasformazioni, visibilità/layer dei caster e stato del pass devono restare statici; il target è esclusivo. Mutazioni dei caster, scritture esterne del target o reset del backend sullo stesso renderer richiedono `invalidate()`. La chiave non pretende di scoprire tali mutazioni automaticamente. La sostituzione di un attachment rende la cache invalida, ma non costituisce da sola un contratto per ricollegare un binding TSL già costruito con la vecchia texture; nell'integrazione attuale gli attachment restano quelli iniziali. Nessuna di queste estensioni è necessaria per l'owner attuale.

## Costo e semantica delle statistiche

Anche un hit ha costo CPU non nullo: `terrainShadowFrame` valida bounds e sole, normalizza e costruisce la base, percorre otto corner AABB e alloca vettori/array; `key` crea un oggetto e altri array, confrontati con `every`. Non sono misure di costo né un blocker, ma impediscono di descrivere il ramo come gratuito o privo di allocazioni. La cache non aggiunge texture o payload GPU; conserva riferimenti e pochi scalari/array CPU. Il colore del terreno resta renderizzato a ogni frame.

`requests/submissions/hits` sono cumulativi dell'owner, non FPS né query GPU. `submissions` conta i tentativi di `renderer.render`, inclusi quelli che lanciano; un errore nel clear precedente non lo incrementa. `valid` è validità della chiave CPU. La patch conserva esplicitamente questo scope e aggiunge snapshot iniziale/finale; un eventuale delta di benchmark richiede lo stesso owner e non implica automaticamente tempo GPU risparmiato.

## Identità del materiale e limiti visivi

Confronto diretto dei template WGSL, senza compilazione:

| Template | Byte | SHA-256 | Baseline/candidata |
|---|---:|---|---|
| `TERRAIN_SHADOW_CASTER_WGSL` | 419 | `9738e964431d4033019ba7c2fa6c7cdbcb8d0594d466a9cf7f1ff0b75d901504` | Identici |
| `TERRAIN_SHADOW_WGSL` | 877 | `7eccd278c4a1532d165878a5e993bec580106563ab5a3f1d68e1c87ad461bbc1` | Identici |

Nessuna nuova correzione del bias, clipping del triangolo o modifica del campionamento è presente. Rimangono copertura limitata, fade al bordo e perdita di ombre dovuta al minimo affine e al lookup radiale già diagnosticati. Il risultato dei sei raggi del witness non viene reinterpretato come acne né risolto dalla cache. Prima dell'eventuale adozione servono la parità nativa degli stati previsti e il confronto temporale reale del root; questa review non li anticipa.
