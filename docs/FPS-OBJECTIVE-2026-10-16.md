# Obiettivo aggiuntivo: FPS sostenuti a qualità piena

16 ottobre 2026. Richiesta esplicita del proprietario alla ripresa del goal.

Puntare a60fps stabili nella vista ordinaria e nelle viste impegnative di nube,
pioggia e paesaggio, mantenendo macro256³, dettaglio128³,384 passi nominali e
output pieno configurato. Questo obiettivo si aggiunge ad anatomia delle tre
famiglie, luce ravvicinata continua, pioggia/virga integrate nel paesaggio e UI.
Nessuno di questi gate è sostituito dal contatore dei frame.

## Contratto delle misure

- Salvare build/hash, dispositivo e browser, thread main/worker, CSS/DPR,
  output e dimensione interna reali, stato della nube/meteo, camera e target.
  Le coppie devono usare lo stesso carico; verificare i report effettivi.
- Separare vista statica60s/forcing0 in pausa, usata per confrontare il costo,
  e prova in moto, necessaria per continuità luminosa e fluidità percepita.
- Il contatore attuale registra i callback rAF che arrivano all'invio del
  rendering. Con limite ai frame in volo scarta i callback rifiutati. Non conta
  le presentazioni del compositor e, senza limite, non dimostra coda stabile.
- La durata GPU attuale deriva dai timestamp Three: somma i pass di rendering
  campionati per frame e tiene l'ultimo frame del batch risolto. La media di
  queste somme è diagnostica; non è reciprocamente convertibile in FPS e non
  va confusa con latenza totale o throughput della GPU. I campioni sono sparsi.
- Il completamento della coda è distinto dalla presentazione. Per una futura
  accettazione servono frequenza e distribuzione degli intervalli, completamento
  del lavoro inviato senza accumulo crescente e osservazione del movimento.
  La sola media rAF o una singola durata GPU non bastano.

La prima [strumentazione dei prefissi completati](FPS-QUEUE-QUALIFICATION-2026-10-16.md)
è ora implementata e verificata: JSON atteso fino al fence finale, limite5s,
stati espliciti, clock locale e protezione dalle risposte di misure annullate.
Conserva i campi storici e aggiunge alias trasparenti nello schema2.

## Criterio operativo e ordine del lavoro

I30s attuali servono da confronto preliminare. La qualificazione sostenuta
richiede almeno90s dopo il riscaldamento per ogni scenario selezionato, ripetuti
se il risultato è vicino al limite o variabile. Su un display60Hz il riferimento
è circa16,67ms per intervallo: riportare media, mediana, p95, p99, massimo e
numero di intervalli oltre33,34ms, senza occultare pause o campioni mancanti.
Non dichiarare60fps stabili finché cadenza, coda e movimento non concordano.
Un target diverso per altro dispositivo va dichiarato con le sue dimensioni.

Ottimizzare lavoro ridondante dimostrato, senza ridurre dettaglio o campioni
occupati. Il riuso dell'intervallo nube vuoto è stato provato e ritirato:
corretto nel contratto qualificato, non ha mostrato un vantaggio GPU. La
prossima ipotesi documentata è il limite conservativo dell'altezza di emissione
pioggia, ancora da qualificare in f32 e misurare. Non è implementato.

Il solver del terreno resta un problema di correttezza separato: le pose
pioggia molto lente campionate guardano verso l'alto e non lo chiamano.
Il prototipo di terreno campionato modifica la geometria e non è una
ottimizzazione già approvata. Il precedente gate sul box globale della nube
è stato ritirato perché non ha dimostrato vantaggi.

## Stato alla ripresa

**Obiettivo aperto.** Controllo main3344×1882 della coppia valida:7,043invii/s;
candidata ritirata6,681invii/s. I report originali e i limiti visivi sono nel
[resoconto](EXPERIMENT-RAIN-TERRAIN-2026-10-15.md). Il materiale resta v34 e il
renderer v40 del checkpoint locale `792e764`, con nuova strumentazione schema2.
La candidata di riuso dell'intervallo vuoto è stata
[ritirata dopo il confronto](EXPERIMENT-RAIN-EMPTY-2026-10-16.md).
Nel primo report della nuova strumentazione a2560×1440, Sole dà59,994invii/s
su30s statici e Pioggia11,799invii/s; entrambi completano il prefisso finale.
Nessuna prova attuale qualifica
60fps nativi sostenuti nell'insieme degli scenari.

La ripresa è autorizzata in chat. Dopo la conferma del proprietario,
il tracciamento nativo è stato verificato `active`. L'obiettivo FPS aggiuntivo
è registrato qui; la funzione disponibile non permette di riscrivere
l'obiettivo del goal già esistente.
