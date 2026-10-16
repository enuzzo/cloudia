# Prossima prova terreno: pagine conservative dove si blocca il prefisso

Proposta del 2026-10-16, basata su lettura dei risultati e pochi calcoli aggregati. Non è stato eseguito alcun retrace, builder di metadata, GPU, bake o modifica prodotto. Il prototipo del ciclo 10 resta congelato. I dati della lettura sono in `inspection.json`; le note indipendenti sono in `review-notes.md`.

## Scelta

**Non aumentare i cap. Provare un formato gerarchico più compatto, con coordinate implicite, e usare il budget liberato per pagine fini nelle celle che impediscono la certificazione del primo ingresso.** Il punto finale continua a essere valutato con il campo originale. La gerarchia contiene bounds, non una superficie interpolata.

Il vantaggio cercato è duplice: leggere meno texel per attraversare una cella e avere bounds locali utili sul terreno lontano effettivamente visibile. La suddivisione fissa centrata nell'origine ha investito molta memoria nel posto sbagliato per questi residui.

## Cosa dicono i 292 irrisolti

La lettura dei fronti pendenti della variante centrale cap 64, senza rifare la ricerca, dà:

| Proprietà | Risultato |
| --- | ---: |
| Fronti inland saturo, coast CPU ≥ 13 | 288 |
| Fronti nella transizione costa | 4 |
| Fronti in mare, coast CPU ≤ 0 | 0 |
| Foglia attuale da 2 km | 267 |
| Foglia attuale da 32 km | 13 |
| Foglia attuale da 250 m | 12 |
| Con un witness occupato già disponibile | 291 |

Il fronte mediano è a x = −53,49 km; il 25–75% è tra −77,50 e −39,27 km. È fuori dalla regione raffinata a 250 m, che finisce a ±32 km. Il gap mediano verso il witness conosciuto è 18,51 m; il problema prevalente è provare il prefisso, non trovare un punto sotto il terreno.

Esempi riproducibili:

- `home-down-1-5`: fronte x = −133,52 km, foglia da 32 km, coast = 147,18, clearance positiva di 0,088 m; il witness è solo 2,21 m più avanti. Il bounds numerico della foglia usa E ≈ 0,323 m.
- `coastal-horizon-0-14`: non è una transizione di costa nonostante il nome del gruppo. Coast = 85,69, foglia da 2 km, fronte a x = −70,78 km e witness 36,08 m più avanti.
- `coastal-horizon-38-17`: unico `unresolved-contact`, già in una foglia da 250 m. Clearance al fronte ≈ 0,0853 m e 2E ≈ 0,0875 m. Questo è un controllo numerico distinto: una pagina spazialmente più fine può stringere E, ma non si deve presumere che elimini il limite del ledger.

L'assegnazione a una foglia qui usa una convenzione deterministica sui bordi. Non sostituisce la visita di entrambi i rettangoli chiusi quando un raggio percorre un confine.

## Formato concreto e costo atteso

Oggi ogni nodo carica tre RGBA32F: altezza, rettangolo, gradienti. Il rettangolo è già ricostruibile da radice, livello e bit del figlio. Inoltre i gradienti servono solo quando si arriva a una foglia.

Separare quindi due array, senza quantizzare a precisione inferiore:

1. **Record base, un RGBA32F per nodo:** `[Hmin, Hmax, childOrGradientIndex, E_or_flags]`.
2. **Record gradiente, un RGBA32F soltanto per foglia:** `[gxMin, gxMax, gzMin, gzMax]`.

Un indice positivo indica quattro figli contigui; un indice negativo codifica il record gradiente della foglia. Il conteggio resta molto sotto il limite di interi esatti f32; il formato deve rifiutare una crescita oltre quel contratto. I rettangoli sono derivati nello stack. Il valore E rimane outward nel quarto componente del record foglia. Nessun f16 e nessuna riduzione dei margini.

Il quadtree corrente ha 109141 nodi e 81856 foglie. Il costo diventa:

```
16 × 109141 + 16 × 81856 = 3055952 byte = 2,914 MiB
```

contro 5238768 byte attuali. È una stima esatta del formato, non un risultato di un builder nuovo.

Prima di leggere i figli, calcolare i loro quattro rettangoli dal padre e intersecarli con il raggio. Si caricano soltanto i figli effettivamente intersecati, mantenendo ordine near-first e tutti i casi di bordo. Ogni nodo interno richiede un record, invece di tre; scompare la necessità di caricare quattro record figli per scoprire dove sono. Questo non promette un fattore fisso sul tempo GPU: riduce operazioni e banda in un punto identificato del percorso reale.

