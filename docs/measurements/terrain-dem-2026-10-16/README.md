# Terreno misurato — prove del checkpoint R2, 16 ottobre 2026

Questo archivio conserva la provenienza del DEM, le prove visive raccolte da Root via CUA e un singolo benchmark del renderer **observatory-v53-measured-terrain**. Il terreno centrale usa dati Copernicus GLO-90; la prova non certifica l'intero prodotto come fotografico e non raggiunge il traguardo di 60 FPS stabili.

| Prova | Risultato e ambito |
|---|---|
| Asset CDM1 runtime | SHA `92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d`, 4.202.532 byte; nessuna seconda copia nell'archivio |
| Campo consegnato | 1025² nodi a 125 m, quadrato ±64 km; quota massima 2.146,75 m, oceano a quota zero |
| Runtime R2 | Manifest di 113 sorgenti; 28 file del dist esterno censiti separatamente, senza copiarne i payload |
| Suite R2 originale | 41 file / 328 test PASS; log originale compresso senza perdita, nessuna nuova suite eseguita durante l'archiviazione |
| Main, pioggia | 436 intervalli in 30.002,3 ms; **14,532219 invii/s**, mediana 66,7 ms, p95 84 ms, p99 200 ms, massimo 216,7 ms |
| Coda | Prefisso 436/436 completato, nessun invio misurato ancora non confermato; drenaggio finale 278,6 ms |
| Qualità della finestra | Output e interno 2474×1844, ultra, 384 passi, volume 256³ e dettaglio 128³, flusso e ablation completi, densità R8 invariata |
| Main / Worker | Root ha verificato Sole, Tramonto e pioggia Main, Sole Worker; console salvate vuote. Nessuna prova di parità bit Main/Worker |

## Geografia e quote

Il dataset è un **DSM**: comprende vegetazione e costruzioni, senza identificare da solo bosco, roccia o terreno nudo. La griglia ricampionata a 125 m non inventa dettaglio più fine della sorgente GLO-90. L'origine è 44° N, 10° E, X verso ovest e Z verso nord; la proiezione locale equirettangolare è dichiaratamente un'approssimazione geografica. Le quote EGM2008 sono applicate al livello marino sferico esistente, senza esagerazione verticale.

Il runtime usa integralmente il campo misurato nel quadrato centrale **±48 km**; sfuma fra 48 e 64 km e conserva il terreno procedurale all'esterno. Non tutto il paesaggio visibile è quindi geografia misurata. Il massimo del mesh completo riportato nel benchmark, circa 3,026 km, include l'esterno procedurale e non è il massimo del solo DEM.

La costa deriva da quote inferiori a mezzo metro collegate al bordo, con distanza raster approssimata; non è una costa vettoriale ufficiale né batimetria. Le quote CDM1 sono u16 a passi di 0,125 m e la costa i16 a passi di 8 m. Il preprocess originale registra errori massimi inferiori a 0,0625 m e 4 m, oltre al controllo delle giunzioni fra le quattro tessere. Il verificatore dell'archivio rilegge l'asset consegnato: non ricalcola la reproiezione dei TIFF, la loro continuità, il flood oceanico o l'errore rispetto ai float sorgente.

La figura scientifica e lo script che la produce sono conservati originali. Licenza estratta (gzip lossless per conservarne anche gli spazi originali), credito esatto, provenienza della licenza e manifest delle quattro tessere sono in `preprocess/`; i TIFF e i buffer intermedi non sono duplicati.

## Rendering e immagini

La geometria R2 è un mesh statico cucito di 465.409 vertici e 929.792 triangoli. Il primo triangolo visibile determina la superficie: non è l'intersezione esatta con il campo bilineare. Le normali sono condivise e pesate per area sulle facce effettive; colore e ombre rimangono aggiornati a ogni rendering. Il report dichiara 26.050.592 byte di geometria, 2.359.296 byte di lookup CPU, 91.241.120 byte per target terreno/depth nativi e 33.554.432 byte per l'ombra. Sono payload nominali conservati, non memoria totale del driver o picco di costruzione. Nessun campionamento CPU delle quote per frame è dichiarato.

