# Evidenze sulla luce ravvicinata

Leggere il [rapporto principale](../../EXPERIMENT-NEAR-LIGHT-CAUSALITY-2026-10-16.md). **Nessuna modifica è promossa.** Il JPEG concorda con il gradiente CPU, ma la qualità fotografica resta insufficiente. Il controfattuale preclamp `.6→.5` desatura parte del centro e svuota il fronte campionato: è un risultato negativo.

## Contenuto

- `browser/solar-day-left-near.jpg`: una cattura CSS 1280×720 originale, identica per SHA256 a quella dell'archivio solar-continuity.
- `jpeg-comparison.json`: 13 patch dichiarate, quattro escluse per UI e nove campioni validi; medie, mediane, intervalli RGB e confronto CPU.
- `model/`: dati completi e riepiloghi CPU in gzip lossless. Il riferimento Float64 comprende 13 raggi, integrazione continua e controlli della visibilità solare; non è un readback GPU.
- `sources/` e `audit-code/`: sorgenti congelati e script originali compressi, con hash degli originali non compressi in `provenance.json`.
- `reports/`: rapporti esterni conservati senza riscrivere la cronologia. La sezione preclamp successiva corregge la proposta iniziale generica di un'altra banda 100–300 m.
- `preclamp/`: archivio curato precedente trasferito integralmente, con il proprio manifest, cinque originali gzip e replay autonomo già verificato prima del trasferimento. **196 nodi** costituiscono gli stencil del controfattuale; **252** è il totale ricostruito includendo la traccia centrale. Non sono due risultati incompatibili.

Non sono inclusi cache macro/dettaglio, volumi luminosi, build, dipendenze o dati GPU. I loro riferimenti SHA restano nei record. Per ripetere l'intero modello materiale servono gli input esterni originali; il replay scalare qui incluso è autonomo.

## Verifica e replay

```sh
python3 docs/measurements/near-light-causality-2026-10-16/verify.py
python3 docs/measurements/near-light-causality-2026-10-16/preclamp/replay.py
python3 docs/measurements/near-light-causality-2026-10-16/replay-jpeg.py
```

Gli script risolvono i file dalla propria posizione. Verifica e replay preclamp usano solo la libreria standard Python. Il replay JPEG richiede Pillow e confronta tutti i campioni decodificati e le metriche con i valori congelati; legge l'immagine senza modificarla. **Dopo la finestra di misure FPS, tutti e tre i controlli sono passati sulla copia in repository, avviati da `/private/tmp`**: integrità su 42 payload e 24 originali gzip; replay JPEG su nove campioni validi e quattro esclusi, RMSE `0,3503173476757166` e correlazione `0,9985398808608538`; replay preclamp su 196 byte e 52 record. La precedente indicazione «predisposto, non rieseguito» è superata.

La verifica controlla ogni payload, i byte e SHA256, e gli originali gzip. Il manifest radice è il riferimento d'integrità e non può includere il proprio hash. Il manifest interno preclamp rimane anch'esso preservato. Il PASS di un replay numerico non cambia l'esito negativo del controfattuale e non equivale ad accettazione fotografica.
