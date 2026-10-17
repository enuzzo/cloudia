# DEM125m — controllo scalare necessario, preparato prima del run

Una sola esecuzione root dopo review; nessun modello/mesh, seam, frame, build, test o GPU. Il goal autorizza già il lavoro: questo è il checkpoint operativo di protocollo e budget. Nessun'altra diagonale/risoluzione dopo FAIL.

A è il holdout v61 già salvato in cycle43: stream F64 combinato con fit591.361 e holdout589.824. Il programma autentica run/result, tutti i sei digest geometrici A dichiarati e il raw stream completo; riusa soltanto i4.718.592 byte holdout all'offset4.730.888. Non ricostruisce A e non usa il B31,25 respinto.

Punti, ordine, dominio±48km e maschera provengono dal `POINTS.json` precedente, pinned byte-esatto:768² centri `−48+(i+.5)*.125`, ordine Z poi X. Land è `coastKm>=0` dal bilineare canonico, uguale per A/B. Il programma importa il decoder/sampler e `terrainMeshSurfaceY` canonici; nessuna copia o nuova formula della sfera.

Per ogni cella125m: campionare i nodi SW e NE, calcolare esattamente `Math.fround(terrainMeshSurfaceY(x,z,h))` per ciascun endpoint e prenderne la media. Il centro è sulla diagonale SW→NE di entrambe le facce. Riferimento: `terrainMeshSurfaceY` sul campione DEM bilineare del centro. Errore F64 in metri=`1000*(Yref−Ytri)`, stesso segno/aritmetica del precedente stream. Non c'è nuova quantizzazione degli errori.

Salvare UN `errors.f64le.gz` completo (589.824 F64LE/4.718.592 byte raw, gzip lossless), SHA raw/gzip, riferimenti A e POINTS, maskSHA, statistiche compatte global/land A/B e conteggi delle regressioni. P99 assoluto: valori ordinati, indice zero-based `floor(.99*(n−1))`, nessuna interpolazione/tolleranza. RMS usa accumulo Float64 compensato; stream integrale disponibile per verifica indipendente.

Gate holdout congelato, senza cambi dopo i risultati: RMS land B strettamente inferiore ad A; p99 assoluto **globale** e massimo assoluto **globale** B non maggiori di A. FAIL ferma la proposta prima del codice topologico; nessuna diagonale alternativa o ricerca di parametri. PASS è soltanto potenzialità necessaria del centro-cella: non qualifica fit/near/bordi/lookup/seam/normali/materiale/ombra o costo della futura mesh.

Budget del solo child:10CPU/20wall, RSS terminale Darwin≤384MiB. Launcher riusato ridotto: RLIMIT_CPU10, watchdog wall20 e `wait4` perPID, niente AS/ps/retry; stdout/stderr e uscita anche in FAIL. Bun `--no-install`, cache fuori Dropbox; dipendenze esistenti ignore1 controllate e input pinned prima/dopo. Nessuna installazione o mutazione prodotto. `run/` esclusivo impedisce una seconda esecuzione nello stesso checkpoint.

Comando destinato esclusivamente a root dopo la review: `python3 run.py --execute-authorized --freeze-sha256 SHA_APPROVATO`. La preparazione contiene solo I/O, sorgenti e hash; nessuno scalare è stato eseguito.
