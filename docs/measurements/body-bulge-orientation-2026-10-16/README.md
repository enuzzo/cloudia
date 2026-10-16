# Archivio del preflight del rigonfiamento, 16 ottobre 2026

**Modello ritirato:** elimina il supporto nei vecchi campioni del becco, ma peggiora il raggio della sella fissato prima del calcolo. È un FAIL numerico locale, senza nuova app, fotografia o approvazione artistica. Il prodotto non viene modificato.

`original-preflight.tar.gz` conserva byte per byte tutti i 30 payload e il manifest originali di `cycle17/body-bulge-orientation-preflight`: report, modello, campionatore, sorgenti/input congelati, metadati e risultati. Nessun clone completo, dipendenza, volume o buffer GPU. Dimensione originale inclusivo manifest 3.379.978 byte; archivio 2.786.839 byte. I dati già compressi dentro gli originali sono preservati esattamente, senza duplicati esterni flat.

`provenance.json` registra origine e digest originali; `manifest.json` protegge il pacchetto; il digest del documento collegato viene controllato quando il documento è presente accanto al pacchetto nel repository. La cartella delle misure può essere copiata da sola e verificata senza altri percorsi. Per leggere il report originale, dopo la verifica estrarre una copia fuori dal checkout. I file storici JS sono evidenza, non vengono eseguiti dalla verifica.

```sh
python3 docs/measurements/body-bulge-orientation-2026-10-16/verify.py
```

Richiede soltanto Python3 standard, nessuna rete o dipendenza. Il verificatore legge il tar senza estrazione e verifica:

- integrità di tutti i membri e manifest, modello/script congelati e sorgenti 10493;
- 48 byte R8 dei vecchi stencil e digest JSON originali, 465 campioni numerici originali presenti nei prefissi baseline salvati;
- finestre/pixel comuni e integrali derivati dai campioni salvati; gate congiunto e FAIL della sella;
- metadata72/73 identici, selezione semantica 74 j0 / 77–80 j1, chiusura 91 riferimenti unici;
- ortonormalità/det+1, mapping della tangente, raggi locali e centri, bounds ruotati, margini del gruppo alle sei facce e costo box teorico.

L'algebra dei layout non campiona un campo di densità. La verifica non ricostruisce primitive tramite RNG, field, volume, bake, shader, RGB o immagine. Il record dell'esecuzione originale dimostra l'asserzione di uguaglianza completa dei sei stencil; qui i dati baseline direttamente ricontrollabili sono i byte/digest originali, le densità/raw ai sei punti e i prefissi dei tre raggi. Non è una verifica indipendente dell'intera geometria, skip mask o GPU.

`noRNG` nei JSON originali significa assenza di RNG autoriale del layout; il campionatore storico ricostituiva le consuete tabelle cellulari seeded. Conservazione dei primitivi e volume ellissoidale non significano conservazione di massa ottica.
