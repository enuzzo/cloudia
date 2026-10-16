# Raffinamento geometrico — candidato e overlay finale v59

Il pacchetto conserva il candidato esterno `experiment-v58-source-node-refinement`, manifest **126 file** SHA256 `83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00`. La base è v58, manifest **124 file** SHA256 `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`.

Il root ha poi adottato **`observatory-v59-terrain-source-refinement`**, manifest finale126 SHA256 `fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2`. `final/` è un overlay separato: soltanto il literal della versione nell'engine e la corrispondente aspettativa lifecycle differiscono dal candidato; gli altri 124 hash restano uguali. Non si riscrivono i risultati del candidato attribuendoli a nuovi benchmark finali.

OFF riproduce esattamente la base salvata. ON supera i gate di fit dichiarati e i budget. Le immagini native Sole/Pioggia mostrano un beneficio incrementale; il successivo confronto Tramonto supera un gate limitato di non regressione visibile. Il costo A/B/A locale supera il gate conservativo di costo, **senza prova di speedup o 60 FPS**. Le regressioni dei singoli nodi e i difetti shadow preesistenti restano espliciti in `REPORT.md`.

## Conservazione

- `source/`: manifest base/candidato, sei sorgenti cambiati gzip, patch completo e controllo di ricostruzione in memoria, patch originario e provenienza dell'integrazione. Il controllo ha letto i 124/126 file espliciti per hash, senza eseguirli.
- `witness/`: protocolli/freeze, programmi originali e due run. Ogni stream gzip restituisce esattamente **4.730.888 byte Float64LE**, uno per ciascuno dei 591.361 nodi. OFF è una nuova riproduzione autenticata; il vecchio stream non fu conservato.
- `saved-stream-verification/`: originali della verifica indipendente, **2.958 controlli PASS**, senza replay del modello. I path dei programmi originali restano storici; non si promette che funzionino immutati nel layout curato.
- `qualification/`: 72 test mirati, 435 test totali in 46 file, APP→hero e manifest dist30. Nessun intero dist o clone sorgente incluso.
- `browser/`: quattro PNG nativi (candidato Sole/Pioggia/Tramonto e baseline Tramonto), relativi metadata/transfer e review. Il PNG worker Sole è deduplicato sul main byte-identico; i suoi metadata/transfer rimangono distinti.
- `cost/`: protocollo predefinito, tre raw A/B/A gzip, console e validazioni R1/R2. R1 conteneva un errore del validatore sul conteggio lifetime shadow; R2 corregge il criterio start/end, senza nuovi benchmark o modifica ai raw.
- `REFERENCES.json`: pin dei payload già archiviati e del DEM runtime, senza copie massive di preflight, baseline Sole/Pioggia, vecchio trial caster o asset.
- `final/`: manifest 126, soli due sorgenti cambiati rispetto al candidato e relativo patch, record d'adozione, qualifica finale435/435 in 46 file e APP→hero, verifica saved-bytes del root. Gli altri quattro sorgenti del cambiamento restano nella copia candidata. Il PNG Sole finale coincide byte per byte col candidato e usa un alias; metadata/transfer e preview/proof ordinari v59 sono conservati separatamente.

`MANIFEST.json` mappa ogni file conservato al proprio originale, con encoding, byte e SHA256 sia stored sia raw; gli alias deduplicati sono espliciti. I payload compressi sono lossless, senza trim o riscrittura degli originali. Il manifest esclude se stesso. I contenuti generati durante la curazione sono marcati come tali.

## Verificatore preparato, non eseguito durante la curazione

Il nuovo `verify_saved.py` usa soltanto la standard library, decompressione limitata e dati salvati. I comandi seguenti sono **previsti per la revisione del root, non eseguiti qui**:

```sh
python3 verify_saved.py
python3 verify_saved.py --runtime-source /percorso/al/repository
python3 verify_saved.py --base-source /percorso/alla/base-v58 --runtime-source /percorso/al/repository
```

Il controllo base verifica inventario, stream e gruppi global/ring, aritmetica dei report, gate di costo e header/metadata PNG. `--runtime-source` consente di verificare i riferimenti e leggere soltanto i codici coast del DEM pin per ricostruire anche land/sea; senza quel dato non dichiara di aver ricalcolato quelle maschere. `--base-source` verifica i 124 sorgenti e applica il patch in memoria, ottenendo i 126 hash candidati senza scrivere o eseguire il codice. Nessun modello, test, installazione, build, browser o GPU è avviato dal verificatore.

Il verificatore è stato preparato prima dell'overlay finale; questo viene controllato genericamente per hash/raw-byte e alias nell'inventario. La verifica specifica dei due literal finali, dei 126 sorgenti, dei test/build, del PNG e della preview appartiene a `final/root-final-adoption-verification.json`, prodotta separatamente dal root. Non viene promesso un nuovo replay finale dal verificatore. La revisione originale non eseguita è conservata losslessly in `verifier-revisions/r1/`.

La riproduzione completa del programma numerico richiede invece una base ricostruita, l'overlay completo, dati/runtime/dipendenze pin e una nuova autorizzazione con budget. Non è una conseguenza automatica della verifica d'archivio. I nodi sono quelli usati per la selezione: **fit, non holdout**, accuratezza del DEM o bound continuo. Native PNG e code complete non provano la cadenza del compositor, tutte le pose o accettazione fotografica globale.

## Correzione del verificatore R2

Il primo run saved-evidence è terminato FAIL perché R1 pretendeva stderr vuoto per i witness. I tre record JSON di avanzamento erano previsti dal witness e non erano errori. R2 accetta soltanto quei tre eventi strutturati, ne confronta modo, conteggi e digest con i risultati, e rifiuta altre righe. R1, manifest originale, freeze e run fallito sono conservati in verification-r1/. Nessun modello, test, build, browser o misura è stato ripetuto. R2 è preparato e attende il run root.
