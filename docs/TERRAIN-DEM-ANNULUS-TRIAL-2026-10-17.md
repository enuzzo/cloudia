# Terreno: anello sui nodi altimetrici reali

17 ottobre2026, ciclo48 / workspace esterno cycle44. **Candidata non adottata: FAIL del limite di memoria del processo di verifica.** Prodotto autorevole `observatory-v61-observed-terrain-material`, commit `8a9535f9cb849292f5dd868020ef7f514567109a`; goal attivo. [Archivio completo](measurements/terrain-dem-annulus-trial-2026-10-17/README.md), [integrità](TERRAIN-DEM-ANNULUS-VERIFICATION-2026-10-17.json).

La preferenza del proprietario resta geografia reale comprese le zone abitate. Sono contenute nello stesso materiale ottico del terreno: nessun edificio3D o pass aggiuntivo dovuto alle città. Questo non equivale a costo complessivo nullo o60FPS dimostrati.

## Perché questa geometria

Il trial precedente32→31,25m era fallito fuori dai nodi. Un preflight necessario sui589824centri delle celle125m ha invece trovato potenziale per triangoli appoggiati direttamente ai nodi DEM, con la stessa sfera e diagonaleSW→NE: holdoutlandRMS7,38676→4,27954m e massimo globale87,02977→34,93822m. Esecuzione unica entro10CPU/20wall/384MiB:0,46018CPU/0,46767wall/268255232B RSS.

La stratificazione ha però mostrato che la patch uniformeR1 peggiorava tutte le prime quattro bande fisiche. R1 è stata superata prima di fixture/mesh/app/GPU; soltanto il typecheck era stato eseguito. Fonti e primo freeze conservati in `revisions/uniform-r1-before-banded-qualification`. Il PASS scalare globale non è stato retroattivamente trasformato in un FAIL geometrico mai osservato.

R2 conserva tutti i triangoli v61 fino a `I=Math.fround(128*.256)=32,768001556km` e quelli esterni da `C=Math.fround(94*.512)=48,127998352km`. Inserisce nodi125m soltanto nell'anello `J=32,875..48km`, con due raccordi saldati a quattro lati. J è derivato dalla griglia caricata. Offset compatti per riga e due lookupCSR indirizzano le facce reali anche per le quote della camera. Nessuna modifica a dati, shader, materiali, luce, nube, camera o qualità256³/128³/384.

## Verifiche effettive

Prima suite:568PASS/1FAIL su54file. Il selettore della fixture includeva due triangoli interni agli angoli del quadrato perché tutti i loro vertici avevano r=C. Corretto solo il test con max(r)>C e controllo every r>=C; nessun cambiamento runtime. Fallimento e patch esatti conservati. **Suite corretta569/569 e54/54file PASS**,13,505s wall. Typecheck PASS prima della correzione di quel predicato; nessuna buildAPP/hero eseguita dopo il successivo FAIL di memoria.

Due mesh reali sequenziali AOFF/B: A autentica i sei buffer e lo streamF64 storico completo; entrambe completano winding/normali finite/manifold/bordi/Euler. B conserva620910triangoli interni e460149esterni XYZ+surface, con query identiche; le normali incidenti ai raccordi non sono dichiarate identiche.275625fit+274576holdout vicini byte identici,313148holdout lontani esattamente uguali allo scalare.32punti prefissati sui due raccordi confrontati con oracolo indipendente su tutte le facce: delta massimo4,44e−16km. Tutti gli errori completiF64 sono salvati.

| Quote rispetto al DEM | A v61 | B R2 |
|---|---:|---:|
| Fit RMS land |11,64136m|4,90016m|
| Fit p99 globale |36,11133m|17,45730m|
| Fit massimo globale |96,06550m|68,53440m|
| Holdout RMS land |7,38676m|3,38216m|
| Holdout p99 globale |25,00928m|10,40629m|
| Holdout massimo globale |87,02977m|29,65602m|

