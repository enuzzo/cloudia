# Cache raster del terreno — lettura indipendente dei risultati salvati

**Esito circoscritto: parità salvata PASS; gate numerico statico A/B/A PASS, con beneficio piccolo.** I controlli in movimento mostrano correttamente zero hit e un costo CPU osservato maggiore. L'adozione e la qualifica della build finale v60 appartengono al root; i numeri qui sotto provengono dalla candidata `experiment-v59-terrain-raster-cache`.

Solo lettura di JSON e aritmetica dei dati salvati. Nessun nuovo rendering, GPU, browser, build, test, bake o replay del modello. La bozza generica `summarize_saved.py` non è stata eseguita e non serve a questa conclusione.

## Protocollo e comparabilità

Protocollo precedente alle misure: `decision-protocol.json`, SHA256 `8801287384bbd6ee4a2a5ac4a1205260803c7ce02ce6d5053c5d3df90f5da62b`. Ordine A1 OFF → B ON → A2 OFF, 30 s dopo 2 s di warmup; gate: B supera entrambi gli A in invii e prefisso completato, guadagno sulla media A superiore alla deriva relativa A1/A2, prefissi completi e nessuna differenza di parità. Non applico soglie di esperimenti precedenti.

I tre report sono main, seed74, Pioggia80%, Sole da sinistra, t=60 fermo, forcing/precipitation time=0, pausa=true, orbita=false, flusso completo, `timing=queue`, ablation=full, 2474×1844 sia output sia interno, macro256³/detail128³/384. Camera completa, confronto superficie/target, geometria, parametri ottici, vento .55, dispersione0, transizione atmosferica1, lampi0 e percorso densità coincidono nei campi confrontati. Il compute del flusso resta nel percorso completo; la cache risparmia soltanto il pass colore/distanza del terreno.

Unica differenza nel gruppo di campi scena/pipeline confrontato: rain CPU A1=.7999999998381682, B/A2=.7999999999999996. Tutti arrotondano a **f32 .800000011920929**. `weatherTime` e gli orologi wall/owner differiscono: non sono stati presentati come identità temporale completa; senza lampi e con simulation/forcing fermi non indicano qui un moto diverso del campo. I PNG proprietario prima delle finestre riportano lo stesso SHA pioggia assestato.

## A/B/A statico

| Finestra | Invii/s | Prefisso completato/s | Intervalli | Durata intervalli ms | End drain ms | CPU media ms | CPU render media ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| A1 OFF | 19.26474019 | 19.14509531 | 578 | 30003.0 | 181.4 | .34533 | .25138 |
| B ON | 19.46638804 | 19.28281127 | 585 | 30051.8 | 297.8 | .38667 | .28205 |
| A2 OFF | 19.13375661 | 18.98805239 | 575 | 30051.6 | 237.6 | .36000 | .26330 |

Tutti: `queuePrefix.status=completed`, confirmedPrefixId=measuredSubmissions=intervalli, zero unconfirmed finali. `presentedCanvasFps=null`. La frequenza delimitata dal prefisso include backlog ereditato e consegna JS; non è throughput GPU isolato né presentazione.

| Calcolo | Invii | Prefisso completato |
|---|---:|---:|
| Media A | 19.19924840/s | 19.06657385/s |
| B / media A −1 | **+1.39140675%** | **+1.13411786%** |
| B / A più veloce −1 | +1.04671977% | +.71932762% |
| Deriva abs(A1−A2) / media A | .68223289% | .82365571% |
| Deriva col denominatore A più lento | .68456806% | .82706178% |

B supera entrambi gli A e il guadagno supera la deriva anche con il denominatore più prudente. È un solo A/B/A, senza stima di confidenza o isolamento termico: il margine del prefisso sulla deriva è circa .31 punti percentuali. Questo sostiene una piccola ottimizzazione nella posa misurata, non un guadagno generale garantito.

Delta dei contatori colore tra inizio/fine raccolta interna, **warmup incluso**: A1 616 richieste/616 draw/0 hit; B 625/0/625; A2 615/615/0. Shadow: nessun nuovo draw in tutte e tre le finestre. Questi delta non vanno confusi con i soli 578/585/575 intervalli misurati.

## Parità e controlli di ritorno

I report indicano `COMPLETE_IDENTICAL_F32`, stable/identical/cacheStateQualified=true. Per ciascun audit: +1 richiesta, +1 submission, +1 epoch, 0 nuovi hit sia colore sia shadow, coerenti con l'invalidazione forzata. Le cache sono valide prima/dopo; nel controllo OFF il colore resta correttamente disabled/invalid.

