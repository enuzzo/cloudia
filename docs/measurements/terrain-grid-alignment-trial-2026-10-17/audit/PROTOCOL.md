# Unico confronto geometrico A32/B31,25 — preparato, non eseguito

Due child CPU sequenziali, nessuna GPU, nube, build, installazione o modifica prodotto. Importano direttamente il builder canonico, non una sua copia riscritta. La sola differenza di input B è `spacingKm=.03125` contro `.032`:256celle/9livelli, normali geometriche, stesso DEM/sampler Float32+sfera, core±48km, una passata>5m e cap600k probe/1Mvertici/2Mtriangoli/64MiB restano quelli attuali. Un overflow ferma il confronto, senza retry o aumento dei limiti. I ring esterni cambiano estensione1048,576→1024km: nessuna identità globale promessa.

A non può essere riusata senza rebuild per il nuovo holdout: l'archivio v59 conserva errori di fit e digest, non i sei array della mesh. Si ricostruisce A una sola volta; devono coincidere i sei SHA256 storici e il digest Float64 del vecchio fit. Soltanto dopo tale parità, input immutati e budget A rispettato, parte B una sola volta. Nessun terzo modello. Il report storico e il suo stream gzip sono pin separati, non vengono modificati.

`POINTS.json` congela prima di A/B tutte le coordinate, senza elenchi JSON massivi: fit769² nodi originali fra−48 e48km inclusi, poi holdout768² centri delle celle della stessa fonte. Ordine Z poi X; nessuna scelta favorevole basata su B. Il fit è anche selezione del refinement; il holdout non seleziona. La riferimento è lo stesso campo bilineare GLO90 passato alla medesima `terrainMeshSurfaceY`; non è ground truth indipendente. Errori firmati `1000*(Yreference−Ymesh)` senza epsilon/quantizzazione nuova. Gli attributi geometrici restano Float32.

Ogni child conserva UN `errors.f64le.gz`: fit prima, holdout dopo,1.181.185 Float64LE/9.449.480 byte raw. Gzip è lossless; il digest fit A deve essere quello v59. Provenienza, conteggi, sei hash, statistiche del builder, limiti e durate sono JSON piccoli; gli array geometrici non vengono emessi. L'analisi indipendente successiva leggerà questi due stream per RMS/coda/estremi/regressioni e separerà fit/holdout, land/sea e bande fisiche A fisse dichiarate in POINTS. I ring non vengono riclassificati favorevolmente secondo B. Non è un certificato continuo d'errore o di qualità fotografica.

Per child:20CPU/30wall, RSS terminale≤1,5GiB da `wait4` Darwin, non limite d'allocazione. RLIMIT_CPU20; watchdog wall30 con terminazione del gruppo e raccolta terminale. Nessun RLIMIT_AS, `ps`, scansione memoria o esecuzione concorrente. Costi A/B distinti; costi del launcher riportati separatamente. Raw stdout/stderr e record di uscita restano anche in FAIL. Il launcher non riparte se `run/` esiste; A FAIL impedisce B.

`PRE-RUN-FREEZE.json` pinna i programmi, POINTS/protocollo, chiusura locale dei sette moduli importati, DEM, tre bundle Three186/package, Bun e due input storici. Prima/dopo ogni child si ricontrollano tutti i pin e Dropboxignore1 delle dipendenze esistenti. Cache del transpiler indirizzata soltanto fuori Dropbox; auto-install disabilitato. Nessun lockfile o dipendenza viene creato/modificato.

Il launcher richiede autorizzazione root esplicita e il digest del freeze:

`python3 run.py --execute-authorized --freeze-sha256 SHA256_APPROVATO`

Questa preparazione non è autorizzazione a eseguirlo. Un successo operativo/parità non promuove B: serve prima una riduzione geometrica reale sui medesimi punti, giudicata dai dati salvati. Nessun altro spacing, nuovo gate estetico, renderer o benchmark è incluso.