Le immagini in `browser/` sono JPEG originali ottenuti dalla cattura CSS, inclusi i controlli dell'app. Conservano il confronto visivo R5 → DEM R1 → DEM R2 al Sole, crediti, Worker, Tramonto R2, preview finale animata e interfaccia del benchmark. I metadati separano dimensioni del JPEG da dimensioni del canvas. Non sono PNG nativi, video continuo, confronto numerico di radiance né prova di presentazione. Non deduciamo una camera identica dai soli JPEG. Il credito mostrato e le console vuote sono riscontri circoscritti alla sessione osservata.

## Cadenza e timestamp

Il raw Main è conservato integralmente in `benchmark/dem-r2-rain-benchmark.json.gz`, SHA decompresso `b99d7601c433f7b256577b87304594da74a51e051a3ab8b47e8896bdab877ed6`. `summary.json` ne seleziona stato, tempi, copertura e limiti. Il seme è 74 e la simulazione resta in pausa a t60; il clock meteorologico avanza. Il valore di pioggia registrato è 0,799986927810866, conservato senza arrotondarlo a 0,8. Il tasso limitato dalla conferma finale del prefisso è 14,398705 invii/s e include backlog ereditato e consegna JS: non misura throughput GPU isolato.

La copertura timestamp è di **431 draw completi e 5 mancanti** su 436, senza draw parziali, invalidi o in conflitto; sono 1.724/1.744 chiamate render e 431/436 compute abbinate. Le somme restituite non sono additive come costi esclusivi: il separato `timestamp-audit/` conserva 12 draw diagnostici reali di R5, quattro ruoli/pipeline distinti e gli estremi assoluti che si sovrappongono. Questo dimostra un limite dell'interpretazione, non la causa hardware, parallelismo effettivo o un costo di circa 60 ms attribuibile al terreno. Non si ricava FPS dividendo o sommando quei tempi.

La precedente finestra v52 aveva geografia diversa: nessuna percentuale causale viene confrontata con questo singolo run R2. La frequenza delle immagini presentate dal compositor è **non misurata**.

## Verifica e riproducibilità

Dal repository, una volta collocato in `docs/measurements/terrain-dem-2026-10-16`:

```sh
python3 docs/measurements/terrain-dem-2026-10-16/verify.py
python3 docs/measurements/terrain-dem-2026-10-16/verify.py --verify-runtime-sources
```

Il secondo comando richiede un checkout che riproduca i 113 SHA del R2 storico; non va interpretato come requisito che ogni futura revisione mantenga gli stessi sorgenti. Per questa copia di staging:

```sh
python3 /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle19/terrain-dem-evidence-staging/verify.py --repo /Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia --verify-runtime-sources --dist /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle19/dem-r2-dist
```

Il verificatore usa solo la libreria standard: controlla SHA e header CDM1, tutte le quote oceaniche e alcuni valori testimone, aritmetica della finestra, qualità completa, coda, payload dell'archivio e l'audit timestamp già congelato. Non esegue GPU, benchmark, preprocess o build. L'opzione `--dist` verifica solo i 28 file esplicitamente elencati; il manifest del dist censisce la directory congelata, non afferma che ogni file sia una dipendenza attiva della pagina osservata.

`receive-benchmark.py` è la funzione esplicita usata per importare il raw e la console Worker. Non osserva cartelle o avvia lavoro automatico; rifiuta scritture quando esiste `MANIFEST.json`. Il manifest esterno è stato prodotto per ultimo. Le sorgenti originali dei preprocess e i loro protocolli sono conservati per il replay con i quattro TIFF descritti dal manifest; questi input voluminosi restano fuori da questo archivio.