Root e revisore indipendente: **beneficio numerico confermato, distinto dalla qualifica complessiva**. Conservate2regressioni land nel fit e53430nel holdout; peggiore incremento locale26,7178m. Nessuna media nasconde la zona vicina: prime quattro bande byte identiche. Il dato125m non qualifica dettagli rocciosi più fini né fotorealismo.

B ha858119vertici/1715212triangoli,48042352B geometria e3060396B lookupCPU; entro i cap1M/2M/64MiB. A ha591788vertici/1182550triangoli/33127816B. I contatori campionamento sono effettivi: A1183149, B1498885. Il costo della maggiore geometria nel renderer e negli FPS resta da misurare.

## Memoria: due risultati mantenuti e stop

| Processo effettivo |CPU s|Wall s|RSS terminale (byte)|
|---|---:|---:|---:|
| A OFF originale |3,666785|3,331050|1196032000|
| B, witness iniziale |6,912233|6,295945|1740881920|
| B, sola riparazione allocazioni witness |6,020296|5,409141|1634467840|

Limiti prefissati per child20CPU/30wall/**1610612736B(1,5GiB)**, misurati perPID con Darwinwait4. A PASS; entrambi B finiscono exit0 ma **FAIL il capRSS**. Il picco riguarda l'intero processo di costruzione e verifica; non è attribuibile dal solo valore terminale al builder, al renderer o al tempoGPU.

Dopo il primo FAIL è stata congelata e revisionata una sola riparazione esplicita del witness: eliminati milioni di array/viste temporanee e sostituiti64863540B di copie fingerprint con hashing a blocchi61440B. OracoloAABB mantenuto. Prodotto immutato; stessi limiti, punti, gate e identità obbligatoria dei sei buffer e dell'interoF64 B precedente. Riutilizzato A già autenticato, senza ricostruirlo. Il nuovo B risparmia106414080B ma resta23855104B sopra il cap. **Stop dichiarato rispettato: nessun ulteriore ritocco/ripetizione, APPbuild, GPU, meteo, worker, moto oFPS.**

Tutti164pin verificati anche dopo il FAIL, da root e indipendentemente; sei buffer, statistiche, stream, oracolo e identità identici fra i due B. Stream raw B9449480B SHA `ff89b192199a6ffe766ff49090d342c09b302715aab5d216ce0a04afdc9a461f`. Il controllo post-fallimento manuale supplisce al postcheck che il launcher non raggiunge dopo il vetoRSS.

## Stato lasciato

Copia esterna143file congelata, cinque delta rispetto ai141canonici: Engine, lifecycle, terrainMesh, nuovo helper e test. Manifest sorgente `ee5c9d7747a27a100cc4faa04cd7748ac6a5afa743295eab39973d42f40b6fb5`. Canonico141 ricontrollato esatto; nessuna installazione/lockedit/push/deploy. DipendenzeGitignored/untracked con attributoDropbox1 verificato prima/dopo; `node_modules 2/` e porta4201 preservati. Cache rigenerabili escluse dall'archivio.

Preview4196/session48736 viva HTTP200 e ordinarySole animato osservato; console warning/error vuota. Screenshot `browser/ordinary-v61-unchanged.png` è evidenzaCSS della preview precedente, non immagine nativa della candidata. Nessun server candidato avviato.60FPS globali restano aperti; precedente pioggia pesante~19invii/s non rimisurata.

La patch resta una geometria numericamente promettente, sospesa da questa tranche sul costo della qualifica. Non riaprire un terzo ritocco del witness o alzare il limite per farla passare. Il piano completo anatomia delle3famiglie, vicino/luce in moto, pioggia/virga, terreno e UI conserva tutti i gate visuali e60FPS; il successivo lavoro sostanziale segue quelle priorità senza dichiarare concluso il terreno da questa tabella.
