# Griglia terreno allineata: confronto geometrico respinto

17 ottobre 2026, ciclo47. **FAIL del criterio numerico fissato prima delle prove. Nessuna modifica al prodotto, build o nuova prova GPU; v61 invariata e goal attivo.**

La sola variante B usa una griglia base di31,25m invece di32m, allineando gli anelli al reticolo altimetrico di125m. Restano256celle/9livelli, lo stesso sampler Copernicus GLO90, la stessa trasformazione sferica e geometriaFloat32, normali geometriche, raffinamento singolo sopra5m e cap1milione vertici/2milioni triangoli/64MiB. L'estensione esterna cambia1048,576→1024km: non è identità globale.

Due sole mesh effettive, in child sequenziali. A riproduce esattamente i sei hash geometrici e lo stream storico dei591.361 nodi di fit prima di consentire B. Il vecchio archivio non conservava gli array geometrici necessari al nuovo holdout: il rebuild di A serve per quei punti intermedi, senza fingere un loro recupero dal solo digest. I due child terminano exit0;19pin e Dropboxignore1 prima/dopo, nessun retry. Freeze del runner `3c3c394c0864ef6a1326b6265b1a73c90f9bccc753458aa63525e59bb2d7183b`.

Prima delle mesh sono congelati591.361 nodi di fit e589.824 centri di celle come holdout, ordine e coordinate fisiche identiche per A/B nel core±48km. L'holdout non seleziona il refinement. Riferimento: stesso campo bilineare GLO90+sfera; non ground truth indipendente. Maschera terra:coast≥0 del materiale. ErroriF64LE in metri conservati integralmente in due streamgzip lossless da9.449.480Braw ciascuno. Anche analisi e criterio root sono congelati prima delle mesh: p99=sortedabs[floor(.99*(n−1))].

| Misura | A32m | B31,25m |
|---|---:|---:|
|RMS terra sui nodi di fit|11,641m|9,956m|
|RMS terra sui punti holdout|7,387m|8,159m|
|Massimo assoluto sui nodi di fit|96,066m|125,755m|
|p99 assoluto holdout globale|25,009m|25,690m|
|Massimo assoluto holdout globale|87,030m|75,313m|
|Vertici /triangoli|591.788 /1.182.550|568.304 /1.135.582|
|Payload geometria|33.127.816B|31.812.712B|

**Root e revisione indipendente: FAIL.** Migliora l'adattamento ai nodi, ma peggiora la superficie tra i nodi. Falliscono tre condizioni prefissate: massimo fit non maggiore, RMS terra holdout inferiore e p99 globale holdout non maggiore. Il massimo holdout e i conteggi geometrici migliori non compensano queste regressioni. L'RMS terra holdout peggiora in4/5bande fisicheA, compresa8,192–16,384km da1,481 a4,711m; non è una semplice penalità su un estremo isolato.

Regressioni locali salvate: fit407.601 migliorano/183.705 peggiorano/55 uguali, incremento massimo dell'errore assoluto101,098m; holdout244.539 migliorano/345.283 peggiorano/2 uguali, incremento massimo62,721m. I punti holdout globali oltre5m aumentano84.063→116.541. Non deduco un difetto fotografico specifico senza immagine, né una causa unica. I campioni discreti non certificano accuratezza continua e la soglia5m di selezione non diventa una garanzia finale.

A:2,416s wall/2,754s CPU/888.815.616B peakRSS child; B:2,267s/2,632s/852.836.352B. Ogni child è entro20CPU/30wall/1,5GiB RSS terminale, conwait4 perPID e nessunAS/ps. Launcher separato:CPU0,170s/wall4,859s. I tempi CPU e la geometria più piccola non dimostrano un guadagnoGPU oFPS.

Stop di questo spacing: nessun'altra larghezza, tuning, build o confronto nativo/meteo/worker/moto/FPS. La copia141 esterna `candidate-source` è soltanto v61 esatta preparata prima delle mesh e mai editata/compilata. Canonico141 esatto; niente lockfile/installazione o nuove cartelle rigenerabili inDropbox. Node_modules2 e4201 estranei preservati; preview4196 ordinaryv61 resta ripristinata alSole/nube matura animata, output2474×1844 e console osservata[] nel ciclo45. Nessun push/deploy.

Prossima direzione concreta: una patch che usi direttamente il reticoloDEM125m nel core misurato, con raccordo conforme agli anelli esterni e lookupcamera coerente. Prima verificare conteggi/cap e fattibilità; la proposta non è implementata o eseguita qui e non promette rocce sotto la risoluzione della fonte. Evita un altro spostamento della griglia e affronta la rappresentazione tra campioni.

La geografia reale comprese le aree abitate rimane nel medesimo materiale, senza edifici3D o pass aggiunti per le città. Anatomia delle tre famiglie, luce ravvicinata/moto, pioggia/virga, terreno finale, UI e60FPS restano aperti. La pioggia pesante precedente circa19invii/s non è stata rimisurata.

[Archivio](measurements/terrain-grid-alignment-trial-2026-10-17/README.md):40payload/15830702B, manifestSHA256 `d33d1af08a1ffe74d5726133a9500f4500887afa919ac97b3979806102b37117`. [Verifica conservazione](TERRAIN-GRID-ALIGNMENT-VERIFICATION-2026-10-17.json). [Prossima azione concreta](measurements/terrain-grid-alignment-trial-2026-10-17/review/terrain-dem-node-patch-next-action.md).
