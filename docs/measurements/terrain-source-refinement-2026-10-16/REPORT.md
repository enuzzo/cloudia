# Raffinamento della mesh rispetto ai nodi DEM

Il candidato riduce l'errore osservato della triangolazione sul core misurato e rende più articolati alcuni crinali nella posa nativa esaminata. **Fit, qualifica app, gate visivi limitati e costo locale sono PASS. Il root ha adottato v59 dopo una qualifica finale separata.** Il pacchetto conserva il candidato immutabile e distingue il successivo overlay finale.

Base124 SHA256 `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`; candidato126 SHA256 `83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00`, renderer `experiment-v58-source-node-refinement`. Il manifest dist30 è `463ac3bb91d29f67d437447ac8718077a48addf6b04086483e5cce9404cd45b5`. Durante la qualifica il prodotto rimaneva v58, HEAD locale `4047ace823ac0c8598e68c032d491a2a94b83a55`.

## Cambiamento

La selezione visita una volta i 769×769 nodi DEM nel quadrato chiuso ±48 km. Quando l'errore assoluto supera 5 m e lo span XZ della faccia originale è almeno 125 m, marca quella faccia. Un passaggio red/green divide le facce originali in 1/2/3/4 figli, con midpoint condivisi e winding mantenuto. I midpoint campionano lo stesso campo; le normali geometriche sono ricalcolate. La lookup rimane limitata a celle e ring, con al massimo 20 triangoli per cella. La triangolazione è preparata una volta, senza campioni CPU del terreno per frame.

I limiti engine sono 600.000 probe, 1.000.000 vertici, 2.000.000 triangoli e 64 MiB di payload geometrico. I nuovi 405 midpoint esterni al dominio di selezione derivano dalla propagazione conforme: non si promette che tutte le facce oltre ±48 km restino invariate. Il sampler DEM, materiale, palette, atmosfera, nube, pioggia e bias shadow non sono il cambiamento di questo candidato. Il vecchio trial caster/clipping scartato non viene adottato.

Quattro file esistenti sono modificati e due aggiunti; 120 file comuni rimangono identici, senza rimozioni. `source/candidate-vs-v58.patch.gz` ricostruisce tutti e sei i file in memoria. Il curator ha verificato gli hash dei 124 file base e dei 126 candidati; la ricostruzione non esegue il codice e non sostituisce la qualifica app.

## OFF e ON

OFF ha costruito una volta il nuovo modulo con refinement assente. I cinque buffer completi, statistiche e sampler count, aggregati/ring/top8 e digest dei 591.361 errori coincidono col risultato storico SHA256 `5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`. Non è stata ricostruita la vecchia implementazione per dedurre parità da due chiamate al codice modificato.

Il nuovo stream OFF, 4.730.888 byte, ha digest `6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`. È una **riproduzione autenticata**, non il recupero dello stream storico, che non era stato conservato. ON è partito soltanto dopo OFF completo e nei budget; conserva a sua volta lo stream, digest `58ca7139fc88f4f087854cb80a4901a8645536b23c7d504dc1c7bfecb7186093`.

L'errore firmato in metri è 1000×(Y DEM curvo−Y triangolo): positivo indica mesh sotto il riferimento. ON conserva esattamente i prefissi originali positions/surface; normali e indici cambiano, senza promessa sui vecchi faceIndex.

| RMS in metri | OFF | ON |
|---|---:|---:|
| Globale, 591.361 nodi | 18,578115 | 8,760919 |
| landMask, 334.589 nodi | 24,684421 | 11,641357 |
| seaMask, 256.772 nodi | 0,954828 | 0,419794 |
| land ring0 | 0,213317 | 0,213317 |
| land ring1 | 2,015450 | 2,015450 |
| land ring2 | 8,055547 | 4,334225 |
| land ring3 | 16,106521 | 8,032407 |
| land ring4 entro ±48 km | 30,071097 | 14,011065 |

Estremi globali signed: OFF −261,538942/+209,989797 m; ON −96,065502/+90,427707 m. Tutti i gate fissati prima dei run sono superati: RMS globale e land inferiori, massimo assoluto entro baseline+1 mm, RMS land ring2/3/4 inferiori e risorse rispettate. **La soglia di selezione 5 m non è un massimo finale garantito.**

| Confronto dell'errore assoluto | Tutti | landMask | seaMask |
|---|---:|---:|---:|
| Migliora | 225.051 | 224.074 | 977 |
| Peggiora | 55.125 | 55.051 | 74 |
| Uguale | 311.185 | 55.464 | 255.721 |
| Entra oltre 5 m | 12.883 | 12.879 | 4 |
| Esce da oltre 5 m | 69.448 | 69.199 | 249 |

