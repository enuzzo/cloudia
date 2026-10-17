# Branch rule — review statica indipendente

17 ottobre 2026. **Nessun blocker concreto rilevato nella sola lettura del diff.** Nessuna esecuzione di ricetta, prefix, test, modello, prepare, build o GPU; nessuna modifica a sorgenti/runner. Questo giudizio non certifica dati effettivi, connessione dopo erosione, risultato artistico o prestazioni.

Pin letti e ricalcolati:

- Candidato `branched-source/src/cumulonimbus/volume.ts`: SHA256 `d161e2efd350f38cce6ee353ef70a0af45a689c90c75d74f99d81213b4895003`.
- Base canonica `src/cumulonimbus/volume.ts`: `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`.
- `BRANCH-RULE-BEFORE-IMPLEMENTATION.json`: `3a2e9d75b4a2ecd4d0c4518fe7ab36a5d288286ac688f2fcdad0515a98f996c4`.
- `BRANCH-OWNERSHIP-AND-ROUNDING-BEFORE-RUN.json`: `01a3b0fbb07c02e68761e3d915a733f25ac131a91f5d305d5923b736b1257966`.

**Proprietà e altezza coerenti.** `turrets` conserva i riferimenti effettivi a foundation/middle/neck/top/spalle e al vero nucleo sepolto non-sheared (`180–211,267`). `branchGroups` riceve il core e i 18 figli con i 72 nipoti dal loop originale, senza selezioni geometriche o indici di seed (`297–333`). Le guardie richiedono 91 riferimenti distinti per gruppo, appartenenza a `lobes` e assenza di doppia proprietà. Base comune, pulse intermedio, sharedBody, collar e ice non entrano nella mappa. I gruppi del vecchio joint possono contenere gli stessi riferimenti di una branch, intenzionalmente: sono due operazioni sequenziali, non una doppia branch.

Il dominante è il summit effettivamente più alto, con la stessa scelta in caso di parità usata dal vecchio joint. Per ogni altro turret, target e deltaXZ sono calcolati una volta dalle fondazioni già contratte. Il raggio direzionale usa la formula dell'ellisse centrale XZ; il target è il minimo fra distanza originale e metà somma dei due raggi. È una regola di posizionamento geometrico, non un certificato di densità o alimentazione meteorologica.

`factor=1−clamp((core.y−foot.y)/(top.y−foot.y))` usa la quota del **core** per tutto il suo gruppo (`409–418`): foundation 1, top 0 e valori intermedi limitati a [0,1]. La traslazione della foundation precede gli altri gruppi, ma cambia soltanto X/Z: denominatore e fattori Y restano invariati. Il gruppo top non riceve addizioni, nemmeno +0, e i gruppi dominanti restano direttamente fermi. Raggi, Y e blend non vengono mutati.

**Ordine e interazioni espliciti.** Appendi e chiamate RNG del diff mantengono il precedente ordine; il nuovo codice aggiunge riferimenti/controlli, non nuovi draw o lobes. Le contrazioni originali precedono la branch, senza seconda contrazione. I limiti X/Z sono congelati a `max(4.35/2.8,preBranchExtent)` e verificati dopo branch e joint, senza epsilon, clipping o recupero automatico.

Teste, cap, maturo e parametri della spalla 14.1 non subiscono traslazioni dirette. **Il maturo finale non è ancora dimostrato identico:** il joint esistente normalizza la direzione verso la fondazione giovane ora spostata; anche se idealmente collineare, arrotondamenti/proiezioni o selezione devono essere confrontati nel prefix. `afterBranchCoreXYZ` e `finalCoreXYZ` consentono di separare le due fasi. Non estendo l'identità diretta a tutto il volume.

**Bound e costo.** Traslare rigidamente ogni kernel ellissoidale, a raggi invariati, conserva il suo limite analitico di gradiente≤1. Unione, raster locale, carving, R8, prefiltro, sampler e bake restano le espressioni canoniche: ciò non rende il campo quantizzato una nuova prova di continuità o occupazione. Map/Set di proprietà, insiemi di controllo, scansioni degli estremi e report aggiungono lavoro e memoria O(primitive) durante la generazione; il report numerico resta nel volume restituito. Nessuna nuova risorsa/lookup shader dal diff esaminato. Densità, supporto e lavoro GPU possono cambiare: nessuna deduzione FPS o costo zero.
