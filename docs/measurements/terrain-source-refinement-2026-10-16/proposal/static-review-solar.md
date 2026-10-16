# Review statica Solar R1, prima dei test

Sola lettura del prototipo `src/cumulonimbus/terrainMesh.ts` e dei test preparati, prima di qualunque esecuzione da parte del reviewer. Nessun source edit, test, typecheck, kernel, build, browser o GPU.

Non ho individuato un blocker concreto in: cellFirstIndex espresso in offset di indici; figli emessi contigui per cella; cellTriangleCount e limite20 per cella; selezione tramite hit sulle facce originali; edge key da endpoint originali con midpoint ID condivisi, green closure e winding delegato al helper; prefissi posizioni/surface copiati; ricalcolo finale delle normali geometriche; contabilizzazione separata di vertex/probe sampler calls. L’hit lookup resta nel vicinato bounded di celle/livelli, usando i figli effettivi.

Tre limiti importanti:

1. maxErrorKm=.005 è la soglia che seleziona le facce, non una garanzia di errore massimo dopo un singolo pass. Un nodo selezionante può non coincidere con uno dei midpoint aggiunti; il fit finale va misurato.
2. maxGeometryBytes limita il payload geometrico finale, non il picco RSS. La Map degli edge viene costruita prima del budget finale; base, nuovi array e accumulo delle normali possono coesistere. Serve il budget esterno di processo per la memoria di picco.
3. Il test off della bozza confronta due chiamate del nuovo modulo (refinement assente/undefined), non una baseline indipendente v58. Il root ha precisato il confronto corretto: nuovo build OFF, tutti cinque meshHashes e stats contro il vecchio risultato frozen, poi digest dei medesimi591361 errori uguale a `6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`; ON è uno stage separato. Questa proposta di verifica non è stata eseguita qui.

Nessun PASS artistico, di continuità, camera, shadow o FPS deriva dalla lettura. Helper split congelato invariato; nessun codice copiato/modificato da questa review.
