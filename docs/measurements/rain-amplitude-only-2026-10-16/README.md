# Archivio CPU A-only — 2026-10-16

Copie lossless (R2: tre JSON grandi in gzip mtime0) dell’unica esecuzione esterna
cycle16/rain-amplitude-only e dell’audit alternative congelato prima del run. Nessun nuovo modello o replay
viene eseguito per curare questo archivio. Il documento principale è
[RAIN-AMPLITUDE-ONLY](../../RAIN-AMPLITUDE-ONLY-2026-10-16.md).

## Verifica offline, senza dipendenze del progetto

Da questa directory:

```sh
python3 -B verify_archive.py
```

Il verificatore usa soltanto la libreria standard Python e i file dell’archivio.
Legge i tre JSON gzip in modo trasparente. Controlla SHA/byte sia compressi sia
originali decompressi, protocolli, trasformazioni, dieci sorgenti storici, counters
sommabili dei 576 raggi, statistiche tau/T e gate congelati. Non importa i file
TypeScript, non legge gli array binari, non ricalcola cloud/rain o il flow.

Le coordinate di tutti i 206.466 punti non sono serializzate: l’uguaglianza dei
due hash registrati è verificata come coerenza del report, **non ricalcolata**.
Il massimo T di ogni raggio è un dato registrato; il suo massimo globale viene
ricostruito, non la traiettoria T interna. Le distribuzioni A/sigma e le comparse
A0→positivo rimangono diagnostica del run. Le A dei witness sono ricostruite
soltanto dai corner half e pesi salvati, senza interrogare il modello originale.

## Contenuti e provenienza

- PROTOCOL.md e PROTOCOL-UV-ADDENDUM.md: pre-run, soglie e semantica UV originali.
- [result.json.gz](result.json.gz): metriche, 576 record per grid e witness; witness-index.json: indice.
- [historical-replay.json.gz](historical-replay.json.gz): baseline riprodotta nell’unico run; inputs conserva
  manifest dati, posa e [report storico di confronto gzip](inputs/baseline-control-replay.json.gz),
  con gli originali decompressi byte-identici.
- pre-run-manifest.json / after-run-manifest.json: inventari esterni originali.
- prepare.py, replay.ts, audit-core.ts, oracle-core.ts, inputs/*phase2-original
  e *.transform.patch: sorgenti originali, adattamento A-only e path rewrite.
- source-original e source-runtime: solo 11 piccoli file .ts ciascuno,
  provenienti da ab2e122; non un checkout Git o un clone di dipendenze.
- alternative-audit: proposta tecnica/limiti congelati prima del nuovo run.
- archive-copy-record.json / archive-manifest.json / compression-record.json:
  copie, SHA/dimensioni compressi e originali, inventario durevole.

Gli script TS conservano i percorsi assoluti del run per losslessness e i guard
originali. **Non sono un replay autonomo da lanciare dalla copia.** Un replay
richiede gli array esterni già esistenti, dipendenze locali verificate e nuova
autorizzazione; questo archivio non le installa né le incorpora. Il verificatore
Python è autonomo rispetto a essi. I file sunset sono citati solo nel manifest
dati: non sono stati letti o ricontrollati dal run A-only.

Nessun .bin, .git, node_modules, dist, cache volumetrica o bundle dependency è
copiato. Le piccole copie runtime rendono verificabili anche gli hash del freeze.
Il payload R16F ipotetico e il costo del rebuild non sono memoria fisica o FPS.

## Recupero identity R1 e verifica da qualsiasi cwd

L’archivio identity precedente è conservato fuori Dropbox, completo e recuperabile:
`/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle16/rain-amplitude-only-archive-R1-identity/`.
Contiene anche il main doc R1 e freeze-manifest.json; non è stato modificato dalla
compressione. Gli inventari storici nel repo mantengono nomi e SHA originali; il
verifier risolve questi nomi logici attraverso compression-record.json.

La verifica normale è autonoma e controlla gli SHA originali dopo decompressione.
Per il confronto **byte per byte** con i tre JSON identity congelati, da /tmp:

```sh
python3 -B /Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/rain-amplitude-only-2026-10-16/verify_archive.py --frozen-root /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle16/rain-amplitude-only-archive-R1-identity
```

Il verifier non scrive i JSON decompressi e non esegue alcun modello. Nei file
originali conservati (script, log, protocolli e inventari) i nomi .json restano
quelli del run: i tre payload corrispondenti sono ora archiviati come .json.gz.
