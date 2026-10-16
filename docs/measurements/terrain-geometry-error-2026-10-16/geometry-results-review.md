# Review indipendente della misura geometrica — ciclo 28

La misura salvata rende concreta una perdita di fedeltà geometrica nei ring esterni: sulla maschera terra l'RMS osservato passa da **0,213 m** nel ring 0 a **30,071 m** nella porzione campionata del ring 4. È un confronto fra campo di quota sorgente e sua mesh effettiva; non è una misura dell'accuratezza del DEM rispetto al terreno reale e non identifica la causa delle ombre o dei puntini.

Review basata su protocollo, freeze, programma, wrapper e JSON salvati. Nessun nuovo Bun, test, kernel, raggio, build o GPU; soltanto lettura e aritmetica sui record. Il verificatore dell'archivio è preparato separatamente e resta non eseguito fino al via del root.

## Input e misura effettiva

- Base v58: 124 sorgenti, manifest SHA `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Freeze pre-run SHA `e786a324da35961ca8cc5ab83760ca9cb9989a90a7a8f5b8e04235aa168406da`.
- Output `geometry-preflight/run/result.json`: **2.532.734 byte**, SHA `5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`.
- Una mesh Float32 con 256 celle per lato, nove livelli, passo base 32 m: 465.409 vertici, 929.792 triangoli, 4.096 celle fan. Il run dichiara identità esatta delle statistiche e di indici/vertici delle 17 facce del witness precedente. Questi controlli sono nel programma eseguito; il verificatore saved-evidence non ricostruirà la mesh per ripeterli.
- Tutti i **591.361 nodi** originali della griglia 125 m nel quadrato chiuso ±48 km, indici 128–896 inclusi, ordine Z/X. Nessuna ricerca adattiva o selezione per errore. Le 465.409 chiamate del sampler per costruire la mesh sono dichiarate separatamente dalle 591.361 query di misura.
- Errore: `1000 × (Ydem − Ymesh)`, con la stessa trasformazione sferica terrestre del prodotto. Positivo significa mesh sotto il campo sorgente; negativo significa mesh sopra. Non è distanza lungo la normale o lungo il raggio camera.

## RMS sulla maschera terra

Il ring usa il raggio quadrato `max(|x|,|z|)` con soglie Float32. Gli intervalli sotto sono arrotondati per lettura. La maschera deriva dal codice coast salvato (`coast>=0`), non da una nuova classificazione fisica terra/mare.

| Ring | Intervallo campionato del raggio quadrato km | Passo nominale mesh m | Nodi all | Nodi landMask | RMS landMask m |
|---|---|---:|---:|---:|---:|
| 0 | 0–4,096 | 32 | 4.225 | 36 | 0,213317 |
| 1 | 4,096–8,192 | 64 | 12.936 | 3.696 | 2,015450 |
| 2 | 8,192–16,384 | 128 | 52.008 | 23.296 | 8,055547 |
| 3 | 16,384–32,768 | 256 | 206.456 | 117.505 | 16,106521 |
| 4 | 32,768–48,000 | 512 | 315.736 | 190.056 | 30,071097 |

Il ring 0 contiene soltanto 36 nodi della maschera terra: il suo piccolo RMS non certifica ogni rilievo ravvicinato o ogni punto fra nodi. Il ring 4 della mesh arriva teoricamente a 65,536 km, ma questa misura si ferma a ±48 km; non descrive tutta la sua estensione. Cambiano anche geografia e rilievo fra ring: la crescita dell'errore è osservata, ma non isola da sola l'effetto del passo rispetto alla composizione del terreno.

Complessivamente: **334.589 nodi landMask**, RMS **24,684421 m**, media signed **+0,106799 m**. I 256.772 nodi seaMask hanno RMS **0,954828 m**; insieme danno RMS globale **18,578115 m**. Una media signed prossima a zero può nascondere errori grandi di segno opposto: non è un criterio di fedeltà sufficiente.

Gli estremi osservati sono entrambi nel ring 4 e nella maschera terra:

| Errore m | Grid X/Z | Coordinate X/Z km | Interpretazione |
|---:|---|---|---|
| −261,538942 | [219,518] | [−36,625; +0,750] | Mesh sopra il campo sorgente |
| +209,989797 | [502,842] | [−1,250; +41,250] | Mesh sotto il campo sorgente |

Non sono massimi continui garantiti: sono gli estremi della popolazione di nodi prefissata. I top 8 e gli istogrammi conservano struttura e coda dell'errore senza conservare l'intero array.

## Esecuzione e conservazione

Il terminale del run unico è exit 0 e budget PASS: CPU combinata **1,711925 s** (child 1,664310 s + wrapper 0,047615 s), wall **1,428565 s**, somma conservativa dei picchi RSS **932.610.048 byte**, entro 20 s / 40 s / 2 GiB. Questa somma di due picchi separati non è la residenza simultanea misurata e non è un limite OS di memoria. I tempi interni di costruzione/query non sono un benchmark del renderer o una previsione FPS.

La preparazione R1 fallì prima del child perché `os.getxattr` non era disponibile. L'errore e il wrapper R1 ricostruito dalla diff sono conservati, senza chiamarlo un precedente run Bun. R2 cambia il solo accesso macOS a getxattr via ctypes; freeze e autorizzazione precedono l'unica misura effettiva. I documenti pre-run restano correttamente allo stato “preparato/non eseguito”; il risultato terminale separato documenta l'esecuzione successiva.

Il digest dello stream degli errori è `6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`, dichiarato per 4.730.888 byte Float64LE. Lo stream non è conservato: il digest non permette di ricostruire i valori mancanti, verificare nuove ROI o ricalcolare ogni statistica senza un nuovo run autorizzato. Il verificatore controllerà solo hash, partizioni, somme/RMS, istogrammi, record estremi e letture sparse opzionali dei codici DEM.

## Implicazione operativa e limiti

🌟 La misura sostiene l'esistenza di errore di approssimazione disponibile su cui valutare un intervento geometrico circoscritto; non dimostra che uno specifico split lo riduca né che migliori la fotografia. Una futura proposta deve essere confrontata sugli stessi nodi e qualificata separatamente per coste/creste, assenza di pattern, costo e immagini native.

Non sono stati campionati interni o bordi delle celle, né calcolati errori di silhouette, normali, visibilità solare o pixel. Le medie sono per nodo, senza quadratura areale continua. Non si certifica l'accuratezza del DSM Copernicus, non si attribuiscono causalmente le scaglie alle quote e non si adotta alcuna geometria. La proposta di split esterna eventualmente archiviata resta **non eseguita** e fuori dall'ambito del verificatore numerico di questo preflight.