Restano 153.094 nodi oltre 5 m, rispetto a 209.659; 42.775 errori cambiano segno. La regressione assoluta massima è **+54,222130 m** a X/Z [−1,625; 35,500] km: OFF −5,669415 m → ON −59,891545 m. Il miglioramento aggregato non implica il miglioramento di ogni valle o rilievo.

La verifica indipendente originale conclude **2.958 controlli PASS**, senza ricostruire il modello: ricalcola istogrammi, estremi/tie, top8, somme/RMS e classificazioni da entrambi gli stream e dai codici coast interi. Valori individuali, conteggi e classificazioni sono esatti; somme `fsum` contro Kahan con tolleranze dichiarate 2e−12 relativa e 1e−8 assoluta. Non rigenera gli array geometrici a partire dai loro hash.

## Geometria e costo CPU del programma numerico

| Voce | OFF | ON |
|---|---:|---:|
| Vertici | 465.409 | 591.788 |
| Triangoli | 929.792 | 1.182.550 |
| Payload geometria | 26.050.592 B | 33.127.816 B |
| Lookup CPU | 2.359.296 B | 2.949.120 B |
| Sampler calls nel build | 465.409 | 1.183.149 |
| Build mesh nel programma | 1.053,391 ms | 1.615,692 ms |
| CPU combinata al terminale | 2,018513 s | 2,790412 s |
| Wall launcher | 1,651520 s | 2,314884 s |
| Somma conservativa dei picchi RSS | 910.295.040 B | 1.189.593.088 B |

ON aggiunge 126.379 midpoint, 252.758 triangoli, 7.077.224 byte di geometria e 589.824 byte di lookup. Le 1.183.149 chiamate comprendono 591.788 campioni vertice e 591.361 probe. I limiti sono CPU combinata 20 s, wall 40 s e somma picchi RSS 2 GiB; entrambi i processi sono terminati con exit 0 e budget PASS. Le durate del programma sono singole osservazioni CPU, non startup browser o costo GPU. La somma dei picchi non è RSS simultaneo e il cap geometria esclude Map, lookup e temporanei.

## Qualifica app e immagini

Il candidato conclude **72/72 test mirati**, **435/435 test in 46 file**, APP→hero con exit 0. Le prove native usano seed74/sheared, output/internal/canvas 2474×1844, full 256³/128³/384, t60 paused e flow full.

| Prova | Verdetto limitato |
|---|---|
| Sole A/B | Root e review indipendente: PASS incrementale. Piccoli crinali/impluvi a sinistra più articolati, meno dominati dai piani ampi. Nessun nuovo reticolo/speckle diffuso o deterioramento macroscopico della costa. Beneficio moderato; vecchie patch shadow ancora aperte. |
| Pioggia A/B | PASS incrementale geometria/artifact. Beneficio moderato al rilievo, nessun nuovo foro o rottura evidente costa/mesh. La cortina uniforme e il velo verticale non diventano fotograficamente accettati. |
| Tramonto A/B aggiunto dopo la prima review scout | PASS incrementale di non regressione visibile. Nessun nuovo pattern o deterioramento costiero evidente; versanti scuri e foschia impediscono di rivendicare un miglioramento convincente delle creste. La prima review senza baseline resta conservata. |
| Worker Sole | Singolo PNG byte-identico al main: 2.909.134 B, SHA256 `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`. Una sola copia conservata con alias esplicito; non prova universale main/worker o temporale. |

Sole: sette componenti Float64 camera/luce differiscono al massimo di 1,78e−15, entro il criterio metadata 1e−12 dichiarato. Pioggia: camera/luce/meteo compatibili Float32, non tutti identici come serializzazione Float64; `weatherTime` owner differisce, mentre coincidono i clock effettivi di simulazione/flow/precipitazione. Non è un confronto degli hash sky fra owner. Tramonto: baseline rain 0 contro residuo candidato 6,977e−10, con camera e Sole abbinati; nessuna identità completa degli input viene inventata.

I PNG conservano il bitmap nativo del canvas al draw, senza UI: non provano buffer lineari/HDR o presentazione del compositor. Le review non qualificano tutte le camere, il movimento, la nube, il materiale/vegetazione o la correttezza delle ombre.

## Costo locale A/B/A

Protocollo precedente ai run: v58 A1 / candidato B / v58 A2, main Pioggia, full 2474×1844 e 256³/128³/384, warmup 2 s e misure queue 30 s. Le tre code risultano completate, con prefisso confermato uguale ai frame misurati e zero frame misurati non confermati al termine.

