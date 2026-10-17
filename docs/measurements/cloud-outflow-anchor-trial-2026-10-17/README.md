# Source-anchored outflow R1 — archivio del trial respinto

17 ottobre 2026, ciclo 43. **FAIL visivo, non adottato. Prodotto v61 invariato; goal attivo.** Il PASS dell'eventuale verificatore di conservazione non cambia il verdetto del trial.

- `source/`: manifest della base141 v61, manifest143 R1 e overlay dei soli6 percorsi differenti. Ricostruire dalla base prodotto autenticata, non da un altro esperimento. Il workspace completo esterno è `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle39/outflow-source`.
- `run/`: protocollo precedente alle catture, camere A congelate, addendum clock precedente a B, freeze, log e continuità finale.569 test/54 file, typecheck e APP build PASS; nessuna hero build o adozione.
- `preflight/`: una sola esecuzione delle ricette minuscole74/72/73, senza volume denso/raster/GPU; formule, parent, RNG, conteggi e contrazione assi. Non certifica densità o fotografia.
- `browser/`: DTO reali A/B front/lato,3 nuovi PNG interi e ledger28/74/30 parti; A front è un alias byte-esatto del PNG v61 già nel repository. Screenshot finale ordinario JPEG è una prova UI separata, non un export nativo del confronto.
- `analysis/`: script/contratto congelati prima di B e risultato originale `FAIL_NATIVE_METADATA_CONTROLS`. La allowlist ometteva soltanto i due contatori annidati shadow-cache hits/requests, dichiarati CPU owner-local nel DTO. Camera/luci/input fisici coincidono. Nessun retry o PASS sostitutivo.
- `review/`: review statica, root e review nativa indipendente. Quattro crop matched lossless con box PIL L/T/R/B espliciti nell'indice, oltre all'ispezione dei quattro full native.

`MANIFEST.json` censisce byte e SHA256 di ogni payload, incluso questo README e `verify_saved.py`, escludendo soltanto sé stesso. Il verificatore legge soltanto byte/JSON/header PNG e, con `--current`, i141 sorgenti prodotto. Non esegue script di analisi, ricette, modelli, build, browser, GPU o FPS e non produce accettazione artistica.

```sh
python3 docs/measurements/cloud-outflow-anchor-trial-2026-10-17/verify_saved.py --current141
```

Nessuna ripetizione automatica dei trial. Base prodotto: renderer `observatory-v61-observed-terrain-material`, implementation `8a9535f9cb849292f5dd868020ef7f514567109a`, documentation HEAD prima del trial `f2218a0e2889bb2ff7162e3e962c73ad115101b2`; manifest141 SHA256 `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`. La candidata `experiment-v61-source-anchored-outflow-r1` non è una nuova base.
