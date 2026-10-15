# Timestamp GPU associati ai disegni, con copertura esplicita

16 ottobre 2026, decimo ciclo. **Implementato e qualificato in main e worker.**
I 60 FPS globali restano aperti. Questa modifica rende le misure più
interpretabili; non accelera shader o pioggia.

## Cosa cambia

Lo schema JSON 3, `submission-queue-prefix-v2-pass-ledger`, conserva tutti i
campi storici e i prefissi di completamento. Durante un benchmark registra
prima/dopo ogni draw il frame interno Three e gli intervalli dei contatori
render/compute. L'adattatore per Three **0.186.0** sostituisce la lettura
timestamp già esistente, senza nuove query, risorse GPU o readback.

Ogni batch esporta UID, coppie di indici, durate e gruppi interni. I dati sono
freschi solo quando pool, UID, offset, frame e somma restituita rispettano
il layout ispezionato. Versione o forma sconosciuta producono uno stato
esplicito, senza forzare associazioni. Il collector associa un pass soltanto
al range di chiamate unico con frame Three invariato. Non assume due pass,
un draw per frame Three o che il draw richiedente possieda tutto il batch.

`timestampPasses.statistics` include soltanto draw misurati completi.
Copertura, mancanti, parziali, duplicati, ambigui, warmup e query precedenti
restano espliciti. `gpu` e `gpuRenderPassSumMs` rimangono invece la vecchia
serie sparsa dell'ultimo gruppo Three risolto. Non confondere i due aggregati.

La chiusura aspetta solo il prefisso finale già previsto (massimo 5 s),
senza una lettura timestamp finale obbligatoria. Una piccola coda può
quindi risultare completata dalla GPU ma priva di timestamp nel report.
Callback di una misura annullata non entrano in quella successiva; il JSON
pubblicato resta immutato. Fuori dal benchmark il percorso di lettura
originario non crea snapshot né ledger.

Il build finale aggiunge anche `clockStateStart/End`: forcingTime, weatherTime
e ultimo tempo passato all'uniforme della precipitazione. Le tre prime prove
precedono soltanto questa aggiunta di metadati; il loro sorgente esatto è
preservato e verificato con lo SHA. I clock mancanti nei report storici non
sono stati riempiti a posteriori con valori inventati.

## Prime prove reali

Apple WebGPU, CSS 1280×720, DPR 2, output e interno **2560×1440**, qualità
Massima, **384 passi**, macro **256³**, dettaglio **128³**, seed 72,
profiling con rendering+flusso, nessun limite ai frame in volo. Tutte le
prove sono 30 s dopo 2 s di warmup, pausa a t=60, forcing 0 ricostruito
dalla sequenza UI di confronto. Sole: camera frontale; Pioggia: pitch −.92,
origine/target esatti nei JSON, rain 0,7999999971 anziché 0,8 esatto.

| Prova | Invii/s | p95 / p99 intervallo ms | Prefisso finale, attesa ms | Draw timestamp completi | Somma render media ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Main Sole | 59,9963 | 18,6 / 18,7 | 1.801, 10,3 | 1.790 / 1.801 | 21,4687 |
| Worker Sole | 59,9964 | 18,2 / 18,5 | 1.800, 8,0 | 1.791 / 1.800 | 22,7998 |
| Main Pioggia | 13,6355 | 83,4 / 85,1 | 410, 284,8 | 406 / 410 | 143,5266 |
| Main Pioggia, metadati clock aggiunti | 13,7839 | 83,7 / 84,8 | 414, 286,9 | 411 / 414 | 142,3656 |

Il secondo controllo Pioggia legge direttamente forcingTime e uniforme
precipitazione entrambi 0 all'inizio e alla fine; weatherTime passa da
67,4709 a 99,5728 s, clock distinto che continua durante la pausa. Conferma
la riproducibilità dei clock, senza dimostrare un vantaggio di prestazioni.
La verifica aritmetica e di integrità comprende tutti e quattro i report.

Tutti i batch delle quattro prove sono validati freschi, nessun duplicato o ledger
invalido. Le query unmatched precedono l'apertura del collector (main Sole 9,
worker Sole 33, Pioggia 9); i mancanti misurati sono solo gli ultimi draw.
La [review indipendente](measurements/fps-pass-ledger-2026-10-16/REVIEW-real-main.md)
ricostruisce esattamente main Sole: 5.742 pass freschi = 9 precedenti +
363 di warmup/anchor + 1.790×3 misurati. Console delle quattro prove senza warning
o errori. Nessuna cattura durante la finestra temporizzata. Altre app e carico
OS non controllati; attività CPU di analisi esterna possibile, nessun altro
benchmark GPU o bake avviato contemporaneamente dal gruppo.

La Pioggia conferma il divario dall'obiettivo, non una regressione causale
della strumentazione: manca una coppia A/B isolata per tale affermazione.
Sole vicino a 60 in 30 s non sostituisce la
[prova ordinaria in moto di 90 s](FPS-SUSTAINED-SUN-2026-10-16.md), né qualifica
presentazione o tutti gli scenari.

## Cosa resta incerto

La media render resta maggiore del periodo fra invii anche con i pass
associati. Nei dati raw, i due contesti hanno durate molto simili: circa
10,75/10,79 ms in main Sole e 71,65/71,77 ms in Pioggia. Sono osservazioni,
non prova che la nube sia disegnata due volte o che la GPU sia difettosa.
I timestamp assoluti non sono conservati dal pool Three, quindi questo
report non ricostruisce una timeline né verifica eventuali sovrapposizioni
fisiche degli intervalli. Non dividere per due o invertire la somma per
ricavare FPS.

La [specifica WebGPU sui timestamp](https://gpuweb.github.io/gpuweb/#timestamp-query)
lascia all'implementazione la determinazione del valore. La
[discussione primaria sulle architetture TBDR](https://github.com/gpuweb/gpuweb/issues/2046)
spiega le distinzioni storiche dei confini di vertex/fragment in Metal;
non dimostra quale meccanismo produca questi valori sul dispositivo attuale.
Il [ticket Dawn sulla quantizzazione](https://issues.chromium.org/issues/502434484)
descrive passi di circa 65,5 µs: coerenti con i multipli osservati di 0,065536 ms,
ma quella granularità non spiega da sola un fattore vicino a due in Pioggia.
Sono riferimenti per limitare le conclusioni, non diagnosi del backend in uso.

`presentedCanvasFps` rimane `null`. I prefissi provano completamento del lavoro
inviato e consegnato a JS, non presentazione del compositore. La loro frequenza
include eventuale backlog ereditato e consegna JS; il massimo non confermato
campionato ogni secondo non è profondità fisica della coda.

## Verifica e recupero

Suite **181 test / 30 file**, typecheck e build app/hero superati. Dopo l'unica
aggiunta dei clock: nuove build app/hero e integrazioni lifecycle **18/18**
superate. Le integrazioni includono più draw nello stesso frame Three,
warmup/anchor, cancellazione, callback tardivi e pubblicazione senza l'ultimo
readback. Non costituiscono prove di hardware o presentazione.

[Archivio e manifesto SHA](measurements/fps-pass-ledger-2026-10-16/archive-manifest.json):
report grezzi completi, console, review sorgente/reale, provenance dei due
build e snapshot del sorgente precedente alla sola aggiunta dei clock.
Il primo inventario include anche asset vecchi ancora su disco: il manifesto
finale identifica esplicitamente quelli referenziati da ciascun build.
Materiale v34, shader e terreno restano identici al checkpoint `ab2e122`;
nessuna riduzione di qualità, push, merge o deploy.