Le coordinate implicite non devono gonfiare lo stack del fragment. Una rappresentazione concreta è un elemento da 16 byte `{range:vec2f, node:u32, key:u32}`: `key` contiene x-cell a 14 bit, z-cell a 14 bit e livello a 4 bit. Nel dominio da 1024 km copre fino al livello 14, cioè celle da 62,5 m; origine e dimensione dyadiche si ricostruiscono esattamente in f32. L'eventuale indice del campione ancora va impacchettato nei bit liberi di `node`, entro il contratto di conteggio. Se servissero livelli più fini o lo stack reale spillsasse, il costo va misurato e la rappresentazione rivista: non si può contare soltanto la banda risparmiata.

Le 292 posizioni bloccate appartengono a 239 foglie distinte: 223 da 2 km, quattro da 32 km e dodici da 250 m. Raffinare **soltanto quelle foglie osservate** fino a 250 m aggiungerebbe 106108 nodi. Il formato compatto richiederebbe circa 6026976 byte totali, 5,748 MiB, contro i 4,996 MiB attuali. È un conto di capacità utile per fissare un tetto di **8 MiB**.

Questo conto non prova che le stesse 292 ricerche si risolvano, né che quei soli punti rappresentino l'intero cammino dei raggi. Non si deve scegliere una pagina dal risultato dell'oracle e poi spacciare il test sugli stessi raggi per generalizzazione.

## Politica delle pagine nel renderer

Una pagina è una patch del campo originale, con bounds e gradienti analitici costruiti dalla stessa funzione e dagli stessi hash. Si seleziona usando celle che intersecano l'envelope possibile nella vista corrente e il primo nodo che impedisce una prova con il cap corrente. La richiesta contiene ID world-space, dimensione, hash del terreno e versione del ledger; non contiene una distanza hit da usare come geometria.

Il pass GPU può esportare gli ID bloccanti in una piccola coda, deduplicata prima di preparare le pagine. Il refill deve avvenire fuori dal render loop e avere un budget esplicito; le pagine sono riutilizzabili tra frame e tra raggi. Il campo è statico per il seed, quindi non vanno ricostruite a ogni movimento della camera. Occorre prefetch delle celle vicine alla vista, non una ricostruzione orientata a ogni singolo raggio.

Una pagina mancante o un limite memoria/preparazione esaurito produce ancora `unresolved`. Non autorizza il vecchio Newton come fallback corretto, una mesh visibile approssimata o un mare inventato davanti a una montagna. La promozione richiederà copertura del dominio di camera usato dal prodotto e un comportamento di refill che non blocchi l'interazione.

## Prossima prova falsificabile

Un solo confronto A/B, con **cap 16, 256 visite, stack 48 e banda di 1 m invariati**. Niente sweep di cap.

1. Reimpacchettare gli stessi bounds già congelati nel nuovo formato; prima di qualsiasi pagina nuova, richiedere esiti geometrici identici. Contare fetch di record, intersezioni dei figli e valutazioni noise effettive.
2. Preparare un numero limitato di pagine su tre piccoli fasci che attraversano le aree di `home-down-1-5`, `coastal-horizon-0-14` e la transizione di costa. Le richieste devono venire dal broad phase/cap normale di un sottoinsieme di raggi, senza usare le distanze hit dell'oracle. Tenere `coastal-horizon-38-17` come controllo del limite numerico e `low-x-16-dy0` come controllo vicino già difficile.
3. Valutare raggi vicini **non usati per richiedere le pagine** e una piccola variazione di yaw. Solo dopo questo controllo, eseguire una volta la matrice 5198 con lo stesso cap 16. Esportare tutti gli unresolved e le cause, senza una mappa che mostri soltanto gli hit.
4. Integrare la sola lettura compatta e il piccolo set di pagine in un probe del percorso Three/TSL reale. La prima verifica GPU deve essere piccola e separata dalle nuvole; poi una finestra A/B alla stessa risoluzione, camera e qualità del renderer completo. Misurare tempo GPU se i timestamp sono disponibili, oltre a memoria, upload e lavoro effettivo. I contatori di invio non vanno tradotti automaticamente in FPS.

Condizioni di successo da fissare prima della prova:

- Zero nuovo conflitto con i prefissi/witness già qualificati e zero bracket sopra 1 m.
- Almeno dimezzare i 666 unresolved di cap 16 sul test completo, senza aumentare cap o usare i risultati come superficie.
- Ridurre di almeno il 50% le letture metadata sul confronto senza nuove pagine; la riduzione è una soglia di prova, non una previsione misurata.
- Restare entro 8 MiB di metadata e non eseguire query CPU sincrone del campo nel render loop.
- Il probe GPU deve ridurre il costo reale, inclusi upload e pass extra. Una prima allocazione di progetto può riservare al terreno 2 ms del frame, ma questo è un budget da verificare, non prova di 60 FPS. La prova finale resta il renderer completo alla qualità piena.

