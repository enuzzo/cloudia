# Select/SubBuild e controesempio affine del minimum ritagliato

16 ottobre 2026. Sola lettura del pinned Three186 e dimostrazione analitica di UN caso fissato. Nessuno script numerico, ricerca su griglia, test, build, GPU o modifica dei sorgenti. Questo documento è distinto da `gpu-mismatch-static-review.md`. Non attribuisce una causa ai puntini reali del trial R1.

## 1. Stessi shadowCornerK in positionNode e varying

La domanda è fondata: TSL `select` non garantisce una selezione eager tipo builtin WGSL select. `ConditionalNode.js:101–121` isola i due rami e, fuori uniformFlow, assegna nodeBlock distinti; `:148–157` usa la ternaria soltanto per uniformFlow, altrimenti `:161–217` emette if/else. Leggere soltanto l’espressione JS non basta quindi a provare che tutti i corner siano inizializzati.

Nel caso specifico ci sono però protezioni esplicite nel builder:

- `.toVar` crea un VarNode con global=true/parents=true (`VarNode.js:48–91`), mentre i tre K sono tre oggetti e nomi distinti. Il nome non è da solo una prova di lifetime.
- Durante setup, se la variabile non appartiene già a uno stack e il contesto è un nodeBlock/loop, `VarNode.build:186–223` la aggiunge al **base active stack**, proprio per rendere disponibile la dichiarazione fuori dal ramo. `NodeBuilder.getBaseStack:1869–1872` restituisce activeStacks[0]; `StackNode.addToStack:125–159` inserisce il nuovo nodo nella sequenza. Perciò «i corner non selezionati sono sicuramente lasciati a zero» non segue dal codice: esiste una hoist esplicita che contrasta quel rischio.
- Il codice generate di VarNode (`:275–302`) costruisce il load e aggiunge l’assegnazione. La cache dello snippet di Node (`Node.js:968–999`) può riusare quel risultato; se cambia il nodeBlock, `addFlowCodeHierarchy` (`NodeBuilder.js:2352–2380`) può ripetere il codice nel ramo che non lo ha ereditato.
- `getDataFromNode` usa cache globale per nodi globali ma gestisce anche subBuildsCache per la closest subBuild registrata (`NodeBuilder.js:1926–1960`). `getVarFromNode:2128–2155` qualifica il nome dove necessario. Non basta quindi vedere lo stesso nome JS per concludere alias POSITION↔VERTEX; allo stesso tempo i soli nomi non dimostrano che due contesti abbiano la stessa assegnazione.
- `NodeMaterial.js:804–806` costruisce positionNode nel subBuild POSITION. `VaryingNode.js:122–189` forza il calcolo in VERTEX; `flowNodeFromShaderStage` (`NodeBuilder.js:2747–2775`) rimuove nodeBlock e usa la global cache. Queste transizioni sono precisamente il punto da verificare nel WGSL effettivo, non una ragione sufficiente per riscrivere il helper.

**Esito della lettura:** nessun bug branch-scoped concreto dimostrato. L’implementazione ha meccanismi di hoist/ripetizione/partizione dei subBuild; l’ipotesi «load solo nel ramo selezionato, poi UVQ legge gli altri non inizializzati» resta falsificabile ma non va assunta. Il controllo discriminante è il vertex WGSL realmente eseguito: per ogni vertexIndex devono esserci i tre storage loads corretti, dominanti rispetto all’uso dei tre UVQ flat, oppure assegnazioni equivalenti nei rispettivi contesti. Verificare i prefissi POSITION_/VERTEX_ e le assegnazioni, non soltanto le dichiarazioni. Non ho generato un nuovo shader per questa review.

Il readback R32F dei12 texel può già mostrare se il minimum prodotto è quello atteso. Se coincide col clipping, questo rischio di variabili non inizializzate non serve a spiegare quei12 dati, anche se non prova da solo tutti i corner dell’intera mappa.

## 2. Un controesempio intrinseco con due triangoli coplanari

