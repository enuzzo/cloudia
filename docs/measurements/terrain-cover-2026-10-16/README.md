# Evidenze v54 — terreno con copertura ESA WorldCover

Pacchetto curato del16ottobre2026, r2 con campionamento per fragment. La prima rappresentazione per vertice è ritirata e rimane nell'archivio esterno cycle20.

- `preprocess/`: protocollo congelato, script originale, metadati, header sorgente, piano Range, risultati, witness e figure scientifiche. Le figure mostrano dati, non il renderer. I15 Range originali rimangono nell'archivio completo esterno; il presente pacchetto non dichiara di contenerli o rielaborarli.
- `source/`: manifest espliciti dei119 sorgenti e dei30 file di build, log341/341 test e build app→hero. Nessun ambiente o dipendenza copiati.
- `browser/`: JPEG della superficie CSS; non sono framebuffer nativi. Include riferimento v53 e viste r2.
- `benchmark/`: raw JSON del report intenzionalmente esposto nell'interfaccia, compressi senza modificare il testo. Cadenza di invio e prefisso coda; presentazione del compositore non misurata. Nessun confronto causale di speedup da queste singole caratterizzazioni.
- `next/`: sottoinsieme della ricognizione Sentinel-2, sola fattibilità. Il manifest originale si riferisce all'archivio esterno completo, non a questo sottoinsieme. Nessun pixel immagine decodificato o adottato.

`MANIFEST.json` verifica i file di questo pacchetto. `verify.py` verifica anche l'asset WCV1 del prodotto, somme e witness, log della suite e aritmetica dei report. Opzioni: `--verify-runtime-sources` per confrontare il checkout con i119 SHA, `--dist /percorso/cover-r2-dist` per i30 file di build. Non esegue GPU o un nuovo preprocess. La verifica dei sorgenti è appropriata soltanto quando il checkout corrisponde a questo checkpoint.

L'asset del prodotto conserva dodici classi di area; il renderer le raggruppa in otto materiali. Non è albedo misurata, densità fisica della canopia o certificazione di foresta naturale. Nessun PASS fotografico globale o60FPS sostenuti ricavato dalla provenienza dei dati.