| Run | Invii/s | Frame | Durata ms | p95 intervallo ms | Prefisso completato |
|---|---:|---:|---:|---:|---:|
| A1 v58 | 16,647023 | 500 | 30.035,4 | 67,3 | 500/500 |
| B candidato | 16,689486 | 501 | 30.018,9 | 67,4 | 501/501 |
| A2 v58 | 16,480663 | 495 | 30.035,2 | 67,2 | 495/495 |

La media dei controlli è 16,563843 invii/s; deriva controlli 0,999341% e B/media(A1,A2)=1,007585. Il gate dichiarato (drift ≤15%, rapporto ≥0,9) è **PASS**. La differenza B è inferiore all'1%: **nessuna prova di speedup**. Nel bracket non viene osservata una perdita oltre il margine ammesso dal protocollo per quella posa/sessione; non è un costo GPU universale del raffinamento. I 60 FPS restano aperti; `presentedCanvasFps` è assente/null.

La prima validazione R1 fu FAIL per un errore del validatore: richiedeva un conteggio lifetime shadow di uno, mentre A1 aveva visitato Tramonto→Pioggia prima della finestra. Il criterio corretto R2 confronta start/end: A1 186→186, B 1→1, A2 1→1, tutti validi. R1 e R2 sono conservati; **nessun benchmark è stato ripetuto e nessun raw è cambiato per questa correzione**.

Il residuo rain B all'inizio è 0,7999996829047235, cioè 3,171e−7 sotto 0,8: dichiarato, non identità meteo assoluta. Le tre console salvate sono vuote nella rispettiva osservazione; non è una garanzia globale. Le chiamate shadow rimangono ferme nella finestra, mentre la radiance del terreno resta live. I timestamp render sono completi per 496/500, 498/501 e 493/495 draw, con i rimanenti mancanti e senza ledger invalido/conflitto: sono una copertura distinta dal prefisso queue completo. Le somme di pass con estremi sovrapposti non sono tempi GPU esclusivi e non vengono attribuite al costo del terreno.

## Adozione finale separata

Il root ha integrato `observatory-v59-terrain-source-refinement`, manifest 126 SHA256 `fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2`. Rispetto al candidato cambiano soltanto il literal della versione in GPUSceneEngine e la corrispondente aspettativa lifecycle; modulo geometrico, helper, test geometrici e gli altri 124 hash sono identici. Le due copie finali, il patch e i manifest sono in `final/`, senza duplicare i quattro file già conservati e rimasti uguali.

La qualifica finale conclude 435/435 test in 46 file e APP→hero con exit 0. La cattura nativa Sole finale è stata realmente trasferita in 60 parti e risulta byte-identica al candidato: stesso SHA256 `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`, 2.909.134 byte. Il PNG è deduplicato, mentre metadata e transfer finali restano distinti. La preview ordinaria v59, proof e stato sono conservati; il fatto che la preview sia animata non la trasforma in una misura FPS.

`final/root-final-adoption-verification.json` documenta il controllo saved-bytes del root: sorgenti repository 126 corrispondenti al manifest finale, due modifiche solo literal, terminali test/build, alias PNG e proof ordinaria. Un primo errore di preparazione sul path del manifest era avvenuto prima di ogni scrittura/modello ed è dichiarato nell'adoption record. Questi controlli non rieseguono il modello numerico, né rinominano i precedenti raw A/B/A come benchmark finali.

## Limiti

Gli stessi nodi selezionano e valutano le facce: **fit, non holdout**. Il lookup usa attributi Float32 e interpolazione Float64; non è parità GPU/WGSL. Non qualifica errori fra nodi, integrali areali, massimi continui, accuratezza del DEM, silhouette in ogni posa o visibilità solare corretta. `coast>=0` è una maschera materiale; il ring4 è campionato soltanto entro ±48 km. Contiguità/count/index non sono da sole una prova topologica completa.

Il costo è un solo bracket locale e non dimostra la prestazione di ogni meteo, device, risoluzione o movimento. Il vantaggio visivo è incrementale e circoscritto; le patch shadow, l'accettazione fotografica globale e i 60 FPS restano aperti. L'adozione v59 non chiude questi gate e non riscrive la storia del candidato.

## Correzione del verificatore R2

Il primo run saved-evidence è terminato FAIL perché R1 pretendeva stderr vuoto per i witness. I tre record JSON di avanzamento erano previsti dal witness e non erano errori. R2 accetta soltanto quei tre eventi strutturati, ne confronta modo, conteggi e digest con i risultati, e rifiuta altre righe. R1, manifest originale, freeze e run fallito sono conservati in verification-r1/. Nessun modello, test, build, browser o misura è stato ripetuto. R2 è preparato e attende il run root.
