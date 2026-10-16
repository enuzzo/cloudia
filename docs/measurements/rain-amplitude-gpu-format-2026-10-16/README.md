# Archivio della prova formato R16F, 16 ottobre 2026

Prerequisito GPU piccolo: core pack/copy PASS in R1/R2/R3; storage Tier1 R1 errore di sintassi, R2 FAIL del witness RNE, R3 PASS dopo prequantizzazione. Il [resoconto](../../RAIN-AMPLITUDE-GPU-FORMAT-2026-10-16.md) distingue risultati osservati, contratto WGSL e limiti. Nessuna integrazione nel prodotto o misura FPS.

## Contenuto e integrità

- `browser/`: tre JSON originali compressi lossless, tre console e tre JPEG originali. I JSON conservano anche i fallimenti. I JPEG mostrano la pagina diagnostica; non sono framebuffer di Cloudia.
- `source-originals.tar.gz`: 16 oggetti unici, 40.195 byte originali, indirizzati tramite SHA256. `source-layout.json` ricostruisce esattamente i 28 file delle tre directory storiche, inclusi tutti i manifest, README, protocolli e diff. Le cinque risorse comuni sono conservate una volta.
- `results-summary.json`: conteggi compatti estratti dai risultati reali. `product-device-policy.json`: riga della richiesta del device e SHA del sorgente osservato.
- `verify.py`: verificatore offline Python standard library; nessun accesso browser, WebGPU, rete o dipendenze esterne. `manifest.json` censisce ogni payload di questo archivio, escluso sé stesso.

I README e i manifest originali erano congelati prima dei run e mantengono la dicitura storica “prepared-not-GPU-executed”. I JSON browser successivi attestano l'esecuzione; nessun originale è stato riscritto per aggiornare quella dicitura.

## Verifica offline

Dalla radice del repository:

```sh
python3 docs/measurements/rain-amplitude-gpu-format-2026-10-16/verify.py
```

Controlla integrità dei file, ricostruzione dei tre sorgenti originali, trasformazioni strettamente limitate R1→R2→R3, 15 SHA delle risorse realmente caricate e invarianti dei run. Ricostruisce 46 digest nei dieci casi completati: input f32, packed core, texture con padding, half contigui e output load/sampler. La ricostruzione usa palette e layout fissi; solo per R2 Tier1 applica il vicino effettivamente registrato a tutti i 6/7 indici. Per i sampler usa i 12 bit float registrati, ricontrollando valore, coordinate e tolleranza dichiarata. Il digest dell'intero output conferma anche il modello di load half preservati e marker/index/kind, pur essendo serializzati nel JSON soltanto i primi sei load subnormali.

Questo verifica una ricostruzione deterministica rispetto ai digest osservati. Non è un nuovo run GPU e non trasforma i JSON in esportazioni originali complete dei buffer GPU.

## Ricostruzione della pagina, senza eseguirla

Scegliere una directory nuova fuori dal repository; ad esempio:

```sh
python3 docs/measurements/rain-amplitude-gpu-format-2026-10-16/verify.py --extract-source R3 --output-dir /tmp/cloudia-r16f-r3-replay
```

Il comando verifica prima l'archivio e poi ricrea i file originali. Fallisce se la destinazione esiste già. Una futura ripetizione autorizzata può servire quella directory con un server statico locale: la pagina richiede il pulsante esplicito «Esegui prova formato» e non avvia la GPU al caricamento. R1 e R2 restano riproducibili con lo stesso argomento di revisione e una destinazione differente. Il risultato su un altro browser/device va conservato come nuova prova, senza sostituire questi originali.
