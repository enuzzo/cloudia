# Cloudia — Sentinel-2 e palette v55

**R1 scartata; R2 accettata come guida cromatica senza PASS fotografico globale.** Il checkpoint approvato è `observatory-v55-s2-chromaticity`. L'archivio conserva i dati di riferimento selezionati, entrambe le proposte e le prove della build approvata; non contiene l'intero dist, i cloni sorgente, texture satellite o dipendenze.

## Palette e giudizio visivo

R1 assegnava una cromia unica per classe ai quattro endpoint forestali. Il confronto CSS ha mostrato minore dominante verde ma perdita di variazione delle tinte; Root e la critica indipendente l'hanno scartata. Freeze e report originali, che precedono il rigetto, sono conservati senza riscriverne lo stato storico.

R2 applica un unico fattore diagonale per classe, derivato dal centroide aritmetico degli endpoint e dalla mediana cromatica S2, quindi rinormalizza ciascun endpoint alla sua Y originale. La verifica Decimal a 50 cifre riproduce tutti i 18 componenti Float32. I 14 confronti logaritmici per coppia/canale conservano il contrasto relativo salvo arrotondamento: residuo massimo f32 1,743500899764605e−7; per Y intrinseca massimo 4,038214679313867e−9. Il materiale differisce soltanto per sei literal su tre righe e un commento.

Nelle tre viste R2 costa/Sole e montagna/Sole/Tramonto, Root non ha osservato nuovi artefatti cromatici evidenti. La critica indipendente rileva recupero della variazione persa in R1 e nessuna regressione evidente rispetto ad A nella posa montagna/Sole; A→R2 rimane contenuto. Sono JPEG CSS 1237 × 922 di output 1920 × 1080 scalato: non una certificazione framebuffer, dell'albedo fisica o del fotorealismo globale. Le strutture fini di vegetazione e roccia restano semplificate.

## Contenuti e provenienza

- `satellite/`: 33 dei 34 payload della selezione originale, più la selezione stessa. È omesso soltanto il PDF duplicato ed è conservata la figura scientifica PNG. Il manifest dell'archivio completo e i testi di provenienza/licenza restano originali.
- `r1/`: freeze, manifest, confronto, sorgente prima/dopo, patch, notice, report e log; `browser/` contiene sette JPEG CSS, protocollo, rigetto e console.
- `r2/`: protocollo e freeze, manifest, formula/script/verifica storici, sorgente prima/dopo, patch, notice, report e log; `browser/` conserva i tre JPEG R2, review e console.
- `checks/`: manifest approvati di 119 sorgenti e 30 file dist, risultati/log dei test iniziali e finali, build app/hero e typecheck; due raw prestazionali completi compressi senza perdita; sintesi compatta originale di Root; riepilogo CPU ricalcolato; record funzionali Worker/anteprima, console e tre JPEG finali.

`SOURCE-PROVENANCE.json` conserva per ogni copia percorso, byte e SHA-256 originali, oltre ai byte/SHA dello storage. Per preservare spazi finali, EOF e terminatori CRLF originali senza eccezioni al controllo Git, patch memoria, HTML ESA, testo legale CC-BY, CSV witness e log dei test materiali sono memorizzati come `.gz`. Tutti questi payload, come log e raw compressi, sono ricostruibili byte per byte. `MANIFEST.json` è l'inventario finale dello storage; per i gzip riporta separatamente hash e dimensione originali.

Il derivato esterno `performance-verification.json` da 17 MB non viene duplicato perché ripete timestamp già conservati nei due raw completi. Ne rimane la provenienza in `SOURCE-PROVENANCE.json`; `checks/performance-summary.json` è la sintesi compatta originale fornita da Root.

## Build approvata e prestazioni registrate

