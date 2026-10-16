# Terreno: packing conservativo riuscito, paging locale non promosso

Il nuovo formato conserva esattamente i risultati del prototipo CPU sui 5198 raggi e riduce la memoria dei metadata da 4,996 a 2,914 MiB. **La politica di pagine provata non supera invece il gate globale:** gli unresolved scendono da 666 a 660, contro l'obiettivo fissato prima della prova di arrivare a non più di 333. Nessuna modifica è stata applicata al terreno del prodotto; GPU e FPS restano da qualificare.

## Cosa è stato realizzato

Il [prototipo](measurements/terrain-pages-2026-10-16/README.md) contiene un builder concreto, un formato serializzato e un tracer CPU. Ogni nodo conserva un RGBA32F con altezza minima/massima e puntatore; soltanto le foglie conservano il secondo RGBA32F con i gradienti. Il rettangolo si ricostruisce dalla chiave dyadica. Il tracer interseca i rettangoli dei figli prima di caricare i relativi record e legge il gradiente soltanto quando serve.

Le pagine sono bounds analitici del campo originale, con lo stesso hash, lo stesso ledger numerico e rounding outward. Non sostituiscono il terreno con una superficie interpolata. Il punto finale continua a interrogare la funzione originale. Restano invariati cap 16 point query, 256 visite, stack 48 e banda geometrica di 1 m.

## Esiti distinti

| Controllo | Esito |
| --- | --- |
| Repacking dei valori e rettangoli | PASS: 109141 nodi, tutte le altezze, gradienti di foglia, E e coordinate implicite verificati |
| Confronto geometrico senza pagine | PASS finito: 5198/5198 risultati, bracket, witness e conteggi di ricerca identici |
| Record logici del modello CPU senza pagine | 751146 → 99506, −86,75%; non è una misura di traffico GPU |
| Memoria serializzata senza pagine | 5238768 → 3055952 byte, 4,996 → 2,914 MiB |
| Holdout vicini, 48 raggi | Unresolved 32 → 21; zero conflitti, witness invalidi o regressioni risolto→unresolved |
| Holdout yaw, 18 raggi | Unresolved 12 → 7; gli stessi controlli di sicurezza finita passano |
| Due controlli esclusi dalla preparazione | Entrambi restano unresolved con cap 16 |
| Bounds delle nuove pagine | 10240 probe indipendenti su 2048 foglie, zero violazioni; controllo finito |
| Copertura completa dopo le pagine | FAIL: 666 → 660 unresolved, obiettivo ≤333 |
| Memoria serializzata finale | PASS rispetto al limite di residenza: 5549520 byte, 5,292 MiB, sotto 8 MiB |
| GPU, prodotto, 60 FPS | Non verificati da questo esperimento |

Il risultato completo dopo paging è 1917 hit, 1777 miss di traversal e 844 outer-envelope miss, più 660 unresolved. Non compaiono nuovi conflitti con i bracket precedenti, hit oltre 1 m, witness con segno invalido o trasformazioni di risultati già risolti in unresolved. Questo accordo sul corpus non dimostra una qualifica universale del ledger host o GPU.

## Come sono state scelte le pagine

Il protocollo fissava 27 raggi di preparazione in tre fasci, al massimo tre refill, foglie da 250 m e prefetch dei quattro vicini di faccia. Le richieste provenivano esclusivamente dal nodo pendente del normale cap 16; il builder riceveva chiave world-space, dimensione, hash del campo e versione del ledger. I risultati `cpu` della fixture e le distanze hit dell'oracle erano esclusi dall'input del selettore. I 66 holdout e i due controlli non hanno richiesto pagine; la matrice completa è stata eseguita soltanto dopo questi controlli, una sola volta.

Sono diventate residenti 24 pagine: sei blocker e diciotto prefetch, quattro da celle di 32 km e venti da celle di 2 km. Cinquanta richieste erano già alla dimensione obiettivo. Nessun limite di memoria è stato superato durante la residenza serializzata.

## Perché il beneficio non basta

I sei nuovi hit della matrice sono soltanto `home-down-0-5`…`home-down-5-5`. Anche il miglioramento degli holdout è concentrato nel fascio home; il fascio coastal-horizon resta unresolved e quello progettato nella transizione costa era già risolto prima delle pagine.

Dei 660 residui, 415 si fermano ancora in foglie da 2 km, sette in foglie da 32 km, ma 238 sono **già a 250 m**. Le poche aree preparate non coprono il campo camera completo; inoltre la sola aggiunta di pagine da 250 m non è qualificata come soluzione ai casi già fini. La prova non autorizza refill senza limite, un cap più alto o training sulle distanze hit.

Il paging aumenta leggermente anche i record logici del modello compatto: 99506 → 99662, +0,1568%. Le point query passano da 31226 a 31207, mentre le visite aumentano da 106949 a 107038. La soglia globale fallita resta tale e non è stata cambiata dopo aver letto i risultati.

## Costi osservati e limiti del trasferimento GPU

Le fasi pages e full hanno impiegato complessivamente 5,787 s, sotto il limite di 180 s, senza timeout, sweep o rilanci. La fase full termina con exit 1 perché fallisce il gate unresolved, non per un crash. La preparazione analitica delle pagine richiede 4,962 s; il refill completo 5,011 s; la serializzazione nei tre round 133,913 ms e i tre trace di preparazione 6,838 ms. Le quattro pagine grandi, comprese quelle di prefetch, dominano il costo di preparazione.

Il confronto CPU completo dopo la preparazione osserva 84,123 ms per la baseline compatta e 69,293 ms con pagine. È una sola coppia ordinata con effetti di warmup: non dimostra uno speedup stabile e non si converte in tempo GPU o FPS.

Il modello CPU conserva `Node`, anchor e cache del gradiente nei `Work`, oltre a una cache dei punti. Non dimostra che uno stack GPU da 16 byte conservi gli stessi valori senza altre letture o memoria. Il port dovrà verificare carichi reali, registri/spill e capacità prima di ciascun push; il corpus CPU ha massimo 18 elementi e nessun overflow osservato.

Gli 8 MiB sono un limite dei metadata residenti serializzati, non una misura del picco di heap o upload. Vecchio e nuovo tree compatti, se mantenuti simultaneamente, richiedono già 8605472 byte, 8,207 MiB, prima delle altre allocazioni. Un futuro doppio buffer deve avere un budget esplicito.

Il runner controllava gli SHA dei sorgenti fra le fasi pages/full e le dimensioni dei tree residenti, ma non gli SHA dei contenuti dei due binari al passaggio. Gli SHA correnti sono conservati; questo limite non è stato corretto retroattivamente e non è stata ripetuta la prova.

## Prove durevoli

L'[archivio](measurements/terrain-pages-2026-10-16/README.md) contiene sorgenti, protocollo, versioni effettive del runner, stdout/stderr, confronto completo, ogni witness e tutti gli unresolved. I JSON grandi sono gzip dei byte originali, con SHA originale e compresso nel [manifest](measurements/terrain-pages-2026-10-16/manifest.json); il verificatore controlla le copie e ricalcola i confronti dai risultati archiviati, senza simulazioni. Tree rigenerabili, dipendenze e duplicati di snapshot identici sono esclusi.

Sorgente del campo SHA256 `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`, fixture `cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1`, metadata originali `69b2b49c06eddb8c582b9f1b14cdb944f707488fd73a4f5f17d6e261f62b12c4`. La revisione indipendente e il resoconto completo sono conservati senza alterare prove o numeri. Packing promosso soltanto come candidato CPU verificato sul corpus; paging non promosso, nessun cambiamento prodotto o qualifica GPU.
