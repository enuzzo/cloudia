# Obiettivo aggiuntivo: FPS sostenuti a qualità piena

16 ottobre 2026. Richiesta esplicita del proprietario alla ripresa del goal.

Puntare a 60 FPS stabili nella vista ordinaria e nelle viste impegnative di nube,
pioggia e paesaggio, mantenendo macro 256³, dettaglio 128³, 384 passi nominali e
output pieno configurato. Questo obiettivo si aggiunge ad anatomia delle tre
famiglie, luce ravvicinata continua, pioggia/virga integrate nel paesaggio e UI.
Nessuno di questi gate è sostituito dal contatore dei frame.

## Stato corrente: v52 terreno raster, 60 FPS ancora aperti

La nuova richiesta del proprietario dà priorità a
[terreno e montagne più credibili](TERRAIN-REALISM-2026-10-16.md). v52
sostituisce il vecchio solver con una mesh sferica saldata, materiali opachi e
ombre reali tra dorsali. Nube 256³/128³, 384 passi nominali e output pieno
rimangono configurati. È un cambio di geometria e di immagine autorizzato,
quindi un suo tempo non è una misura di speedup a immagine equivalente.

R5: 320 test/40 file, typecheck e app→hero PASS. La misura corrente è una nuova caratterizzazione, separata dalle vecchie coppie A/B.

R5 main, seed 74, tempo 60 s in pausa, vento 55%, dispersione 0%, pioggia 80%,
yaw 1,3852869846402587 / pitch 0,2811279826464208, flusso completo e output
nativo **2474×1844**: 30 s, 487 intervalli, **16,2139846 invii/s**, mediana
66,60 ms / p95 67,20 ms, prefisso coda completato. Presentazione del compositore
non misurata. Il ledger registra quattro chiamate render per draw; le somme
di pass non equivalgono al tempo trascorso né al throughput GPU. La risoluzione,
il seed, il terreno e la camera differiscono dai vecchi controlli: nessuna
percentuale di miglioramento ricavata da quel confronto. **60 FPS non raggiunti.**

Il trial esterno zero-factor ha superato il controllo Float32 nativo nella
posa controllata, ma la serie prestazionale si è interrotta dopo A1:
14,3751 invii/s a 2112×1844. L'attesa dell'API download è durata circa 75 minuti,
poi la nuova richiesta sul terreno ha cambiato la priorità. Nessun B o A2,
nessuna attribuzione di vantaggio e nessuna promozione delle guardie. Non
riprendere quella coppia attraverso un'interruzione così lunga: occorre una
serie nuova e continua se verrà riproposto il trial.

## Riferimento storico v50 e cache terreno ritirata

Il prodotto resta quello di `10493af`: 256³/128³/384 e output pieno, R8
selezionata nella pioggia, continuità solare v49 e modifiche di qualità v50.
La qualifica integrata v50 conserva 255 test/37 file, typecheck e app→hero;
le successive prove qui sotto restano trial esterni.

Il [confronto cache terreno](EXPERIMENT-TERRAIN-GEOMETRY-CACHE-2026-10-16.md)
usa sei finestre da 30 s a **2112×1844 nativi**, stessa camera, seed 72,
tempo 60 s in pausa, vento 55%, dispersione 0%, flusso e lavoro completi.

|Scenario|A1 v50|B cache|A2 v50|Esito|
|---|---:|---:|---:|---|
|Pioggia 80%|13,5165|13,9503|13,6503|+2,1975% sul controllo migliore; sotto gate 5%|
|Sole dry|59,9978|59,9964|59,9944|Cadenza vicina al limite rAF, nessun beneficio osservato|

Valori in invii/s, **presentazione non misurata**. Prefissi coda completi;
timestamp con copertura parziale esplicita. La cache richiede circa 59,43 MiB
e il render post-film Float32 non è bit-identico: trial ritirato. Le condizioni
e la griglia differiscono dai cicli precedenti; non sommare percentuali.

Per evitare di ripetere prove concluse, questi percorsi restano fermati:

- [Cache pioggia A/s](RAIN-CACHE-AUDIT-2026-10-16.md), phase1 e phase2:
  128³/256³ falliscono il massimo mapping 1,5 m. Il 256³ supera p99/tau;
  le code tenui non provano danno fotografico e non cambiano i gate iniziali.
- [Riuso aerial](EXPERIMENT-SHARED-AERIAL-2026-10-16.md): la replica non
  riproduce il vantaggio, con deriva dei controlli; nessuno speedup attribuito.
- [Cache geometria terreno](EXPERIMENT-TERRAIN-GEOMETRY-CACHE-2026-10-16.md):
  il confronto corrente sopra non giustifica adozione o altre repliche.