Caso analitico fissato, senza esecuzione numerica. Stesse costanti del prodotto: centro C=(0,−4,0)km, Sole S=(0,1,0), radius64km, risoluzione2048, passo Δ=128/2048=.0625km, offset radiale h=Δ/2=.03125km e caster bias b=.001km. La base generata da terrainShadowFrame è R=(−1,0,0), U=(0,0,1).

Uso coordinate luce ξ=−worldX, η=worldZ, q=worldY+4. La superficie è UN SOLO piano heightfield:

`q = .5 + 2ξ`, ossia `worldY = −3.5 − 2*worldX`.

Due triangoli con winding frontale al Sole lo tassellano lungo un edge comune:

| Triangolo | Tre corner (ξ,η,q), km |
| --- | --- |
| A | (.02,−.1,.54), (.1,0,.7), (.02,.1,.54) |
| B | (.02,.1,.54), (−.1,0,.3), (.02,−.1,.54) |

Entrambi hanno normale orientata N=(2,1,0)/sqrt(5), quindi N·S=1/sqrt(5)>0. Non c’è backface o cambio di piano. L’edge comune è ξ=.02, −.1≤η≤.1.

Il texel indirizzato è (1024,1024), dominio ξ∈[0,Δ], η∈[−Δ,0]. Il suo centro (.03125,−.03125) è strettamente dentro A e fuori B. Quindi il raster RAW sceglie A senza pareggio fra le due facce. Su A∩texel il minimo q è .54, raggiunto sull’edge ξ=.02. Il nuovo valore memorizzato è:

`clippedStored = .54 − .001 = .539km`.

Il vecchio piano esteso a tutto il texel ha minimo .5. Equivalentemente qCentro=.5625 e variazione per texel X=.125, Y=0:

`baselineStored = .5625 − .5*.125 − .001 = .499km`.

Prendo il receiver strettamente interno a B:

`P = (−.001, −3.498, −.001)km`, quindi `(ξ,η,q)=(.001,−.001,.502)`.

Il raggio P+tS, t>0, non interseca mai più questo piano: la coordinata XZ rimane fissa e il raggio è sopra la superficie. Il receiver è fisicamente unoccluded, e il suo diffuse geometrico è positivo.

Il lookup del prodotto usa il radiale planetario, non un’approssimazione verticale. Qui il suo radiale unitario è proporzionale a `(−.001,6371.502,−.001)`. Chiamando L la lunghezza di questo vettore:

- `ξLookup = .001 + h*.001/L`;
- `ηLookup = −.001 − h*.001/L`;
- `qLookup = .502 + h*6371.502/L ≤ .53325`.

Poiché L>6000, lo spostamento assoluto XY è inferiore a 5.21e−9km: il lookup resta strettamente nello stesso texel, molto lontano dai suoi bordi, e sul lato B dell’edge ξ=.02. È anche sopra il piano locale: l’incremento q del lookup è quasi31.25m, quello del piano dovuto al minuscolo spostamento ξ è inferiore a1.042e−8km.

Il confronto corrente, senza un secondo bias receiver, dà:

- baseline: qLookup≥.499 ⇒ **lit**, corretto;
- clipped: qLookup≤.53325<.539 ⇒ **shadow**, falso, con margine di almeno **.00575km = 5.75m**.

Non dipende da f32, indice errato, varying non inizializzato, facce non coplanari, tie depth o pixel al bordo. È già falso in aritmetica reale con un caster RAW corretto. Il clipping conserva soltanto la porzione di A, mentre il receiver proietta nella porzione B dello stesso texel, il cui piano ha q più basso. L’offset radiale di mezzo texel non può garantire l’assenza di questo errore su un piano inclinato arbitrario.

## Implicazione limitata per il trial

Il caso falsifica una garanzia universale di assenza di false self-shadow del minimum ristretto alla sola faccia centrale. Non dimostra che sia la causa dei puntini reali o dei12 record, non misura la loro frequenza e non propone un nuovo bias/blur. Un’implementazione WGSL perfetta potrebbe comunque fallire artisticamente per questo limite. Perciò il readback del root deve distinguere due domande: «il codice produce il minimum progettato?» e «quel minimum è una rappresentazione valida della visibilità al lookup?». La prima può passare mentre la seconda fallisce.