| Caso salvato | Dimensioni | SHA256 target cached=fresh |
|---|---|---|
| Main Sole; ritorni resize/camera | 2474×1844 | e4435ce3a0a45e243c19dea24e5bc1133f6db1c8fd5ca168e94e644b1c6c9045 |
| Main finestra | 1237×922 | a2121b877fd51659e8e1435fd2b9196c4d4fec7bb1d4be6bffb9a8754ee417fa |
| Main camera realmente ruotata | 2474×1844 | 6246446302731c0f8aa4a21be532d1449479511ac960f21517424d993746ebed |
| Main Tramonto assestato | 2474×1844 | b66da37b843ada80763cef8c3ca7783157c7924fef554596065cd00ceec5db8f |
| Main Pioggia ON/OFF e worker Pioggia | 2474×1844 | d0a96b214411d8860551b7669e42159dee6eb6b1a7212db1c07cd0a17bbce0e3 |
| Worker Sole | 2474×1844 | e4435ce3a0a45e243c19dea24e5bc1133f6db1c8fd5ca168e94e644b1c6c9045 |

Ogni target nativo: **72992896 B packed**, **73169824 B restituiti**, coerenti con stride r186 di39680 B e assenza di padding dopo l'ultima riga. Finestra:18248224/18410320 B. Si confrontano tutti i bit RGBA32F, inclusa la distanza/miss alpha; questa lettura verifica i digest dichiarati nei report, non ricostruisce i buffer GPU.

Il controllo camera usa `cache-main-camera-away-f32.json` e **`cache-main-camera-real-return-f32.json`**: yaw1.3852869846402587→1.4842360549717057→1.3852869846402587, posizione e basi ritornano esatte; hash diverso durante lo spostamento e originale al ritorno. Il precedente nome `camera-return` da solo non viene usato per dimostrare la partenza. Resize native→window→native torna alle dimensioni e all'hash originale.

I metadati degli export PNG nativi main/worker Sole riportano SHA `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`,2909134 B; Pioggia main ON/OFF, worker e pre-B/pre-A2 riportano `0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b`,2585113 B. Dimensioni2474×1844. Sono i record di acquisizione proprietario, non screenshot CSS né una nuova lettura pixel eseguita qui. Il Sole coincide con il PNG canonico v59 già verificato dal root.

Negativo/limite preservato: `cache-main-rain-native-unsettled.json` ha rain=.7999983957650012 e SHA diverso `5a03b65c…`,2585131 B. Non viene sostituito né attribuito alla cache: lo stato rain non coincide ancora in f32 con .8; il successivo assestato torna all'hash comune. L'audit main Rain, pur con rain CPU .799997411…, riguarda il **solo target terreno**, che non dipende dalla quantità di pioggia. Il primo JSON Rain letto dalla UI mentre busy era il report precedente: non è prova Rain. Il root annuncia per la build finale clear-report all'avvio per eliminare tale ambiguità di lettura.

## Movimento: nessun riuso, costo non gratuito

| Controllo | t simulazione inizio→fine | Delta richieste/draw/hit | Invii/s | Prefisso/s | CPU media/p95 ms | CPU render media ms |
|---|---|---|---:|---:|---|---:|
| OFF | 80.6838→109.8191 | 641/641/0 | 20.04308264 | 19.88459010 | .34302/.60000 | .24037 |
| ON | 88.3554→117.5304 | 643/643/0 | 20.04314937 | 19.91814371 | .56179/1.10000 | .43040 |

Entrambi full native, orbita=true, pausa=false, flusso completo;602 intervalli e prefisso completo, zero unconfirmed. La cache ON ha555 hit storici **prima** della finestra, invariati durante il movimento: il dato pertinente è delta hit=0. L'aumento CPU osservato è circa .219 ms medio globale e .190 ms nel render, ma t iniziale, camera/orbita, forcing/precipitation e traiettoria della nube sono differenti. Non è un A/B causale degli FPS né una misura isolata del costo della chiave. Non è prova su dispositivo mobile. Rende comunque esplicito che le allocazioni/confronti CPU non sono gratuiti quando non esiste riuso.

## Provenienza minima e decisione aperta

SHA256 dei raw benchmark: A1 `e40a3694fbaf0de7460bed93d168db504e5f9cd3bb20295b91713009f7f81f1f`; B `979466d1d25908c512ee7921ec9a9a3f186fade32f9edc16286a436399129cd3`; A2 `4217f29731c2bc91cc6f760bfff1979980bdc52d023eeee26753c3f0b43e450e`. Motion OFF `982bdc52435d7a05b0d2eb05d9450502636bf871fa160f887a48f93ba27954d6`; ON `1e6459dc7dca29c7340b96ab91cb5b4881054960e8b32d87e1d901e0236a784e`.

La lettura supporta la proposta del root di conservare la cache come ottimizzazione piccola, circa+1.4% di invii nella posa statica misurata, con limiti sopra espliciti. Non attribuisce60 sostenuti, FPS presentati, maggiore fotorealismo, identità in ogni transizione né beneficio garantito durante navigazione. Tag, correzioni report UI e qualifica/nativi della nuova build finale v60 sono successivi a questi dati e non vengono anticipati come PASS qui.