La suite finale originale è **341/341 in 43 file**, con typecheck e build app→hero riusciti. Il primo run, 337/341, resta conservato integralmente: Root identifica un'aspettativa di versione v54 rimasta nel test e tre fallimenti RAF successivi prima del teardown. È stato aggiornato il test della versione; non viene dichiarato un fix runtime del lifecycle. La spiegazione è attribuita alla nota originale `initial-test-failure.json`.

| Finestra approvata | Invii / intervalli | Durata | Invii/s | p95 intervallo | Prefisso coda |
| --- | ---: | ---: | ---: | ---: | --- |
| Sole | 1779 | 30001,8 ms | 59,296442 | 17,7 ms | 1779/1779 completato |
| Pioggia | 471 | 30035,5 ms | 15,681444 | 83,3 ms | 471/471 completato |

Entrambe: output e interno **2474 × 1844**, ultra, 384 passi, volume 256³ e dettaglio 128³, full flow/full ablation, seme 74, t60 in pausa, vento 55%, dispersione 0, target [0,2.7,0], yaw 1,3852869846402587 e pitch 0,2811279826464208. Pioggia effettiva iniziale 0,7999915702509183, percorso R8 stabile. Il tempo meteo continua ad avanzare: la pausa della nube non è una pausa dell'intero modello meteo.

Questi sono intervalli rAF/invii e completamento del prefisso GPU, **non presentazione del compositor né 60 FPS stabili**. Nessuna inferenza causale di speedup/regressione rispetto al precedente v54: il target era diverso. I timestamp dei pass possono sovrapporsi; le somme non sono usate come costo GPU esclusivo. Il campo storico `over33Ms` usa la soglia stretta >33,34 ms.

Il Worker Sole è qualificato funzionalmente tramite DOM e JPEG a 2474 × 1844, 256³/128³/384, t60. L'anteprima finale è main ordinaria, animata, `http://localhost:4196/?seed=74`, record a t97,2. I contatori live non sono un benchmark Worker o una prova di parità nativa main/worker.

La console registra zero nuove voci dall'inizio della navigazione approvata, ma conserva l'errore storico MutationObserver delle 15:55:05.403Z, senza attribuzione dell'origine. Non si dichiara console globalmente priva di errori. I JPEG finali sono CSS; nome “native” si riferisce allo stato dell'output osservato nel DOM, non al formato della cattura.

## Verifica portabile, senza scritture

```sh
python3 verify.py
```

Il default verifica inventario/SHA dello storage e degli originali gzip, formula R2 Decimal50, differenza materiale, manifest congelati, test341, aritmetica dei raw, qualità, camera comune, coda completata, sintesi di Root, console e record DOM. Non scrive file, non legge gli alberi sorgente, non esegue script storici, replay satellite, GPU, browser, build o test del prodotto. Il suo PASS verifica le prove registrate e non sostituisce un nuovo run.

Controllo opzionale dei soli 119 file nominati dal manifest approvato, senza scansione ricorsiva:

```sh
python3 verify.py --verify-runtime /percorso/v55-final/source
```

Il sottoinsieme satellite **non è un replay autonomo**: float buffer, Range bodies e texture restano negli archivi esterni completi. `satellite/reference-verifier.py` è la copia byte-identica del verificatore originale, rinominata, e richiede questi archivi:

```sh
python3 satellite/reference-verifier.py --archive-root /percorso/sentinel2-reference-r2 --r1-root /percorso/sentinel2-reference-r1
```

Non puntarlo a `satellite/`. Anche `r1/verify-proposal.py`, `r2/derive-candidate.py` e `r2/verify-candidate.py` sono originali storici con dipendenze esterne e/o scritture: sono conservati, non eseguiti dal nuovo verificatore.

S2 è un composito annuale RGB osservato L2A già illuminato; la figura usa gain 3 e OETF sRGB. Non è albedo o calibrazione fisica. L'archivio non autorizza il trasferimento delle texture satellite nel prodotto. Durante la cura il prodotto, Git e i documenti del repository non sono stati modificati.
