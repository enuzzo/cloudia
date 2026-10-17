# Esito del ledger — dodici campioni, correzione ancora indeterminata

**Il ledger è qualificato e separa alcuni meccanismi locali. Non giustifica ancora una correzione globale del terreno.** L'analisi è solo aritmetica dei JSON salvati; nessun modello, raggio, texture sampling, browser o GPU è stato eseguito dal revisore.

Script e protocollo erano congelati prima della lettura del ledger. Input ledger 62.893 B SHA `b0fc343ea49b161f6f7922fcd086852137d93e383d8fb2bdb76b64790d37cadc`; faces 23.863 B SHA `d8420acc356e1026cc1ae5278c43ec631568030cf8c19fd96d92e06cf10b708a`. Output `shading-ledger-analysis.json`: **QUALIFIED_SAVED_ARITHMETIC**, 80 gate superati, 12 record uniti e tre coppie conservate.

- Tutti e quattro i buffer CPU installati corrispondono ai digest e alle dimensioni canoniche. Questo controlla le viste CPU destinate all'upload, non legge i buffer GPU.
- Cached, fresh e restored condividono il whole-target SHA `07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9`.
- Le 36 parole distanza diagnostiche coincidono esattamente con i corrispondenti 12 alpha ordinary. Probe completo, stato ripristinato e drain fulfilled.
- Errore massimo sulla lunghezza unitaria: macro 5,2184e−8, finale 7,0680e−8. Massimo residuo `D−max(0,n·Sun)`: 1,7319e−8. Nessuna incoerenza aritmetica rilevata ai campioni.

| Coppia storica | D artifact / control | S artifact / control | V artifact / control | Y artifact / control | Conseguenza locale |
| --- | ---: | ---: | ---: | ---: | --- |
| L1 | 0 / 0 | 0,870625 / 0,875072 | 0 / 1 | 1,151441 | La differenza di visibility non può cambiare il termine diretto, già nullo. L'artifact storico risulta più luminoso del control in questo materiale. |
| L2 | 0,211666 / 0,101502 | 0,864901 / 0,866535 | 1 / 1 | 1,424803 | Il fattore diretto è 2,08534 volte maggiore nel primo punto; la differenza esiste già nella normale macro. Non deriva qui dal cast-shadow. |
| L3 | 0 / 0 | 0,843512 / 0,884390 | 1 / 1 | 0,947613 | Il termine diretto è nullo. La variazione S è compatibile con una parte del contrasto, ma colore e gli altri termini non sono separati da questo ledger. |

Le Y sono luminanze lineari del target terreno prima di atmosfera/nube/film; non luminanze del PNG finale. I nomi artifact/control conservano la selezione storica e non classificano le macchie visibili attuali.

**La perturbazione rough non attraversa il terminatore in nessuno dei 12 punti.** L'angolo macro→finale massimo è 0,108825° nel control costiero C2; nei sei punti L1/L2/L3 è 0,049164° e per gli altri è ancora minore. Il ledger non sostiene una riduzione globale della perturbazione delle normali come correzione delle ribbon.

La reference CPU storica di L2 presenta l'ordine opposto tra le normali delle facce: `Nface·Sun` 0,048157 / 0,257960, mentre la normale macro GPU dà 0,211674 / 0,101476. Questo documenta che faccia e normale interpolata possono produrre contrasti diretti differenti nei due campioni. **Non prova un errore di interpolazione o una faccia GPU sbagliata**, né dimostra che sostituire la normale con quella di faccia migliori l'immagine. Il precedente crease45 respinto resta un limite alla scelta di un'altra soglia senza una nuova evidenza visiva.

Le facce provengono dal raycaster CPU storico, con camera/source/hash autenticati. Il loro confronto di distanza con l'ordinary GPU resta numerico: massimo delta assoluto fra i 12 record 0,0000605895 km, circa 6,06 cm. Non è stata introdotta una tolleranza per dichiarare identità CPU/GPU; i 36 confronti bit-esatti riguardano esclusivamente le modalità GPU attuali. Nessun winner raster GPU è certificato dalla reference.

**Decisione consigliata:** non scegliere da questi dati un nuovo bias shadow, un altro angolo crease o un'intensità rough. La causa dell'intera ribbon e la sua correzione rimangono indeterminate. I campioni escludono meccanismi specifici ai punti; non coprono ancora la forma continua della linea. Un eventuale seguito deve fissare prima una selezione che attraversi la ribbon e leggere i termini mancanti senza scegliere pixel favorevoli dopo il risultato. Questo è un passo diagnostico ulteriore, non una proposta di correzione già sostenuta dal ledger, né una prova di fotorealismo, Sole fisico o FPS.
