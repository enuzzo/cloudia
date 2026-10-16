# Raffinamento delle montagne sulle quote reali — v59

Qualifica iniziata il 16 ottobre 2026, checkpoint chiuso il 17 ottobre.
Modifica locale adottata dopo confronto numerico, nativo e di costo.
Il goal resta attivo: fotorealismo complessivo, ombre, anatomia della nube e 60 FPS
non sono ancora approvati.

## Problema e comportamento

La mesh v58 perdeva parte dei crinali presenti nel DEM Copernicus: nei ring più
esterni le facce erano larghe 256–512 m, mentre i nodi del dato sono distanti 125 m.
Ora un passaggio statico seleziona le facce con scarto osservato superiore a 5 m
sui nodi del core ±48 km e le divide con midpoint campionati dallo stesso terreno.
Gli edge sono condivisi e i vicini vengono raccordati; normali, bounds, indici per
cella e lookup della camera seguono i figli effettivi. Nessuna query DEM per frame.

Il dato geografico, l'esagerazione verticale 1× e i materiali restano invariati.
Le aree abitate sono una maschera del materiale: la scelta reale/naturale non
introduce edifici o passaggi di rendering aggiuntivi. Shader della nube, qualità
256³/128³/384 e risoluzione nativa non cambiano. Il caster sperimentale respinto
nel ciclo precedente non entra in questa modifica.

## Risultati osservati

| Misura | v58 | v59 |
|---|---:|---:|
| Vertici | 465.409 | 591.788 |
| Triangoli | 929.792 | 1.182.550 |
| Payload geometria | 26.050.592 B | 33.127.816 B |
| Lookup CPU | 2.359.296 B | 2.949.120 B |
| RMS su 334.589 nodi coast≥0 | 24,684 m | 11,641 m |
| RMS su tutti i 591.361 nodi | 18,578 m | 8,761 m |
| Estremi firmati sui nodi | −261,539 / +209,990 m | −96,066 / +90,428 m |

Il nuovo modulo con refinement OFF riproduce esattamente i cinque buffer, le
statistiche e il digest storico di tutti gli errori v58. ON rispetta i cap
600.000 probe, 1 milione di vertici, 2 milioni di triangoli e 64 MiB geometrici.
Le due esecuzioni terminano con exit 0: CPU combinata 2,019 / 2,790 s, wall
1,652 / 2,315 s, somma conservativa dei picchi RSS 910.295.040 / 1.189.593.088 B.
Il cap geometrico non comprende temporanei e lookup CPU; RSS è un gate terminale.

**Regressioni conservate:** 225.051 nodi migliorano, 55.125 peggiorano e 311.185
restano uguali in errore assoluto. La regressione locale maggiore è +54,222 m.
12.883 nodi entrano sopra 5 m e 69.448 ne escono. Ring 0/1 invariati; RMS land
ring 2/3/4 inferiori. Una verifica Python indipendente degli stream salvati
conferma statistiche e confronti, senza ricostruire la mesh.

Sono gli stessi nodi usati per selezionare il raffinamento: **fit**, senza holdout,
garanzia continua o promessa di errore finale ≤5 m. Coast≥0 è la maschera del
materiale, non una verifica indipendente della linea di costa.

## Immagine e costo

PNG originali 2474×1844, t60 fermo, stessa camera/luce: root e review indipendente
assegnano PASS incrementale a Sole e Pioggia. I crinali sinistri sono più articolati,
il guadagno visivo è moderato; nessun nuovo reticolo o deterioramento evidente
della costa. Tramonto A/B passa la non regressione visibile, ma il terreno scuro
non consente di rivendicare un miglioramento convincente. Restano le vecchie
patch scure del ramo ombre e il velo della pioggia.

Main e worker al Sole producono il medesimo PNG: 2.909.134 B, SHA256
`90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`.
È una posa osservata, non una prova universale dei due renderer.

Il confronto Rain main A/B/A, 2 s warmup e 30 s misurati per prova, mantiene
2474×1844 interno/output, 256³/128³, 384 passi, full flow e diagnostica queue:
**16,647 → 16,689 → 16,481 invii/s**. Deriva delle baseline 0,999%; B/media(A)
1,0076. Tutti i prefissi finali completati, console osservate senza warn/error.
PASS del gate di costo predefinito (deriva ≤15%, rapporto ≥0,9); nessuno speedup
significativo o raggiungimento dei 60 FPS viene dedotto. Sono invii per tempo
reale, non frame presentati dal compositore. Il residuo Rain iniziale di B è
3,17e−7 rispetto a 0,8, dichiarato come limite del matching.

La prima validazione dei report pretendeva erroneamente un contatore shadow
assoluto pari a 1. A1 aveva visitato il tramonto prima del test: 186→186 durante
la finestra. R2 verifica correttamente la stabilità in finestra; conserva R1
respinta e dati originali, senza ripetere o cambiare il benchmark.

## Qualifica e continuità

Candidato: 72 test mirati, 435/435 complessivi in 46 file, typecheck e build APP→hero.
Versione finale: 435/435 e APP→hero ripetuti con esito positivo. Fra candidato e
finale cambiano soltanto il tag renderer e l'aspettativa del test lifecycle:
mesh, sampler e helper sono byte identici, quindi nessun replay numerico.

Manifest candidato 126 sorgenti:
`83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00`.
Manifest finale 126 sorgenti:
`fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2`.
Base v58 124 sorgenti:
`21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`.

Prove conservate in `measurements/terrain-source-refinement-2026-10-16/`.
Archivio R2: 124 payload, 18.106.011 B, manifest SHA256
`25e51c71de6949910be54dab93ed8bcdb309ca7ac48deb133139a84c9fe9a693`.
Il verificatore saved-evidence passa 11.395 controlli, ricostruisce i 126 sorgenti
candidati in memoria dalla base 124 e legge 9 riferimenti pin: CPU 5,454 s,
wall 5,574 s, somma dei picchi RSS 173.948.928 B. Il primo verificatore richiedeva
erroneamente stderr vuoto per i witness, che scrivono tre record JSON di avanzamento.
R2 autentica questi eventi e rifiuta righe diverse; R1 e il suo FAIL sono conservati.
Nessun modello è stato ripetuto. Freeze R2 immutabile prima del run; prova del run
successivo nel [sidecar](TERRAIN-SOURCE-REFINEMENT-VERIFICATION-2026-10-16.json),
esterno all'inventario per evitare un hash circolare. Il PNG nativo della versione
finale è stato trasferito e confrontato byte per byte con quello candidato.
Gli stream OFF/ON sono ora conservati losslessly; il vecchio stream storico
era soltanto hashed. OFF è una riproduzione autenticata, non il recupero di un
file storico. Gli snapshot esterni sono in `Cloudia-QA-2026-10-16-cycle28`.
Nessun deploy o push; `node_modules 2/` estraneo preservato.
