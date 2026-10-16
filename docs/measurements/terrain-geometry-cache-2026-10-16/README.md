# Archivio del trial terrain geometry cache

**Ritirato, non promosso.** La candidata è esterna al prodotto 10493. Pioggia: +2,1975037% sul controllo più veloce, sotto il gate 5%, con 59,4258 MiB nominali aggiuntivi. Sole: tutti i run vicini a 60 invii/s rAF, senza beneficio osservato nella cadenza. Il render f32 resta FAIL. Il [rapporto completo](../../EXPERIMENT-TERRAIN-GEOMETRY-CACHE-2026-10-16.md) distingue rendering, storage, presentazione e accettazione artistica.

## Contenuto e integrità

- `manifest.json`: file esatti, dimensioni e SHA256 dei payload memorizzati. Per ogni gzip conserva anche dimensione e SHA256 originali; per il tar conserva tutti i 16 membri originali.
- `storage-provenance.json`: origine esterna e trasformazione lossless delle copie. I documenti storici mantengono le loro vecchie diciture pending; l'esito finale è quello del rapporto e di `summary.json`.
- `summary.json`: scalari estratti dai sei run e dai tre witness, soglie, posa e limiti. Non sostituisce i report integrali.
- `browser/`: sei report FPS originali, protocolli, metadati, stati/console disponibili, tre report witness, sei JPEG FPS e due JPEG witness. I testi originali sono gzip byte-identici dopo decompressione. Non è stato inventato un console/Sole witness mancante.
- `source/changed-source-originals.tar.gz`: 3 file baseline modificati dal trial, 11 file R1 cambiati/aggiunti e 2 file R2 aggiornati. Percorsi interni `baseline/`, `r1/`, `r2/`; tutti i byte originali sono preservati senza ripulire whitespace.
- `source/`: manifest da 108 file baseline e 116 file per R1/R2, manifest delle due build, log delle verifiche da 115/127 test, 24 contratti WGSL e 12 sorgenti emessi compressi. R2 cambia solo helper metriche e relativo test; i template e engine/shader/geometria sono invariati. Il manifest storico del freeze R1 completo descrive il materiale esterno: quel tar completo e gli asset build non sono duplicati qui.

Per verificare l'archivio dalla radice del repository:

```sh
python3 docs/measurements/terrain-geometry-cache-2026-10-16/verify.py
```

Il verificatore usa soltanto la libreria standard, non scrive file e non avvia GPU/browser. Controlla byte/hash, gzip/tar, sorgenti contro manifest, contratti WGSL, intervalli/prefissi/copertura dei sei run e invarianti dei tre witness. Verifica anche specializzazioni dry/rain e cache B valida all'inizio/fine senza rebuild o fallback. **Non ricalcola le metriche full-buffer GPU dai soli hash**, perché i buffer binari completi non sono stati esportati. La lettura è una verifica offline dei risultati registrati, non una nuova esecuzione GPU.

## Ricostruzione esterna esplicita

Richiede una copia Git locale che contenga `10493afa7f6d90389c39e17b2cad79397dfdac01`. Scegliere un percorso nuovo, esterno al checkout, preferibilmente fuori da Dropbox:

```sh
python3 docs/measurements/terrain-geometry-cache-2026-10-16/reconstruct-source.py \
  --repo "$PWD" \
  --output /private/tmp/cloudia-terrain-cache-replay
```

Lo script legge da Git i 108 file indicati nel manifest, verifica tutti i byte, applica gli originali R1/R2 in memoria e verifica i 116 hash candidati **prima di scrivere** `baseline-source/` e `candidate-source/`. Non sovrascrive directory, modifica Git, installa dipendenze o esegue test/build/GPU. Nessuna cancellazione automatica in caso di errore I/O.

La riproduzione app usa il normale progetto R2 in `candidate-source`, mantenendo accanto `baseline-source` per i test esterni. Le versioni sono quelle del manifest e del lockfile conservato nel commit base; Three 186, Vite 7.3.3 e Vitest 4.1.6 sono registrati dai sorgenti/log del run. Preparare dipendenze locali compatibili tramite il gestore e lockfile del progetto, rispettando le esclusioni File Provider se si sceglie una destinazione Dropbox. Nessuna dipendenza viene inclusa nell'archivio.

I comandi originali sono in `source/r2-validation.json.gz`: typecheck, otto file di test mirati e build Vite con outDir esterno distinto. I test importano intenzionalmente la copia baseline e non sono trasferibili automaticamente nel prodotto. La build serve la candidata R2 con `terrainCache=1`; il default diretto conserva il contratto originale. Nessun benchmark o witness parte automaticamente.

La QA GPU richiede un'azione esplicita in Regola → Misure → **Verifica record e rendering nativi**; JSON in `[data-testid="terrain-cache-witness-json"]`. La geometria confrontata è **prepass fresco contro prepass conservato**, non solver inline monolitico. Il colore confrontato è post-film lineare Float32, non presentazione. La conversione IEC RGB8 è derivata CPU: nel Sole conserva 2 differenze lineari e 1 sRGB di un livello; non è un PASS artistico.

Tutti i run effettivi sono main, nativi 2112×1844, 384 passi/256³/128³, seed 72, t = 60 in pausa, target 0 e pitch 0,2811279826464208. Nessun t=0 reale osservato; worker, larghezze GPU dispari, camera mobile e lifecycle GPU restano aperti. I JPEG CSS 1056×922 non sono PNG nativi o video. I pannelli pioggia differiscono e impediscono un confronto globale dei JPEG; il rapporto originale del root è conservato senza alterazioni.
