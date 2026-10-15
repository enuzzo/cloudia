# Obiettivo aggiuntivo: FPS sostenuti a qualità piena

16 ottobre 2026. Richiesta esplicita del proprietario alla ripresa del goal.

Puntare a 60 FPS stabili nella vista ordinaria e nelle viste impegnative di nube,
pioggia e paesaggio, mantenendo macro 256³, dettaglio 128³, 384 passi nominali e
output pieno configurato. Questo obiettivo si aggiunge ad anatomia delle tre
famiglie, luce ravvicinata continua, pioggia/virga integrate nel paesaggio e UI.
Nessuno di questi gate è sostituito dal contatore dei frame.

## Aggiornamento del decimo ciclo

[Schema 3 con pass identificati](FPS-PASS-LEDGER-2026-10-16.md) implementato e
qualificato in main e worker: copertura dei draw completa o mancante esplicita,
nessun doppio conteggio forzato, query precedenti e warmup esclusi. Le vecchie
medie sparse restano distinguibili dai nuovi aggregati. Nessuna nuova query
GPU o attesa finale di timestamp. Il build finale registra forcingTime,
weatherTime e tempo dell'uniforme precipitazione all'inizio/fine.

Sole statico: circa59,996 invii/s main/worker a2560×1440. Pioggia statica:
13,636 e13,784 in due controlli main, tutti i prefissi completati. La somma
dei pass resta superiore al periodo di invio; i dati non danno una timeline
fisica né autorizzano una divisione per due o una diagnosi hardware.

Un precedente [caso ravvicinato ordinario al100%](measurements/fps-pass-ledger-2026-10-16/historical-near/schema2-sun-near100.json)
misura21,832 invii/s su30s, p9550,8ms e chiusura182,5ms. È a t533,0332 in pausa
con superficie stimata CPU, non una coppia confrontabile con il profilo t60.
Il raggio della superficie è misurato dal target, non dalla faccia della camera:
la nebbia quasi bianca al massimo avvicinamento non prova da sola perdita di dettaglio.

Il [conteggio del lavoro pioggia](RAIN-WORK-2026-10-16.md) non giustifica la
maschera non convessa128²: saldo lookup soltanto+.53% prima dell'ALU. La nuova
maschera stretta dopo flow resta una candidata esterna; il suo saldo semantico
non è un miglioramento FPS misurato. **Obiettivo60 sostenuti ancora aperto.**

## Contratto delle misure

- Salvare build/hash, dispositivo e browser, thread main/worker, CSS/DPR,
  output e dimensione interna reali, stato della nube/meteo, camera e target.
  Le coppie devono usare lo stesso carico; verificare i report effettivi.
- Separare vista statica a t=60 s / forcing 0 in pausa, usata per confrontare il costo,
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
è ora implementata e verificata: JSON atteso fino al fence finale, limite 5 s,
stati espliciti, clock locale e protezione dalle risposte di misure annullate.
Conserva i campi storici e aggiunge alias trasparenti nello schema 2.

## Criterio operativo e ordine del lavoro

I 30 s attuali servono da confronto preliminare. La qualificazione sostenuta
richiede almeno 90 s dopo il riscaldamento per ogni scenario selezionato, ripetuti
se il risultato è vicino al limite o variabile. Su un display 60 Hz il riferimento
è circa 16,67 ms per intervallo: riportare media, mediana, p95, p99, massimo e
numero di intervalli oltre 33,34 ms, senza occultare pause o campioni mancanti.
Non dichiarare 60 FPS stabili finché cadenza, coda e movimento non concordano.
Un target diverso per altro dispositivo va dichiarato con le sue dimensioni.

Ottimizzare lavoro ridondante dimostrato, senza ridurre dettaglio o campioni
occupati. Il riuso dell'intervallo nube vuoto è stato provato e ritirato:
corretto nel contratto qualificato, non ha mostrato un vantaggio GPU. La
successiva ipotesi del limite conservativo dell'altezza di emissione pioggia è
stata qualificata e misurata, quindi [ritirata](EXPERIMENT-RAIN-UPPER-2026-10-16.md):
nessun vantaggio dimostrato nella sequenza A/B/A a carico verificato. Anche i
controlli variano fra loro, quindi conservare le coppie e ripetere quando serve;
non interpretare differenze fra vecchi checkpoint come miglioramenti causali.

La [proposta laterale successiva](measurements/rain-lateral-proposal-2026-10-16/RAIN-LATERAL-NEXT.md)
è soltanto una stima CPU sulla mappa già disponibile: prisma conservativo a
otto lati, senza nuova texture, unito al vuoto continuo della nube. Nella
griglia 64×36 della posa campionata esclude il 14,41% della lunghezza nel box
pioggia; solo il 4,13% è anche fuori dal box nube. Opacità e campioni effettivi
non sono misurati: non sono percentuali di risparmio o di FPS. Qualificare
prima i limiti f32 e il potenziale reale; nessuna patch già promossa.

Il solver del terreno resta un problema di correttezza separato: le pose
pioggia molto lente campionate guardano verso l'alto e non lo chiamano.
Il prototipo di terreno campionato modifica la geometria e non è una
ottimizzazione già approvata. Il precedente gate sul box globale della nube
è stato ritirato perché non ha dimostrato vantaggi.

## Stato alla ripresa

**Obiettivo aperto.** Controllo main 3344×1882 della coppia valida: 7,043 invii/s;
candidata ritirata 6,681 invii/s. I report originali e i limiti visivi sono nel
[resoconto](EXPERIMENT-RAIN-TERRAIN-2026-10-15.md). Il materiale resta v34 e il
renderer v40 del checkpoint locale `792e764`, con nuova strumentazione schema 2.
La candidata di riuso dell'intervallo vuoto è stata
[ritirata dopo il confronto](EXPERIMENT-RAIN-EMPTY-2026-10-16.md).
Nel primo report della nuova strumentazione a 2560×1440, Sole dà 59,994 invii/s
su 30 s statici e Pioggia 11,799 invii/s; entrambi completano il prefisso finale.
Nel nono ciclo i controlli Pioggia danno 14,209 e 13,466 invii/s, contro 13,066
della candidata ritirata. Tutti completano il prefisso finale; le immagini CSS
della vista statica coincidono. Il prodotto è ripristinato al checkpoint `a1efb8e`.
Nessuna prova attuale qualifica
60 FPS nativi sostenuti nell'insieme degli scenari.

La [prima prova ordinaria di 90 s in moto](FPS-SUSTAINED-SUN-2026-10-16.md),
Sole a 2560×1440, dà 59,9405 invii/s e 59,9323/s limitati dal completamento
del prefisso, con chiusura finale 4,4 ms. Due intervalli oltre 33,34 ms,
massimo 51,7 ms; p95 18,6 ms. Nessuna crescita evidente delle attese nei
campioni periodici. È una singola vista, con camera ferma e presentazione
non misurata: la pioggia e gli altri gate restano aperti.

La ripresa è autorizzata in chat. Dopo la conferma del proprietario,
il tracciamento nativo è stato verificato `active`. L'obiettivo FPS aggiuntivo
è registrato qui; la funzione disponibile non permette di riscrivere
l'obiettivo del goal già esistente.