Il successivo audit di fattibilità preferisce una rappresentazione diversa:
[A-only](RAIN-AMPLITUDE-ONLY-2026-10-16.md), che conserva il calcolo originale
delle coordinate streak e interpola soltanto l'ampiezza. Un solo replay CPU
storico, 576 raggi e nessun bake: mapping zero sui 206.466 punti controllati;
128³ fallisce il massimo tau, 256³ supera i gate tau massimo .01/media .002
con .00336424/.00018611. Il supporto A cambia e una continuazione oltre cutoff
resta censurata nel 256³: nessuna prova di immagine o di un rendering completo.
Il gate CPU ha giustificato la [microprova di formato GPU](RAIN-AMPLITUDE-GPU-FORMAT-2026-10-16.md):
R3 passa i percorsi core e Tier1 opt-in sulle due piccole griglie, con
pack/unpack esplicito prima dello store diretto. R2 resta FAIL del witness
RNE più stretto della conversione WGSL. Nessun campo A completo, costo di
rebuild, immagine o FPS è qualificato da queste prove.

Prima di investire nella cache, trial esterno delle guardie esatte attached0
prima di sheets ed evaporation0 prima di streak, formule positive invariate.
I dati storici consentono 51.560 chiamate in meno/4,0721% del vecchio loop;
nessuna nuova memoria o approssimazione di A. Il saldo di tempo dipende anche
dai branch GPU e deve essere misurato. Nessun beneficio ancora attribuito.

La preintegrazione rain-only di [RAIN-NEXT](RAIN-NEXT-2026-10-16.md) resta
un'alternativa ineseguita: prima di gerarchie e contatori serve verificare che
la certificazione non assorba il risparmio. La sorgente aerial v50 usa
`k=.006+.004*haze`; `.0035*haze` in quella proposta è il modello storico.
Nessuna di queste misure chiude il target 60 FPS sostenuti o i gate artistici.

## Istantanea v48: R8 selezionata soltanto con pioggia

La [candidata v48](EXPERIMENT-DENSITY-R8-2026-10-16.md) conserva lo shader
asciutto v46 e usa una copia byte-esatta R8 nel lookup densità con pioggia.
V47 A/B/A rain: 12,7447 / 13,6659 / 12,8183 invii/s, +6,61% sul migliore
controllo; immagini CSS identiche. Il Sole near non beneficia della copia,
quindi la versione finale seleziona il percorso originale quando asciutto.
Memoria aggiuntiva esplicita: 16 MiB CPU e 16 MiB nominali GPU.

Audit raw finito 77.629 confronti bit-identici. V48 passa worker statico,
main in moto 90 s e ritorno dry, tutti con prefisso GPU completato e qualità
piena. I 90 s rain misurano **13,3560 invii/s**, p95 83,6 ms; tutti gli
intervalli oltre 33,34 ms. **Obiettivo 60 ancora aperto**, insieme a
presentazione, altre pose/seed e continuità artistica. I confronti storici
sotto rimangono riferiti ai rispettivi build e sessioni.

## Istantanea v46 dopo il confronto pioggia A/B/A

Il [checkpoint locale 6a7df91](FPS-RAIN-ABA-2026-10-16.md) documenta un vantaggio
della maschera v46 in una scena pioggia statica a qualità piena: 17,3227 invii/s
contro 14,9831 e 15,7236 nei due controlli. Il margine sul migliore è 10,17%;
non è una qualifica dei 60 FPS o della presentazione. La scheda diagnostica
bloccata citata nei resoconti precedenti non era più presente. I tre prefissi
finali sono completati, le immagini CSS byte-identiche e le console vuote.

I conteggi del lavoro e i tempi GPU restano diagnostici; lo schema 3 identifica
i pass e la copertura effettiva. La parte storica sotto non sostituisce queste
misure. La cache A/s rimane non promossa dopo l'audit CPU e non è un percorso
implementato. La prossima candidata separa gli stessi byte densità in R8:
nuova memoria esplicita, parità del sampler e beneficio da verificare prima
dell'adozione, senza cambiare campioni, materiale o qualità.

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
- I timestamp Three restano diagnostici. Lo schema 3 associa i pass freschi ai
  draw solo tramite il ledger verificato e dichiara copertura completa/mancante;
  le vecchie medie sparse dell'ultimo frame del batch restano campi separati.
  Le somme non sono convertibili in FPS o costo GPU esclusivo. I raw attuali
  non conservano begin/end assoluti: non dimostrano una timeline fisica o
  assenza di sovrapposizioni fra gli intervalli.
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
