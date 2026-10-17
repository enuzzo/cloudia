# Sezione64 — preparato, non eseguito

Unico diagnostico seriale A→B, seed74, size64, sulle96 Z dell’asserzione esistente. Entrambi i `generateVolume(64,74)` restano completi: nessun bake saltato, nessun ramo no-op, nessuna modifica a ricetta, warp o carving.

A è il volume canonico c349e8f7 (manifest141 2577f187); B è il volume congelato6b8f59bf (manifest144 3b29dd3b). Le copie raw dei10 moduli necessari sono autenticate in `input-pins.json`; i due manifest completi sono conservati come prova di provenienza. Non si dichiara una nuova verifica di tutti i file del checkout vivo.

Due soli hook vengono inseriti in memoria dopo la verifica degli input e prima di `transpileModule`: uno prima del prune conserva il campo e una copia della densità; l’altro osserva il risultato del vero `sampleCloudDensity`. La formula finale viene calcolata una volta, nello stesso ordine, e restituita invariata. Durante i bake l’osservazione dei campioni è disattivata. Il resto dei moduli viene trasposto senza patch.

I96 punti e l’ice del chiamante riproducono `inclinedShoulder.test.ts`. Per ogni punto il report conserva r/g/b, spostamento, coordinate normalizzate, R interpolato, erosione, materiale, densità finale e8 vicini: indici, centri, pesi, R8, fieldFloat32 e densityFloat32 prima del prune, con bit. Solo l’indicizzazione/interpolazione viene ripetuta per recuperare i vicini; warp e carving vengono eseguiti dalle funzioni originali. L’interpolazione R8 deve essere identica al valore effettivo osservato, altrimenti il run si ferma.

Il riepilogo riporta quantità di campioni positivi e massimo finale/R/campo con indice e coordinate; non richiede a priori che A sia pieno o B vuoto. Il campo è ricontrollato tramite SHA dopo la generazione. I valori di campo/densità interpolati restano riferimenti discreti, non una nuova valutazione della geometria continua.

Il wrapper richiede il digest esplicito di `FREEZE.json`, verifica file e dipendenze, rilegge xattr=1 e crea `run/` soltanto se assente. Usa il Node arm64 autenticato e TypeScript5.9.3 tramite il solo symlink delle dipendenze esistenti; nessuna installazione. Nessun accesso a `node_modules 2`.

Budget unico per A+B:20CPU,30s wall del child,384MiB RSS,40s outer. Il limite CPU del child è OS; monitor Darwin `proc_pid_rusage` ogni50ms, heartbeat5s, terminale noto tramite Popen/wait. Il gate terminale include CPU wrapper dalla sua entry e la somma conservativa dei picchi RSS child+wrapper (non un falso picco simultaneo). I monitor non garantiscono interruzione istantanea fra due poll o durante I/O bloccante. Nessun retry automatico.

Comando SOLO dopo revisione root (sostituire il digest con quello comunicato):

```sh
python3 /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle41/section64-diagnostic/run.py --execute-reviewed --freeze-sha256 FREEZE_SHA256
```

Output: `run/result.json`, `run/stderr.log`, `run/execution.json`; nessun volume completo salvato. `run/` già esistente impedisce il replay e non viene cancellato. Questo pacchetto è solo preparazione: né il runner né il wrapper sono stati eseguiti, nessun modello/test/transpile è stato avviato. L’eventuale esito64 non prova il comportamento256, la GPU o l’accettazione artistica. Le note precedenti e gli archivi restano immutati.
