# Audit GPU finito: R8 rispetto a RGBA8.r

Il run raw WebGPU eseguito da root il 16 ottobre 2026 ha confrontato **77.629
coppie float32**, tutte identiche bit per bit. Il dispositivo dichiara vendor
`apple`, architettura `metal-3`; feature richieste dal device: soltanto
`core-features-and-limits`. I quattro readback scaricati sono conservati interi
e la verifica indipendente conferma bit dei risultati, echo delle query e
contatori atomici. Questa archiviazione non ha eseguito nuova GPU o bake.

| Dataset | Query | Coppie zero | Coppie positive | Bit diversi |
| --- | ---: | ---: | ---: | ---: |
| Macro reale seed72, 256³ | 53.041 | 50.263 | 2.778 | 0 |
| Fixture R=0, GBA variabili, 16³ | 8.196 | 8.196 | 0 | 0 |
| Fixture R=255, GBA variabili, 16³ | 8.196 | 0 | 8.196 | 0 |
| Fixture R variabile, GBA variabili, 16³ | 8.196 | 35 | 8.161 | 0 |
| **Totale** | **77.629** | **58.494** | **19.135** | **0** |

Il criterio iniziale, mantenuto invariato, era l'identità dei bit float32:
massimo errore assoluto e ULP osservato **zero**, nessun nonfinite o valore
fuori [0,1], nessun errore di echo, flag o contatori. Le query comprendono
centri positivi/nulli, campioni deterministici interni, vicini float32 dei
centri e piani d'interpolazione, facce, bordi e coordinate fuori dominio.
Il file `inputs.json` conserva le quantità e gli hash di ogni gruppo.

Il WGSL usa due texture 3D, `r8unorm` e `rgba8unorm`, alle **stesse UV f32**,
con un unico sampler lineare condiviso, clamp XYZ e mip0 esplicito.
La dimensione reale è 256³, quella delle fixture 16³. Le query occupano
16 byte ciascuna; ogni risultato 48 byte, più 16 byte finali di contatori
per dataset. I quattro readback occupano complessivamente **3.726.256 byte**.

## Contenuto e provenienza

`audit.js`, `audit.wgsl`, `index.html`, `prepare.py`, `inputs.json`, il primo
`artifact-manifest.json`, `cloudShader.v46.ts`, fixture/query e report sono
copie byte-identiche dei file esterni congelati. `README.prepared.md` conserva
le istruzioni scritte prima del run: il suo «GPU non eseguita» descrive quella
fase iniziale. Il risultato eseguito è in `browser-result.json`; la verifica
indipendente è in `independent-verification.json` e nel relativo script Python.
`archive-copy-verification.json` registra hash e percorso delle copie.

Il nuovo `manifest.json` elenca SHA-256 e byte di ogni payload durevole,
escludendo soltanto se stesso. Non sono archiviati Downloads, URL blob,
build/cache compilate o report FPS. Il manifest iniziale è mantenuto anche
se elenca i due input grandi esclusi: i riferimenti sono intenzionali.

## Verifica ripetibile senza GPU e senza i volumi grandi

Dalla directory di questo README:

```sh
python3 verify-payloads.py
python3 verify-readbacks.py
```

Il primo comando controlla tutti i payload del manifest durevole. Il secondo
rilegge integralmente i quattro readback e le query archiviate, confronta bit,
echo, valori, hash e contatori; riscrive il medesimo riepilogo indipendente.
Non necessita di Three, dipendenze del progetto, volume macro o nuova GPU.
Le coppie f32 separate si ricavano dai primi 8 byte di ciascun record di
48 byte; l'intero readback, più informativo, è conservato senza proiezioni.

## Input esterni esclusi e ricostruzione di un nuovo run

`external-inputs.json` conserva percorsi, byte e hash dei due file esclusi:

- Macro RGBA8: **67.108.864 byte**, SHA-256
  `72e3f360b81f3c8f812800cc309a174ce893d96c80e666c9bf98fca178187b9f`.
- R8 estratta: **16.777.216 byte**, SHA-256
  `61364caa2ebfe2fd1b8769b3381ded22ce4648033872d31ec4e5af9c62cabe28`.

Per ripetere la GPU, copiare l'archivio in una nuova directory **fuori Dropbox**,
verificare byte/hash della macro originale esterna e copiarla come
`macro-rgba8.bin`. Ricostruire `density-r8.bin` con l'estrazione Python
`macro[0::4]`: nessun ricampionamento o bake, stesso ordine x più veloce.
Verificare il secondo hash e quelli di `inputs.json`, runner e shader prima
di servire la copia su localhost e premere Avvia. Conservare i nuovi risultati
separatamente. **Non eseguire `prepare.py` dentro questo archivio**: produrrebbe
gli 80 MiB esclusi e rigenererebbe i metadati. Lo script preparatore congelato
è provenienza della prima preparazione; per questo run si riusano gli input
e il manifest congelati. Se la macro originale viene persa, non è ricostruibile
da questi readback; un eventuale nuovo bake deve superare l'hash originale.

## Limiti

Il PASS qualifica solo queste query, questi dati e il backend registrato.
Non prova equivalenza universale dei sampler né del percorso Three, binding
runtime, shader integrato, immagine completa, lifecycle o prestazioni.
Lo snapshot v46 documenta il lookup originale: non sostituisce un controllo
del renderer candidato. Il criterio finito non è una soglia percettiva e
non dimostra alcun miglioramento visivo o FPS.