Rifiutare la candidata se il refill invade il render loop, i nuovi fronti si spostano continuamente in pagine non residenti, la memoria cresce senza tetto, il costo del paging annulla i fetch risparmiati, o i bounds restano troppo larghi anche nelle pagine fini. Il contatto numerico non va forzato: se rimane, serve un trattamento separato del ledger o un piccolo percorso interval qualificato, non altro cap.

## Alternative considerate e perché non le scelgo come prima prova

| Idea | Utilità concreta | Limite attuale |
| --- | --- | --- |
| Mare e plateau esatti | Il prodotto già salta il rilievo quando relief = 0. Una cella con coastUpper ≤ 0 può saltare ridge/range; con coastLower ≥ 13 può saltare coast noise/sin. | Nessuno dei 292 fronti è in mare e 288 sono già inland: non risolve il difetto dominante di allocazione. È una successiva semplificazione esatta, da contare in noise reali. |
| Separare le ottave | Si può classificare lontano dal terreno con somme parziali e un tail positivo conservativo. | Il tail dopo la terza ottava è ancora circa 0,046 prima del pow: troppo grande per presumere precisione di 1 m. Il valore completo resta necessario per un witness finale. |
| Gradiente direzionale | Può conservare correlazioni perse dall'AABB gx/gz. | Non recupera il dettaglio spaziale cancellato in celle da 2–32 km. Ricostruirlo per camera sarebbe costoso; altre direzioni aggiungono banda. |
| Plane proxy sugli attuali bounds | Un piano centrale con slope medio e raggio da oscillazione del gradiente è una maggiorante/minorante valida con ±2E. | Sui 292 fronti la larghezza derivata ha mediana circa 4186 m di quota. Da sola non stringe il percorso; è stata scartata per questa prima prova. |
| Mesh/heightfield raster visibile | Sposta lavoro dal fragment all'hardware raster, possibile direzione se il ray tracing resta fuori budget. | Sarebbe una nuova rappresentazione geometrica: nessuna promozione senza errore geometrico dichiarato e prova della silhouette. Inoltre il relief attuale dipende dal raggio, quindi non è immediatamente una singola superficie world-space da rasterizzare. |

Una mesh resta ammissibile come **proxy di bounds**: per un triangolo serve un errore analitico `|Horiginale − Hproxy| ≤ δH`, più conversione sferica, aritmetica e bounds del relief per raggio. Gli estremi devono racchiudere il campo originale; il fragment finale continua a interrogare quel campo. Senza questi dati una mesh non è una correzione del solver. Anche una mesh con errore verticale piccolo non garantisce un errore lungo il raggio di 1 m vicino a un tangente.

## Fonti primarie e limiti del trasferimento

Le [geometry clipmaps di Losasso e Hoppe](https://hhoppe.com/proj/geomclipmap/) e la [realizzazione GPU di Asirvatham e Hoppe](https://hhoppe.com/proj/gpugcm/) mostrano il valore di cache spaziali incrementali e dati riutilizzati mentre la vista si muove. Qui trasferiamo quel principio alla residenza dei bounds; non adottiamo la loro superficie campionata come nuova geometria, né i loro FPS come misura di Cloudia.

Il preprint di Malyshau, [Six Ways to Draw Vangers with WebGPU](https://arxiv.org/abs/2608.17390), confronta più percorsi nello stesso engine e mostra che una vista dall'alto può nascondere errori che compaiono all'orizzonte. È motivazione per il confronto nel renderer e per i casi grazing, non una prova che la sua mesh o i suoi risultati si trasferiscano al nostro campo procedurale. È stato consultato l'abstract; non viene usato come certificato numerico.

La [specifica WebGPU](https://www.w3.org/TR/webgpu/) distingue render/compute pass e segnala differenze di rasterizzazione/precisione fra implementazioni. Il disegno del probe deve qualificare il percorso realmente compilato. Non è stato individuato un controllo di conservative rasterization in `GPUPrimitiveState`, quindi non lo assumiamo per certificare proxy e bordi.

## Provenienza e stato

Campo originale SHA256 `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`; fixture SHA256 `cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1`. Le statistiche derivano dal `final-results.json` del ciclo 10, variante `midpoint-64`; non sono un nuovo risultato di copertura.

Il tentativo terrain-gpu precedente rimane senza risultato numerico recuperato e con causa del blocco sconosciuta. I budget host e la qualificazione universale GPU restano aperti. La proposta non allenta E, geometria, tolleranza, risoluzione o qualità; indica il prossimo esperimento capace di smentire rapidamente questa scelta.
