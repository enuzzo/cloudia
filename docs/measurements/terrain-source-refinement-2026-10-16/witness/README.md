# Witness del raffinamento: preparato, non eseguito

Questa cartella prepara due tentativi separati, **OFF prima di ON**, contro il candidato congelato da root. Non sono stati avviati Bun, mesh, query, test, compilazione o GPU da questo pacchetto. Il prodotto e i sorgenti candidati non sono stati modificati.

Il manifest candidato è `../refine-qualification-r1/source-manifest.json`, 126 file, SHA256 `83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00`. Il riferimento è il risultato storico `../geometry-preflight/run/result.json`, SHA256 `5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`.

## Approvazione ed esecuzione futura

1. Root esamina `witness.ts`, `run.py`, `PROTOCOL.json` e `REVIEW-FREEZE.json`. Quest'ultimo è solo un inventario per la revisione, non autorizza il run.
2. Dopo l'approvazione, root ne conserva una copia come `PRE-RUN-FREEZE.json` con stato `ROOT_APPROVED_UNEXECUTED`. Il launcher ricontrolla hash e dimensioni di tutti gli input richiesti, i 126 sorgenti e le dipendenze già presenti, senza installazioni.
3. Solo su autorizzazione esplicita esegue, da questa cartella:

   ```sh
   python3 run.py --execute-reviewed off
   ```

4. ON è eseguibile solo dopo `run-off/run.json` **PASS**, parità completa e budget PASS:

   ```sh
   python3 run.py --execute-reviewed on
   ```

Ogni comando crea una directory esclusiva (`run-off` / `run-on`) che consuma il tentativo anche se fallisce il preflight. Non rimuoverla o riusarla per riprovare. Il launcher avvia un solo child Bun e osserva la sua terminazione; non esegue un secondo modello o un retry.

I limiti per modalità sono CPU child hard 20s, CPU combinata wrapper+child al terminale 20s, wall totale 40s, somma dei picchi RSS Darwin 2GiB. La somma dei picchi è conservativa e non rappresenta RSS simultaneo; il limite RSS è un gate terminale, non un limite di memoria imposto dal sistema operativo.

## Che cosa viene confrontato

OFF costruisce una volta il **nuovo** modulo senza refinement. Confronta i cinque buffer completi (positions, normals, surface, indices, cellFirstIndex), tutte le statistiche della mesh, aggregati/ring e il digest dei 591.361 errori con il vecchio risultato salvato. Non ricostruisce il vecchio modulo e non deduce parità da due chiamate allo stesso codice cambiato.

Il digest storico degli errori è `6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`. Il vecchio stream non era stato conservato. Il nuovo `run-off/errors.f64le` è una **riproduzione autenticata** solo se OFF conclude tutti i gate; non è il recupero del vecchio file.

ON costruisce una volta con la configurazione esatta dell'engine: griglia dai metadata DEM, dominio ±48km, soglia di selezione 5m, 600.000 probe / 1.000.000 vertici / 2.000.000 triangoli / 64MiB di geometria. Verifica i prefissi originali positions/surface e la contabilità delle celle/indici; non richiede vecchi faceIndex, normali o indici identici. Riporta nuovi vertici, triangoli, byte, chiamate, tempi e tutti gli aggregati degli stessi nodi.

ON usa lo stream OFF verificato per contare errori assoluti migliorati, peggiorati e uguali senza epsilon, cambi di segno, attraversamenti della soglia stretta >5m e top8 regressioni/miglioramenti. Anche `run-on/errors.f64le` viene conservato: entrambi sono Float64LE, un errore firmato in metri per nodo, senza header, ordine crescente iz poi ix, 4.730.888 byte ciascuno. Il futuro verificatore può ricalcolare il confronto senza rieseguire la mesh. Nessun grande array di errori viene serializzato in JSON.

`run.json` distingue **status** (esecuzione completa, validata e nei budget) da **selectionFitGatePASS** (decisione numerica predefinita in `../refine-decision-protocol.json`). ON può completarsi correttamente ma non superare il gate di fit. Il gate richiede RMS globale e landMask inferiori, massimo assoluto globale non oltre baseline+1mm e RMS landMask dei ring2/3/4 inferiori; tutte le altre regressioni restano nel report. La soglia di selezione 5m non promette un errore finale ≤5m o il miglioramento di ogni nodo.

## Limiti

Si misurano gli stessi nodi usati per selezionare le facce: è **fit, non holdout**. Gli attributi della mesh sono Float32, ma lookup e statistiche sono JavaScript Float64. Il confronto non dimostra parità GPU/WGSL, errore continuo o areale, accuratezza del DEM, causa delle ombre, qualità fotografica o 60FPS. La categoria coast>=0 è una maschera materiale e il ring4 è campionato soltanto nella sua intersezione con ±48km.

Il cap 64MiB conta il payload dei buffer geometrici, non lookup CPU, Map e temporanei; il gate RSS è separato. I controlli di contiguità/count/index non sostituiscono una prova topologica completa o la qualifica nativa. Non sono previsti nuovi raggi, ROI o ricerche di casi.
